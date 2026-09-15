from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime

class MemoletBase(BaseModel):
    text: str
    weight: Optional[float] = 1.0
    keywords: List[str] = Field(default_factory=list)
    
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    color: Optional[str] = None
    
    # Temporal Auditing & Staleness Fields
    is_time_sensitive: bool = False
    deprecation_risk: Optional[str] = "none"
    temporal_anchor: Optional[str] = None
    validity_horizon_days: Optional[int] = 365
    is_deprecated: bool = False
    deprecation_reason: Optional[str] = None
    suggested_update: Optional[str] = None
    audited_at: Optional[datetime] = None
    
class MemoletCreate(MemoletBase):
    pass

class MemoletUpdate(BaseModel):
    text: Optional[str] = None
    weight: Optional[float] = None
    keywords: Optional[List[str]] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    color: Optional[str] = None
    is_time_sensitive: Optional[bool] = None
    is_deprecated: Optional[bool] = None
    deprecation_reason: Optional[str] = None
    suggested_update: Optional[str] = None
    
class MemoletResponse(MemoletBase):
    id: uuid.UUID
    conversation_id: Optional[uuid.UUID] = None
    created_at: datetime
    last_accessed_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SandboxStateUpdate(BaseModel):
    memolet_updates: List["MemoletUpdateWithId"]

class MemoletUpdateWithId(MemoletUpdate):
    id: uuid.UUID

class OrganizeResponse(BaseModel):
    status: str
    updated: List[MemoletResponse]
