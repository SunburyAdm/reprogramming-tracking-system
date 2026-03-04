import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base


class FlashAttempt(Base):
    __tablename__ = "flash_attempts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    box_id = Column(String(36), ForeignKey("boxes.id", ondelete="CASCADE"), nullable=False)
    ecu_context_id = Column(String(36), ForeignKey("session_box_ecus.id", ondelete="CASCADE"), nullable=False)
    attempt_no = Column(Integer, nullable=False)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    result = Column(
        SAEnum("success", "failed", "in_progress", name="flash_result"),
        default="in_progress",
        nullable=False,
    )
    duration_seconds = Column(Float, nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    station_id = Column(UUID(as_uuid=True), ForeignKey("stations.id"), nullable=True)
    notes = Column(String(1000), nullable=True)

    ecu_context = relationship("SessionBoxECU", back_populates="flash_attempts")
    user = relationship("User", foreign_keys=[user_id])
    station = relationship("Station", foreign_keys=[station_id])
