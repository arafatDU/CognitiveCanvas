import logging
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api import deps
from app.db.session import get_db
from app.db.neo4j import neo4j_connector
from app.models.memolet import Memolet as MemoletModel, User, Conversation
from app.schemas.memolet import Memolet, MemoletCreate

from app.services.retrieval import retrieval_service
from app.services.graphrag import graphrag_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Demo seed data — realistic {summary, user, ai} pairs
# ---------------------------------------------------------------------------
DEMO_PAIRS = [
    {
        "summary": "The user asked about GraphRAG and the AI explained it combines knowledge graphs with retrieval-augmented generation for more precise answers.",
        "user": "Can you explain how GraphRAG works and why it's better than regular RAG?",
        "ai": (
            "GraphRAG (Graph Retrieval-Augmented Generation) enhances traditional RAG by storing knowledge in a "
            "graph structure rather than a flat vector store. Instead of just finding similar chunks, it traverses "
            "entity relationships — so when you ask about 'Python async programming', it also retrieves connected "
            "concepts like 'event loops', 'coroutines', and 'asyncio'. This gives the LLM richer, more connected "
            "context, reducing hallucinations and improving answer depth significantly."
        ),
        "keywords": ["GraphRAG", "knowledge", "graph", "retrieval", "augmented", "generation"],
        "color": "#bfdbfe",
    },
    {
        "summary": "The user asked about the difference between transformers and RNNs; the AI explained attention mechanisms and parallelization advantages.",
        "user": "What is the key difference between transformer models and RNNs for NLP tasks?",
        "ai": (
            "The fundamental difference lies in how they process sequences. RNNs (Recurrent Neural Networks) "
            "process tokens sequentially — each step depends on the previous hidden state — making them slow to "
            "train and prone to vanishing gradients over long sequences. Transformers, introduced in 'Attention "
            "Is All You Need', replace recurrence with self-attention: every token attends to every other token "
            "in parallel. This makes training massively parallelizable on GPUs and allows the model to capture "
            "long-range dependencies much more effectively. Modern LLMs like GPT-4 and Gemini are all transformer-based."
        ),
        "keywords": ["transformer", "attention", "RNN", "sequential", "NLP", "parallelization"],
        "color": "#bbf7d0",
    },
    {
        "summary": "The user asked how to optimize database queries in PostgreSQL and the AI explained indexing strategies and query plan analysis.",
        "user": "My PostgreSQL queries are slow on a table with 10 million rows. How do I optimize them?",
        "ai": (
            "For large PostgreSQL tables, start with EXPLAIN ANALYZE to understand the query plan — look for "
            "sequential scans on high-row-count tables, which signal missing indexes. Add B-tree indexes on "
            "frequently filtered columns and composite indexes for multi-column WHERE clauses. Use partial indexes "
            "for filtered queries (e.g., WHERE status = 'active'). For full-text search, use GIN indexes with "
            "tsvector. Consider partitioning the table by date or category if you always filter on those dimensions. "
            "Finally, use connection pooling (PgBouncer) and increase work_mem for complex sort/hash operations."
        ),
        "keywords": ["PostgreSQL", "indexing", "query", "optimization", "performance", "database"],
        "color": "#fef3c7",
    },
]


# In-memory user memolets cache for fast repeated searches
_USER_MEMOLETS_CACHE: dict[str, tuple[float, list[MemoletModel]]] = {}
CACHE_TTL_SECONDS = 60.0


def get_cached_user_memolets(db: Session, user_id: str) -> list[MemoletModel]:
    now = time.time()
    if user_id in _USER_MEMOLETS_CACHE:
        ts, mems = _USER_MEMOLETS_CACHE[user_id]
        if now - ts < CACHE_TTL_SECONDS:
            return mems

    import uuid
    uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    mems = db.query(MemoletModel).filter(
        (MemoletModel.user_id == uid) |
        (MemoletModel.conversation_id.in_(
            db.query(Conversation.id).filter(Conversation.user_id == uid)
        ))
    ).order_by(MemoletModel.created_at.asc()).all()
    _USER_MEMOLETS_CACHE[user_id] = (now, mems)
    return mems


def invalidate_user_memolets_cache(user_id: str):
    _USER_MEMOLETS_CACHE.pop(str(user_id), None)


