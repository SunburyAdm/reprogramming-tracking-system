import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    target_sw_version = Column(String(100), nullable=False)
    status = Column(
        SAEnum("draft", "ready", "active", "completed", "archived", name="session_status"),
        default="draft",
        nullable=False,
    )
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    stations = relationship("Station", back_populates="session", cascade="all, delete-orphan")
    boxes = relationship("Box", back_populates="session", cascade="all, delete-orphan")
