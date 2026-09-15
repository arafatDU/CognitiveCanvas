import uuid
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.db.session import get_db
from app.models.memolet import User, Memolet as MemoletModel
from app.services.temporal_auditor_service import temporal_auditor_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/time-grounding")
def get_time_grounding():
    """Returns the dynamic current time grounding used by the auditor."""
    return temporal_auditor_service.get_current_time_grounding()


@router.post("/verify/{memolet_id}")
def verify_memory(
    memolet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    LLM-as-a-judge check to verify if a stored memory has become deprecated relative to current date.
    """
    try:
        valid_id = uuid.UUID(memolet_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid memolet ID")

    memolet = db.query(MemoletModel).filter(
        MemoletModel.id == valid_id,
        (MemoletModel.user_id == current_user.id) | (MemoletModel.conversation.has(user_id=current_user.id))
    ).first()

    if not memolet:
        raise HTTPException(status_code=404, detail="Memolet not found")

    result = temporal_auditor_service.verify_memolet_staleness(memolet, db)
    return {
        "id": str(memolet.id),
        "is_time_sensitive": memolet.is_time_sensitive,
        "temporal_anchor": memolet.temporal_anchor,
        "is_deprecated": result.get("is_deprecated", False),
        "deprecation_reason": result.get("deprecation_reason"),
        "suggested_update": result.get("suggested_update"),
        "audited_at": memolet.audited_at.isoformat() if memolet.audited_at else None,
    }


@router.post("/refresh/{memolet_id}")
def refresh_memory(
    memolet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Self-Correction: Automatically refreshes an outdated memory with current standards,
    updating its text, embedding, and Neo4j concept graph in-place.
    """
    try:
        valid_id = uuid.UUID(memolet_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid memolet ID")

    memolet = db.query(MemoletModel).filter(
        MemoletModel.id == valid_id,
        (MemoletModel.user_id == current_user.id) | (MemoletModel.conversation.has(user_id=current_user.id))
    ).first()

    if not memolet:
        raise HTTPException(status_code=404, detail="Memolet not found")

    try:
        result = temporal_auditor_service.refresh_deprecated_memory(memolet, db)
        return result
    except Exception as e:
        logger.error(f"Failed to refresh memolet {memolet_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Refresh failed: {str(e)}")