@router.get("/", response_model=List[Memolet])
def get_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Fetch all memolets belonging to the current user ordered by creation time."""
    memolets = get_cached_user_memolets(db, str(current_user.id))
    return memolets


@router.post("/seed-demo")
def seed_demo_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Seeds the database with demo memolets specifically for the current user so the UI has initial data.
    Only inserts if the current user has fewer than 3 memolets (idempotent).
    """
    existing_count = db.query(MemoletModel).filter(
        (MemoletModel.user_id == current_user.id) |
        (MemoletModel.conversation.has(user_id=current_user.id))
    ).count()
    if existing_count >= 3:
        return {"message": "Demo data already exists for this user.", "count": existing_count}

    created = []
    try:
        with neo4j_connector.get_session() as neo4j_session:
            for pair in DEMO_PAIRS:
                serialized_text = (
                    f"Summary: {pair['summary']}\nUser: {pair['user']}\nAI: {pair['ai']}"
                )
                try:
                    embedding = retrieval_service.encode_text(serialized_text)
                except Exception as e:
                    logger.warning(f"Embedding failed during seed: {e}")
                    embedding = None

                db_memolet = MemoletModel(
                    user_id=current_user.id,
                    text=serialized_text,
                    keywords=pair["keywords"],
                    color=pair["color"],
                    embedding=embedding,
                )
                db.add(db_memolet)
                db.commit()
                db.refresh(db_memolet)

                try:
                    graphrag_service.add_concepts_to_graph(neo4j_session, db_memolet, user_id=str(current_user.id))
                except Exception as e:
                    logger.warning(f"Neo4j seed failed: {e}")

                created.append({"id": str(db_memolet.id), "summary": pair["summary"][:60]})

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Seed failed: {str(e)}")

    invalidate_user_memolets_cache(str(current_user.id))
    return {"message": f"Seeded {len(created)} demo memolets for user.", "created": created}


STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
    "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had",
    "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd",
    "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
    "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off",
    "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over",
    "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
    "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't",
    "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when",
    "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's",
    "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've",
    "your", "yours", "yourself", "yourselves", "tell", "give", "show", "explain", "please"
}


def extract_meaningful_keywords(query: str) -> list[str]:
    tokens = [w.lower().strip(".,;:?!\"'`()[]{}#*-_/") for w in query.split()]
    return [t for t in tokens if len(t) >= 2 and t not in STOPWORDS]


