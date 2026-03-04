import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base


class Box(Base):
    __tablename__ = "boxes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    box_serial = Column(String(255), nullable=False)
    expected_ecu_count = Column(Integer, nullable=True)
    learned_count = Column(Integer, default=0)
    inventory_frozen = Column(Boolean, default=False)
    status = Column(
        SAEnum("pending", "learning", "in_progress", "blocked", "completed", name="box_status"),
        default="pending",
        nullable=False,
    )
    assigned_station_id = Column(UUID(as_uuid=True), ForeignKey("stations.id"), nullable=True)
    frozen_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("Session", back_populates="boxes")
    assigned_station = relationship("Station", back_populates="boxes")
    ecu_contexts = relationship("SessionBoxECU", back_populates="box", cascade="all, delete-orphan")
