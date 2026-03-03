"""add scratch to ecu_context_status enum

Revision ID: 002
Revises: 001
Create Date: 2026-03-02
"""
from alembic import op
from sqlalchemy import text

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ALTER TYPE … ADD VALUE cannot run inside a transaction in PostgreSQL.
    # get_bind() gives us the raw connection so we can issue the statement
    # with AUTOCOMMIT isolation.
    conn = op.get_bind()
    conn.execute(text("ALTER TYPE ecu_context_status ADD VALUE IF NOT EXISTS 'scratch'"))


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; downgrade is intentionally a no-op.
    pass
