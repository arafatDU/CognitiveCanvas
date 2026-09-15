import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Float, DateTime, ForeignKey, Table, Column, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector

from app.models.base import Base

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_user_id: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True, nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True, nullable=True)
    auth_provider: Mapped[Optional[str]] = mapped_column(String, default="clerk", nullable=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    conversations: Mapped[List["Conversation"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    memolets: Mapped[List["Memolet"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class Conversation(Base):
    __tablename__ = "conversations"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    user: Mapped["User"] = relationship(back_populates="conversations")
    memolets: Mapped[List["Memolet"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")
    messages: Mapped[List["ChatMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(String) # 'user' or 'ai'
    content: Mapped[str] = mapped_column(String)
    citations: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")

class Memolet(Base):
    __tablename__ = "memolets"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    conversation_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True)
    
    text: Mapped[str] = mapped_column(String)
    weight: Mapped[Optional[float]] = mapped_column(Float, default=1.0)
    keywords: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True) # store as list of strings
    
    # pgvector embedding — all-MiniLM-L6-v2 outputs 384 dims
    embedding: Mapped[Optional[list[float]]] = mapped_column(Vector(384), nullable=True)
    
    # Sandbox coordinates
    pos_x: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pos_y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    width: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    height: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_accessed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Temporal Auditing & Staleness Columns
    is_time_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    deprecation_risk: Mapped[Optional[str]] = mapped_column(String, default="none", nullable=True)  # 'none', 'low', 'medium', 'high'
    temporal_anchor: Mapped[Optional[str]] = mapped_column(String, nullable=True)    # e.g., 'Next.js 13 Pages Router API'
    validity_horizon_days: Mapped[Optional[int]] = mapped_column(Integer, default=365, nullable=True)
    is_deprecated: Mapped[bool] = mapped_column(Boolean, default=False)
    deprecation_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    suggested_update: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    audited_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    user: Mapped[Optional["User"]] = relationship(back_populates="memolets")
    conversation: Mapped[Optional["Conversation"]] = relationship(back_populates="memolets")
