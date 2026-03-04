import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class StationSetup(Base):
    __tablename__ = "station_setups"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)         # e.g. "Bay A", "Bench 1"
    attributes = Column(Text, nullable=False, default="{}")  # free-form {label: value} pairs as JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    station = relationship("Station", back_populates="setups")
