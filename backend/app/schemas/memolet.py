import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class MemoletBase(BaseModel):
    text: str
    weight: Optional[float] = 1.0
    keywords: List[str] = Field(default_factory=list)
    color: Optional[str] = None
    
    # Temporal Auditing & Staleness Fields
    is_time_sensitive: Optional[bool] = False
    deprecation_risk: Optional[str] = "none"
    temporal_anchor: Optional[str] = None
    validity_horizon_days: Optional[int] = 365
    is_deprecated: Optional[bool] = False
    deprecation_reason: Optional[str] = None
    suggested_update: Optional[str] = None
    audited_at: Optional[datetime] = None


class MemoletCreate(MemoletBase):
    pass


class ChatIngestRequest(BaseModel):
    conversation_id: Optional[uuid.UUID] = None
    chat_log: str


class Memolet(MemoletBase):
    id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

