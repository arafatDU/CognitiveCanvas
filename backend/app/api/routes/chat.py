import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import json
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.api import deps
from app.db.session import get_db
from app.db.neo4j import neo4j_connector
from app.models.memolet import User, Memolet as MemoletModel, Conversation, ChatMessage
from app.schemas.chat import ConversationListResponse, ConversationResponse
from app.services.llm_router import llm_router
from app.services.trust_service import trust_service
from app.services.retrieval import retrieval_service
from app.services.graphrag import graphrag_service
from app.services.temporal_auditor_service import temporal_auditor_service
from pydantic import BaseModel
import random

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    active_memolet_ids: List[str] = []
    model: Optional[str] = None
    conversation_id: Optional[str] = None
    spatial_instructions: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    sentences: List[str]
    confidence_heatmap: List[float]
    citations: List[List[str]]
    conflict_warning: bool
    conversation_id: str
    model: Optional[str] = None
    deprecation_warnings: List[Dict[str, Any]] = []



class MemorySaveRequest(BaseModel):
    conversation_id: Optional[str] = None
    messages: List[Dict[str, str]]  # [{\"user\": \"hello\", \"ai\": \"hi there\"}, ...]


@router.get("/models")
def get_available_models():
    """Returns available LLM models grouped by provider."""
    models = llm_router.available_models if llm_router.available_models else [llm_router.default_model]
    return {
        "models": models,
        "grouped": llm_router.grouped_models,
        "default": llm_router.default_model,
    }



