"""Seed initial users and create a demo session."""
import asyncio
import sys
from uuid import uuid4
from sqlalchemy import select

from app.core.database import AsyncSessionLocal, init_db
from app.models.user import User, UserRole
from app.models.session import Session
from app.models.station import Station, station_members
from app.core.security import get_password_hash
from app.services.s3 import s3_service


async def seed_users(db):
    result = await db.execute(select(User))
    if result.scalars().first():
        print("  Users already exist")
        return {}

    admin = User(
        email="admin@local",
        password_hash=get_password_hash("admin123"),
        name="Admin User",
        role=UserRole.ADMIN,
    )
    tech = User(
        email="tech@local",
        password_hash=get_password_hash("tech123"),
        name="Tech User",
        role=UserRole.TECH,
    )
    tech2 = User(
        email="tech2@local",
        password_hash=get_password_hash("tech123"),
        name="Tech User 2",
        role=UserRole.TECH,
    )
    db.add_all([admin, tech, tech2])
    await db.commit()
    await db.refresh(admin)
    await db.refresh(tech)
    await db.refresh(tech2)
    print("  admin@local / admin123")
    print("  tech@local  / tech123")
    print("  tech2@local / tech123")
    return {"admin": admin, "tech": tech, "tech2": tech2}


async def seed_demo_session(db, users):
    if not users:
        return
    result = await db.execute(select(Session))
    if result.scalars().first():
        print("  Demo session already exists")
        return

    session = Session(
        name="Demo Reflash Session 2026",
        target_sw_version="v2.5.1-PROD",
        status="active",
        created_by=users["admin"].id,
    )
    db.add(session)
    await db.flush()

    st1 = Station(session_id=session.id, name="Station A")
    st2 = Station(session_id=session.id, name="Station B")
    db.add_all([st1, st2])
    await db.flush()

    await db.execute(station_members.insert().values(station_id=st1.id, user_id=users["tech"].id))
    await db.execute(station_members.insert().values(station_id=st2.id, user_id=users["tech2"].id))

    await db.commit()
    print(f"  Session: {session.name}")
    print(f"  Stations: Station A (tech), Station B (tech2)")
    print(f"  Session ID: {session.id}")


async def main():
    print("Initializing database...")
    await init_db()
    print("Done\n")

    print("Seeding users...")
    async with AsyncSessionLocal() as db:
        users = await seed_users(db)

    print("Seeding demo session...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        all_users = {u.email.split("@")[0]: u for u in result.scalars().all()}
        await seed_demo_session(db, all_users)

    print("\nEnsuring MinIO bucket...")
    try:
        await s3_service.ensure_bucket_exists()
        print("  MinIO bucket OK")
    except Exception as e:
        print(f"  MinIO warning: {e}")

    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
