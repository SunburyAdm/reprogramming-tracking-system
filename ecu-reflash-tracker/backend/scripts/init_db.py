#!/usr/bin/env python
"""Initialize database with tables and seed data"""

import asyncio
import sys
import os

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select


async def init_database():
    """Create all tables and seed data."""

    # Deferred imports so path is set first
    from app.core.config import settings
    from app.core.database import Base
    # Import ALL models to register them with Base.metadata
    from app.models import (  # noqa: F401
        User, ECU, Session, Station, Box,
        SessionBoxECU, FlashAttempt, Upload, History,
        station_members,
    )

    database_url = settings.DATABASE_URL
    engine = create_async_engine(database_url, echo=False)

    # ── Create tables ────────────────────────────────────────────────────────
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✓ Database tables created")

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # ── Seed users ───────────────────────────────────────────────────────────
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == "admin@local"))
        admin = result.scalars().first()

        if not admin:
            pw = lambda p: bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
            users = [
                User(email="admin@local", password_hash=pw("admin123"),  name="Admin User",   role="admin"),
                User(email="tech@local",  password_hash=pw("tech123"),   name="Tech User",    role="tech"),
                User(email="tech2@local", password_hash=pw("tech123"),   name="Tech User 2",  role="tech"),
            ]
            for u in users:
                db.add(u)
            await db.commit()
            print("✓ Users created: admin@local, tech@local, tech2@local")
        else:
            print("✓ Users already exist")

    # ── Seed demo session ────────────────────────────────────────────────────
    async with async_session() as db:
        sess_result = await db.execute(select(Session))
        if not sess_result.scalars().first():
            # Load users
            res = await db.execute(select(User))
            all_users = {u.email: u for u in res.scalars().all()}
            admin_user  = all_users.get("admin@local")
            tech_user   = all_users.get("tech@local")
            tech2_user  = all_users.get("tech2@local")

            if admin_user:
                demo = Session(
                    name="Demo Reflash Session 2026",
                    target_sw_version="v2.5.1-PROD",
                    status="active",
                    created_by=admin_user.id,
                )
                db.add(demo)
                await db.flush()

                st1 = Station(session_id=demo.id, name="Station A")
                st2 = Station(session_id=demo.id, name="Station B")
                db.add_all([st1, st2])
                await db.flush()

                if tech_user:
                    await db.execute(
                        station_members.insert().values(station_id=st1.id, user_id=tech_user.id)
                    )
                if tech2_user:
                    await db.execute(
                        station_members.insert().values(station_id=st2.id, user_id=tech2_user.id)
                    )

                await db.commit()
                print(f"✓ Demo session created: {demo.name} (id={demo.id})")
        else:
            print("✓ Demo session already exists")

    # ── MinIO bucket ─────────────────────────────────────────────────────────
    try:
        from minio import Minio
        client = Minio(
            settings.MINIO_URL.replace("http://", "").replace("https://", ""),
            access_key=settings.MINIO_ROOT_USER,
            secret_key=settings.MINIO_ROOT_PASSWORD,
            secure=False,
        )
        bucket_name = settings.S3_BUCKET
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
        print(f"✓ MinIO bucket '{bucket_name}' ready")
    except Exception as e:
        print(f"⚠ MinIO will retry at runtime: {e}")

    await engine.dispose()
    print("✓ Initialization complete")


if __name__ == "__main__":
    asyncio.run(init_database())