@router.post("/", response_model=ChatResponse)
def generate_chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    # Retrieve or create conversation
    conversation = None
    if req.conversation_id:
        conversation = db.query(Conversation).filter(Conversation.id == req.conversation_id, Conversation.user_id == current_user.id).first()
        
    if not conversation:
        conversation = Conversation(user_id=current_user.id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # Save user message
    user_msg = ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=req.message
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 1. Fetch memolets by ID (if any cited with @mention)
    memolets = []
    if req.active_memolet_ids:
        try:
            import uuid
            valid_ids = [uuid.UUID(mid) for mid in req.active_memolet_ids if mid]
            if valid_ids:
                memolets = db.query(MemoletModel).filter(
                    MemoletModel.id.in_(valid_ids),
                    (MemoletModel.user_id == current_user.id) | (MemoletModel.conversation.has(user_id=current_user.id))
                ).all()
        except Exception as e:
            logger.warning(f"Could not parse memolet IDs: {e}")

    contents = [m.text for m in memolets]
    active_ids = [str(m.id) for m in memolets]

    # Check temporal staleness & deprecation on active memolets
    deprecation_warnings = []
    for m in memolets:
        if getattr(m, "is_deprecated", False):
            deprecation_warnings.append({
                "memolet_id": str(m.id),
                "temporal_anchor": getattr(m, "temporal_anchor", None),
                "reason": getattr(m, "deprecation_reason", None) or "Outdated context detected",
                "suggested_update": getattr(m, "suggested_update", None)
            })
        elif getattr(m, "is_time_sensitive", False):
            v_res = temporal_auditor_service.verify_memolet_staleness(m, db)
            if v_res.get("is_deprecated"):
                deprecation_warnings.append({
                    "memolet_id": str(m.id),
                    "temporal_anchor": getattr(m, "temporal_anchor", None),
                    "reason": v_res.get("deprecation_reason") or "Outdated context detected",
                    "suggested_update": v_res.get("suggested_update")
                })

    # 2. Check conflicts
    conflict_warning = trust_service.evaluate_conflict(contents)

    # 3. Build prompt and call LLM
    llm_messages = []
    if contents:
        system_prompt = (
            "You are an intelligent AI assistant. "
            "Answer the user's prompt directly, accurately, and thoroughly using the provided Memory Context where relevant.\n\n"
            "Memory Context:\n" + "\n---\n".join(contents)
        )
        if deprecation_warnings:
            time_info = temporal_auditor_service.get_current_time_grounding()
            warn_bullets = "\n".join([
                f"- Memory {w['memolet_id'][:6]}: {w['reason']}. Modern recommendation: {w['suggested_update'] or 'Follow current best practices.'}"
                for w in deprecation_warnings
            ])
            system_prompt += (
                f"\n\n[TEMPORAL AUDITOR NOTICE - Current Date: {time_info['current_date_str']}]:\n"
                f"The following active memory context contains deprecated or outdated syntax:\n{warn_bullets}\n"
                f"You MUST prioritize modern {time_info['current_date_str']} best practices and explicitly caution the user if the memory advice is outdated."
            )
        if req.spatial_instructions:
            system_prompt += (
                f"\n\n[SPATIAL SENSEMAKING CANVAS INSTRUCTIONS]:\n"
                f"{req.spatial_instructions}\n"
                f"Follow these layout priorities and context groupings precisely."
            )
        system_prompt += (
            "\n\nWhen referencing information from memory context, cite the relevant memory display id using [[citation:ID]] format (e.g. [[citation:1_0]])."
        )
        llm_messages.append({"role": "system", "content": system_prompt})

    # Load recent conversation history
    recent_messages = db.query(ChatMessage).filter(ChatMessage.conversation_id == conversation.id).order_by(ChatMessage.created_at.asc()).all()
    for msg in recent_messages[-10:]:
        llm_messages.append({"role": msg.role if msg.role in ["user", "system", "assistant"] else "assistant" if msg.role == "ai" else msg.role, "content": msg.content})

    if not llm_messages or llm_messages[-1].get("content") != req.message:
        llm_messages.append({"role": "user", "content": req.message})

    response = llm_router.generate_response(llm_messages, model=req.model)

    try:
        reply_text = response["choices"][0]["message"]["content"]
    except (KeyError, TypeError, IndexError):
        reply_text = "Internal LLM routing error occurred."

    # 4. Process heatmaps & citations
    sentences = [s.strip() + "." for s in reply_text.split(".") if len(s.strip()) > 3]
    if not sentences:
        sentences = [reply_text]

    heatmap = trust_service.compute_confidence_heatmap(sentences, contents)
    citations = trust_service.trace_citations(sentences, contents, active_ids)
    
    flattened_citations = [c for sublist in citations for c in sublist] if citations else []

    if not conversation.title:
        words = reply_text.split()
        conversation.title = " ".join(words[:5]) + ("..." if len(words) > 5 else "")

    ai_msg = ChatMessage(
        conversation_id=conversation.id,
        role="ai",
        content=reply_text,
        citations=flattened_citations
    )
    db.add(ai_msg)
    db.commit()

    return ChatResponse(
        reply=reply_text,
        sentences=sentences,
        confidence_heatmap=heatmap,
        citations=citations,
        conflict_warning=conflict_warning,
        conversation_id=str(conversation.id),
        model=req.model or llm_router.default_model,
        deprecation_warnings=deprecation_warnings
    )


@router.post("/stream")
def generate_chat_stream(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Streams LLM tokens real-time using Server-Sent Events (SSE)."""
    conversation = None
    if req.conversation_id:
        conversation = db.query(Conversation).filter(Conversation.id == req.conversation_id, Conversation.user_id == current_user.id).first()
        
    if not conversation:
        conversation = Conversation(user_id=current_user.id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    user_msg = ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=req.message
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    memolets = []
    if req.active_memolet_ids:
        try:
            import uuid
            valid_ids = [uuid.UUID(mid) for mid in req.active_memolet_ids if mid]
            if valid_ids:
                memolets = db.query(MemoletModel).filter(
                    MemoletModel.id.in_(valid_ids),
                    (MemoletModel.user_id == current_user.id) | (MemoletModel.conversation.has(user_id=current_user.id))
                ).all()
        except Exception as e:
            logger.warning(f"Could not parse memolet IDs: {e}")

    contents = [m.text for m in memolets]
    active_ids = [str(m.id) for m in memolets]

    # Check temporal staleness & deprecation on active memolets
    deprecation_warnings = []
    for m in memolets:
        if getattr(m, "is_deprecated", False):
            deprecation_warnings.append({
                "memolet_id": str(m.id),
                "temporal_anchor": getattr(m, "temporal_anchor", None),
                "reason": getattr(m, "deprecation_reason", None) or "Outdated context detected",
                "suggested_update": getattr(m, "suggested_update", None)
            })
        elif getattr(m, "is_time_sensitive", False):
            v_res = temporal_auditor_service.verify_memolet_staleness(m, db)
            if v_res.get("is_deprecated"):
                deprecation_warnings.append({
                    "memolet_id": str(m.id),
                    "temporal_anchor": getattr(m, "temporal_anchor", None),
                    "reason": v_res.get("deprecation_reason") or "Outdated context detected",
                    "suggested_update": v_res.get("suggested_update")
                })

    conflict_warning = trust_service.evaluate_conflict(contents)

    llm_messages = []
    if contents:
        system_prompt = (
            "You are an intelligent AI assistant. "
            "Answer the user's prompt directly, accurately, and thoroughly using the provided Memory Context where relevant.\n\n"
            "Memory Context:\n" + "\n---\n".join(contents)
        )
        if deprecation_warnings:
            time_info = temporal_auditor_service.get_current_time_grounding()
            warn_bullets = "\n".join([
                f"- Memory {w['memolet_id'][:6]}: {w['reason']}. Modern recommendation: {w['suggested_update'] or 'Follow current best practices.'}"
                for w in deprecation_warnings
            ])
            system_prompt += (
                f"\n\n[TEMPORAL AUDITOR NOTICE - Current Date: {time_info['current_date_str']}]:\n"
                f"The following active memory context contains deprecated or outdated syntax:\n{warn_bullets}\n"
                f"You MUST prioritize modern {time_info['current_date_str']} best practices and explicitly caution the user if the memory advice is outdated."
            )
        if req.spatial_instructions:
            system_prompt += (
                f"\n\n[SPATIAL SENSEMAKING CANVAS INSTRUCTIONS]:\n"
                f"{req.spatial_instructions}\n"
                f"Follow these layout priorities and context groupings precisely."
            )
        system_prompt += (
            "\n\nWhen referencing information from memory context, cite the relevant memory display id using [[citation:ID]] format (e.g. [[citation:1_0]])."
        )
        llm_messages.append({"role": "system", "content": system_prompt})

    recent_messages = db.query(ChatMessage).filter(ChatMessage.conversation_id == conversation.id).order_by(ChatMessage.created_at.asc()).all()
    for msg in recent_messages[-10:]:
        llm_messages.append({"role": msg.role if msg.role in ["user", "system", "assistant"] else "assistant" if msg.role == "ai" else msg.role, "content": msg.content})

    if not llm_messages or llm_messages[-1].get("content") != req.message:
        llm_messages.append({"role": "user", "content": req.message})

    selected_model = req.model or llm_router.default_model

    def event_stream():
        full_reply = []
        for token in llm_router.generate_response_stream(llm_messages, model=selected_model):
            full_reply.append(token)
            yield f"data: {json.dumps({'token': token})}\n\n"

        reply_text = "".join(full_reply)
        sentences = [s.strip() + "." for s in reply_text.split(".") if len(s.strip()) > 3]
        if not sentences:
            sentences = [reply_text]

        heatmap = trust_service.compute_confidence_heatmap(sentences, contents)
        citations = trust_service.trace_citations(sentences, contents, active_ids)
        flattened_citations = [c for sublist in citations for c in sublist] if citations else []

        if not conversation.title:
            words = reply_text.split()
            conversation.title = " ".join(words[:5]) + ("..." if len(words) > 5 else "")

        ai_msg = ChatMessage(
            conversation_id=conversation.id,
            role="ai",
            content=reply_text,
            citations=flattened_citations
        )
        db.add(ai_msg)
        db.commit()

        final_payload = {
            "done": True,
            "conversation_id": str(conversation.id),
            "citations": citations,
            "confidence_heatmap": heatmap,
            "conflict_warning": conflict_warning,
            "model": selected_model,
            "deprecation_warnings": deprecation_warnings
        }
        yield f"data: {json.dumps(final_payload)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@router.get("/conversations", response_model=List[ConversationListResponse])
def get_conversations(db: Session = Depends(get_db), current_user: User = Depends(deps.get_current_user)):
    conversations = db.query(Conversation).filter(Conversation.user_id == current_user.id).order_by(Conversation.created_at.desc()).all()
    return conversations

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation(conversation_id: str, db: Session = Depends(get_db), current_user: User = Depends(deps.get_current_user)):
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation

@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db), current_user: User = Depends(deps.get_current_user)):
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conversation)
    db.commit()
    return {"message": "Conversation deleted"}


@router.post("/save-memory")
def save_chat_to_memory(
    req: MemorySaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Saves multiple (user msg + AI response) pairs into the memory bank in ONE UNIFIED PASS:
      1. Single-pass unified Summarization & Temporal Deprecation Audit via gemini-3.5-flash-lite
      2. Encodes embeddings
      3. Saves Memolet with temporal metadata to Postgres
      4. Updates Neo4j knowledge graph with multi-tenant user scoping
    """
    if not req.messages:
        raise HTTPException(status_code=400, detail="No messages provided to save.")

    valid_pairs = []
    for pair in req.messages:
        u = pair.get("user", "").strip()
        a = pair.get("ai", "").strip()
        if u or a:
            valid_pairs.append({"user": u, "ai": a})

    if not valid_pairs:
        raise HTTPException(status_code=400, detail="No non-empty messages to save.")

    # 1. Single-Pass Unified Session & Multi-Pair Summarization & Deprecation Audit (1 LLM call)
    session_audit = temporal_auditor_service.audit_and_summarize_session(valid_pairs)
    pair_results = session_audit.get("pair_results", [])
    overarching_summary = session_audit.get("overarching_summary", "")

    if len(valid_pairs) == 1:
        p = valid_pairs[0]
        pr = pair_results[0] if pair_results else {}
        p_summary = pr.get("summary") or overarching_summary or f"{p['user'][:80]}..."
        serialized_text = f"Summary: {p_summary}\nUser: {p['user']}\nAI: {p['ai']}"
    else:
        # Multi-pair consolidated format with hierarchical overview and delimiters
        blocks = [f"Overview: {overarching_summary}"]
        for p, pr in zip(valid_pairs, pair_results):
            p_sum = pr.get("summary") or f"{p['user'][:60]}..."
            blocks.append(f"---PAIR---\nSummary: {p_sum}\nUser: {p['user']}\nAI: {p['ai']}")
        serialized_text = "\n".join(blocks)

    # 2. Embedding for dense vector search
    try:
        embedding = retrieval_service.encode_text(serialized_text)
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        embedding = None

    PASTEL_COLORS = [
        "#fef08a", "#fef9c3", "#bbf7d0", "#d9f99d", 
        "#bfdbfe", "#e0f2fe", "#fbcfe8", "#fce7f3", 
        "#e9d5ff", "#f3e8ff", "#fed7aa", "#ffedd5"
    ]
    assigned_color = random.choice(PASTEL_COLORS)
    conversation_id = req.conversation_id if req.conversation_id else None

    try:
        # 3. Exactly ONE consolidated MemoletModel in PostgreSQL
        db_memolet = MemoletModel(
            user_id=current_user.id,
            conversation_id=conversation_id,
            text=serialized_text,
            keywords=session_audit.get("aggregated_keywords", []),
            embedding=embedding,
            color=assigned_color,
            is_time_sensitive=session_audit.get("is_time_sensitive", False),
            deprecation_risk=session_audit.get("deprecation_risk", "none"),
            temporal_anchor=session_audit.get("temporal_anchor"),
            validity_horizon_days=session_audit.get("validity_horizon_days", 365),
            is_deprecated=session_audit.get("is_deprecated", False),
            deprecation_reason=session_audit.get("deprecation_reason"),
            suggested_update=session_audit.get("suggested_update"),
            audited_at=datetime.utcnow() if session_audit.get("is_time_sensitive") else None,
        )
        db.add(db_memolet)
        db.commit()
        db.refresh(db_memolet)

        # 4. Update GraphRAG (Neo4j)
        try:
            with neo4j_connector.get_session() as neo4j_session:
                graphrag_service.add_concepts_to_graph(neo4j_session, db_memolet, user_id=str(current_user.id))
        except Exception as e:
            logger.warning(f"Neo4j update failed for memolet {db_memolet.id}: {e}")

        processed = [{
            "id": str(db_memolet.id),
            "summary": overarching_summary,
            "is_time_sensitive": db_memolet.is_time_sensitive,
            "is_deprecated": db_memolet.is_deprecated,
            "deprecation_risk": db_memolet.deprecation_risk,
            "temporal_anchor": db_memolet.temporal_anchor,
            "pair_count": len(valid_pairs),
        }]

    except Exception as e:
        db.rollback()
        logger.error(f"save-memory error: {e}")
        raise HTTPException(status_code=500, detail=f"Memory save failed: {str(e)}")

    return {
        "message": f"Successfully saved {len(valid_pairs)} interaction(s) as a consolidated memory object.",
        "saved": processed,
    }