@router.get("/search", response_model=List[Memolet])
def search_memories(
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    GraphRAG-augmented hybrid search strictly scoped to the current user:
    1. Extract meaningful keywords from query (excluding stopwords)
    2. Retrieve related memolet IDs and concept hits from Neo4j
    3. Direct phrase and keyword overlap scoring
    4. Fast cached vector similarity search
    5. Rank strictly by composite relevance score and return top results
    """
    cleaned_query = query.strip()
    if not cleaned_query:
        return []

    all_memolets = get_cached_user_memolets(db, str(current_user.id))
    if not all_memolets:
        return []


    meaningful_keywords = extract_meaningful_keywords(cleaned_query)
    q_lower = cleaned_query.lower()

    # --- Step 1: GraphRAG — keyword-based graph traversal for current user ---
    graph_concept_matches: dict[str, list[str]] = {}
    if meaningful_keywords:
        try:
            with neo4j_connector.get_session() as neo4j_session:
                graph_results = graphrag_service.retrieve_context_subgraph(
                    neo4j_session, meaningful_keywords, user_id=str(current_user.id)
                )
                for r in graph_results:
                    mid = r.get("memolet_id")
                    if mid:
                        graph_concept_matches[str(mid)] = r.get("concepts", [])
        except Exception as e:
            logger.warning(f"GraphRAG search failed: {e}")

    # --- Step 2: Vector embedding of query ---
    query_emb = None
    try:
        query_emb = retrieval_service.encode_query(cleaned_query)
    except Exception as e:
        logger.warning(f"Query embedding failed: {e}")

    # --- Step 3: Composite scoring for all user memolets ---
    import numpy as np

    scored_memolets: list[tuple[float, MemoletModel]] = []
    has_meaningful_kws = len(meaningful_keywords) > 0

    for m in all_memolets:
        score = 0.0
        m_text = (m.text or "").lower()
        m_kws = [k.lower() for k in (m.keywords or [])]
        m_id_str = str(m.id)

        # 3a. Exact phrase match in text or keywords
        if q_lower in m_text:
            score += 3.5
        for k in m_kws:
            if q_lower == k:
                score += 3.5
            elif q_lower in k or k in q_lower:
                score += 2.5

        # 3b. Meaningful keyword overlap
        if has_meaningful_kws:
            matched_kws = [
                w for w in meaningful_keywords
                if any(w in k or k in w for k in m_kws) or w in m_text
            ]
            if matched_kws:
                score += 3.5 * (len(matched_kws) / len(meaningful_keywords))
                exact_tag_matches = sum(1 for w in meaningful_keywords if any(w == k for k in m_kws))
                score += 1.5 * exact_tag_matches

        # 3c. GraphRAG concept match
        if m_id_str in graph_concept_matches:
            matched_concepts = graph_concept_matches[m_id_str]
            score += 2.0 * (min(len(matched_concepts), 3) / 3.0)

        # 3d. Semantic vector similarity
        if query_emb is not None and m.embedding is not None and len(m.embedding) > 0:
            try:
                m_emb = np.array(m.embedding, dtype=np.float32)
                cos_sim = float(np.dot(m_emb, query_emb) / (np.linalg.norm(m_emb) * np.linalg.norm(query_emb) + 1e-9))
                if cos_sim > 0.20:
                    score += 2.5 * cos_sim
            except Exception:
                pass

        # Threshold: if query had meaningful keywords, require positive relevance
        threshold = 0.55 if has_meaningful_kws else 0.8
        if score >= threshold:
            scored_memolets.append((score, m))

    # Sort descending by score
    scored_memolets.sort(key=lambda x: x[0], reverse=True)

    # Return top 12 results
    return [m for _, m in scored_memolets[:12]]



@router.delete("/{memolet_id}")
def delete_memory(
    memolet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Permanently deletes a memory from PostgreSQL database and the Neo4j GraphRAG knowledge graph.
    """
    import uuid

    try:
        valid_id = uuid.UUID(memolet_id)
        db_memolet = db.query(MemoletModel).filter(
            MemoletModel.id == valid_id,
            (MemoletModel.user_id == current_user.id) | (MemoletModel.conversation.has(user_id=current_user.id))
        ).first()
        if not db_memolet:
            raise HTTPException(status_code=404, detail="Memolet not found")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid memolet ID")

    # 1. Remove from Neo4j GraphRAG
    try:
        with neo4j_connector.get_session() as neo4j_session:
            graphrag_service.delete_memolet_from_graph(neo4j_session, str(valid_id))
    except Exception as e:
        logger.warning(f"Failed to delete memolet {valid_id} from Neo4j: {e}")

    # 2. Remove from PostgreSQL
    db.delete(db_memolet)
    db.commit()

    invalidate_user_memolets_cache(str(current_user.id))

    return {"status": "success", "id": str(valid_id), "message": "Memory deleted successfully"}


@router.get("/task/{task_id}")
def get_task_status(task_id: str, current_user: User = Depends(deps.get_current_user)):
    """Legacy endpoint for Celery task status (kept for compatibility)."""
    return {"task_id": task_id, "task_status": "N/A", "task_result": None}


@router.post("/{memolet_id}/reinforce")
def reinforce_memory(
    memolet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    import uuid
    from app.services.reinforcement import reinforcement_service

    try:
        valid_id = uuid.UUID(memolet_id)
        db_memolet = db.query(MemoletModel).filter(
            MemoletModel.id == valid_id,
            (MemoletModel.user_id == current_user.id) | (MemoletModel.conversation.has(user_id=current_user.id))
        ).first()
        if not db_memolet:
            raise HTTPException(status_code=404, detail="Memolet not found")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid memolet ID")

    reinforcement_service.reinforce_memory(db, str(valid_id))
    return {"status": "success"}


class ExtractSubmemoletRequest(BaseModel):
    parent_id: Optional[str] = None
    text: str
    summary: Optional[str] = None
    color: Optional[str] = None


@router.post("/extract-submemolet", response_model=Memolet)
def extract_submemolet(
    req: ExtractSubmemoletRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Extracts a sub-memolet from selected text or parent memolet,
    generates embeddings, saves to PostgreSQL, and indexes concepts in Neo4j.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    import re
    words = re.findall(r'\b[A-Za-z0-9_-]{3,}\b', req.text)
    stop_words = {"the", "and", "for", "with", "this", "that", "from", "have", "you", "are"}
    filtered_words = [w for w in words if w.lower() not in stop_words]
    keywords = list(dict.fromkeys(filtered_words))[:6] if filtered_words else ["snippet"]

    summary = req.summary or req.text.strip().split("\n")[0][:140]

    try:
        embedding = retrieval_service.encode_text(req.text)
    except Exception as e:
        logger.warning(f"Embedding failed for submemolet: {e}")
        embedding = None

    db_memolet = MemoletModel(
        user_id=current_user.id,
        text=f"Summary: {summary}\nUser: Extracted sub-context\nAI: {req.text}",
        keywords=keywords,
        color=req.color or "#bfdbfe",
        embedding=embedding,
    )
    db.add(db_memolet)
    db.commit()
    db.refresh(db_memolet)

    try:
        with neo4j_connector.get_session() as neo4j_session:
            graphrag_service.add_concepts_to_graph(neo4j_session, db_memolet, user_id=str(current_user.id))
            if req.parent_id:
                neo4j_session.run(
                    """
                    MATCH (parent:Memolet {id: $parent_id}), (child:Memolet {id: $child_id})
                    MERGE (child)-[:EXTRACTED_FROM]->(parent)
                    """,
                    parent_id=str(req.parent_id),
                    child_id=str(db_memolet.id),
                )
    except Exception as e:
        logger.warning(f"Neo4j submemolet link failed: {e}")

    invalidate_user_memolets_cache(str(current_user.id))
    return db_memolet

