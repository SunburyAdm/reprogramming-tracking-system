import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.core.database import Base

station_members = Table(
    "station_members",
    Base.metadata,
    Column("station_id", String(36), ForeignKey("stations.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Station(Base):
    __tablename__ = "stations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="stations")
    members = relationship("User", secondary=station_members)
    boxes = relationship("Box", back_populates="assigned_station")
    setups = relationship("StationSetup", back_populates="station", cascade="all, delete-orphan", order_by="StationSetup.created_at")
