import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum as SAEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class SessionBoxECU(Base):
    """Bridge table: one ECU in the context of one box in one session."""
    __tablename__ = "session_box_ecus"
    __table_args__ = (
        UniqueConstraint("session_id", "ecu_code", name="uq_session_ecu_code"),
        UniqueConstraint("session_id", "box_id", "ecu_code", name="uq_session_box_ecu"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    box_id = Column(UUID(as_uuid=True), ForeignKey("boxes.id", ondelete="CASCADE"), nullable=False)
    ecu_code = Column(String(255), nullable=False)
    status = Column(
        SAEnum("learned", "flashing", "success", "failed", "rework_pending", name="ecu_context_status"),
        default="learned",
        nullable=False,
    )
    attempts = Column(Integer, default=0)
    last_station_id = Column(UUID(as_uuid=True), ForeignKey("stations.id"), nullable=True)
    last_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    current_attempt_started_at = Column(DateTime, nullable=True)
    last_attempt_duration_seconds = Column(Float, nullable=True)
    total_time_seconds = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = Column(Integer, default=1)

    session = relationship("Session")
    box = relationship("Box", back_populates="ecu_contexts")
    last_station = relationship("Station", foreign_keys=[last_station_id])
    last_user = relationship("User", foreign_keys=[last_user_id])
    flash_attempts = relationship("FlashAttempt", back_populates="ecu_context", cascade="all, delete-orphan")
    uploads = relationship("Upload", back_populates="ecu_context", cascade="all, delete-orphan")
