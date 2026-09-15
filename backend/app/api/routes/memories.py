import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.api import deps
from app.db.session import get_db
from app.db.neo4j import neo4j_connector
from app.models.memolet import Memolet as MemoletModel, User
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


@router.get("/", response_model=List[Memolet])
def get_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Fetch all memolets belonging to the current user ordered by creation time."""
    memolets = db.query(MemoletModel).filter(
        (MemoletModel.user_id == current_user.id) |
        (MemoletModel.conversation.has(user_id=current_user.id))
    ).order_by(MemoletModel.created_at.asc()).all()
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

    return {"message": f"Seeded {len(created)} demo memolets for user.", "created": created}


@router.get("/search", response_model=List[Memolet])
def search_memories(
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    GraphRAG-augmented hybrid search strictly scoped to the current user:
    1. Extract keywords from query text (including 2+ character terms like SQL, RAG, API)
    2. Retrieve related memolet IDs from Neo4j concept graph (filtered to user)
    3. Direct text and keyword substring matches
    4. Vector similarity search on user's memolets
    5. Return ranked matching results
    """
    cleaned_query = query.strip()
    if not cleaned_query:
        return []

    all_memolets = db.query(MemoletModel).filter(
        (MemoletModel.user_id == current_user.id) |
        (MemoletModel.conversation.has(user_id=current_user.id))
    ).all()
    if not all_memolets:
        return []

    # --- Step 1: GraphRAG — keyword-based graph traversal for current user ---
    graph_memolet_ids: set[str] = set()
    query_keywords = [w.lower().strip(".,;:?!\"'`()") for w in cleaned_query.split() if len(w) >= 2]

    try:
        with neo4j_connector.get_session() as neo4j_session:
            graph_results = graphrag_service.retrieve_context_subgraph(
                neo4j_session, query_keywords, user_id=str(current_user.id)
            )
            for r in graph_results:
                if r.get("memolet_id"):
                    graph_memolet_ids.add(r["memolet_id"])
    except Exception as e:
        logger.warning(f"GraphRAG search failed (continuing with vector only): {e}")

    # --- Step 2: Direct text and keyword matching boost ---
    q_lower = cleaned_query.lower()
    text_match_ids: list[str] = []
    for m in all_memolets:
        m_text = (m.text or "").lower()
        m_kw = [k.lower() for k in (m.keywords or [])]
        if q_lower in m_text or any(kw in q_lower or q_lower in kw for kw in m_kw):
            text_match_ids.append(str(m.id))
        elif any(qw in m_text for qw in query_keywords if len(qw) >= 3):
            text_match_ids.append(str(m.id))

    # --- Step 3: Vector similarity search on user's memolets ---
    texts = [m.text for m in all_memolets]
    embeddings = [m.embedding for m in all_memolets]

    scored_ids: list[str] = []
    try:
        import numpy as np

        scored_texts = [(m, t, e) for m, t, e in zip(all_memolets, texts, embeddings) if e is not None]
        if scored_texts:
            mems, txts, embs = zip(*scored_texts)
            scores = retrieval_service.hybrid_search(
                query=cleaned_query,
                document_texts=list(txts),
                document_embeddings=list(embs),
            )
            top_indices = np.argsort(scores)[-10:][::-1]
            scored_ids = [str(mems[i].id) for i in top_indices if scores[i] > 0.05]
    except Exception as e:
        logger.warning(f"Vector search failed: {e}")

    # --- Step 4: Merge results (Text matches & Graph hits first, then vector) ---
    allowed_user_ids = {str(m.id) for m in all_memolets}
    merged_ids: list[str] = []
    
    # Priority: text matches + graph hits + vector hits
    for mid in text_match_ids + list(graph_memolet_ids) + scored_ids:
        if mid in allowed_user_ids and mid not in merged_ids:
            merged_ids.append(mid)

    if not merged_ids:
        return []

    # Return ordered results
    id_order = {mid: i for i, mid in enumerate(merged_ids)}
    result_memolets = [m for m in all_memolets if str(m.id) in id_order]
    result_memolets.sort(key=lambda m: id_order.get(str(m.id), 999))

    return result_memolets[:12]


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
