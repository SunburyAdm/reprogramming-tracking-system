import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

station_members = Table(
    "station_members",
    Base.metadata,
    Column("station_id", UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Station(Base):
    __tablename__ = "stations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="stations")
    members = relationship("User", secondary=station_members)
    boxes = relationship("Box", back_populates="assigned_station")
    setups = relationship("StationSetup", back_populates="station", cascade="all, delete-orphan", order_by="StationSetup.created_at")
