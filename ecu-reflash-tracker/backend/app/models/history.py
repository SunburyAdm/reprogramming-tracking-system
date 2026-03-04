import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from datetime import datetime
from sqlalchemy.orm import relationship

from app.core.database import Base


class ECUHistory(Base):
    __tablename__ = "history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    box_id = Column(String(36), ForeignKey("boxes.id", ondelete="CASCADE"), nullable=True, index=True)
    ecu_context_id = Column(String(36), ForeignKey("session_box_ecus.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    data = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    user = relationship("User", foreign_keys=[user_id])
