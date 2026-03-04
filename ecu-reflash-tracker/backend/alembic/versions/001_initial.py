"""Initial schema with users, ecus, uploads, history

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('role', sa.Enum('admin', 'tech', 'viewer', name='userrole'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create sessions table
    op.create_table(
        'sessions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('target_sw_version', sa.String(100), nullable=False),
        sa.Column('status', sa.Enum('draft', 'ready', 'active', 'completed', 'archived', name='session_status'), nullable=False),
        sa.Column('created_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create boxes table
    op.create_table(
        'boxes',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('session_id', sa.String(36), nullable=False),
        sa.Column('box_serial', sa.String(255), nullable=False),
        sa.Column('expected_ecu_count', sa.Integer(), nullable=True),
        sa.Column('learned_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('inventory_frozen', sa.Boolean(), nullable=True, server_default='0'),
        sa.Column('status', sa.Enum('pending', 'learning', 'in_progress', 'blocked', 'completed', name='box_status'), nullable=False),
        sa.Column('assigned_station_id', sa.String(36), nullable=True),
        sa.Column('frozen_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id']),
        sa.ForeignKeyConstraint(['assigned_station_id'], ['stations.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create stations table
    op.create_table(
        'stations',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('session_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create station_members table
    op.create_table(
        'station_members',
        sa.Column('station_id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.ForeignKeyConstraint(['station_id'], ['stations.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('station_id', 'user_id')
    )

    # Create station_setups table
    op.create_table(
        'station_setups',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('station_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('attributes', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['station_id'], ['stations.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create session_box_ecus table
    op.create_table(
        'session_box_ecus',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('session_id', sa.String(36), nullable=False),
        sa.Column('box_id', sa.String(36), nullable=False),
        sa.Column('ecu_code', sa.String(255), nullable=False),
        sa.Column('status', sa.Enum('learned', 'flashing', 'success', 'failed', 'rework_pending', 'scratch', name='ecu_context_status'), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('last_station_id', sa.String(36), nullable=True),
        sa.Column('last_user_id', sa.String(36), nullable=True),
        sa.Column('current_attempt_started_at', sa.DateTime(), nullable=True),
        sa.Column('last_attempt_duration_seconds', sa.Float(), nullable=True),
        sa.Column('total_time_seconds', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id']),
        sa.ForeignKeyConstraint(['box_id'], ['boxes.id']),
        sa.ForeignKeyConstraint(['last_station_id'], ['stations.id']),
        sa.ForeignKeyConstraint(['last_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', 'ecu_code', name='uq_session_ecu_code'),
        sa.UniqueConstraint('session_id', 'box_id', 'ecu_code', name='uq_session_box_ecu')
    )

    # Create flash_attempts table
    op.create_table(
        'flash_attempts',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('session_id', sa.String(36), nullable=False),
        sa.Column('box_id', sa.String(36), nullable=False),
        sa.Column('ecu_context_id', sa.String(36), nullable=False),
        sa.Column('attempt_no', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('result', sa.Enum('success', 'failed', 'in_progress', name='flash_result'), nullable=False),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('user_id', sa.String(36), nullable=True),
        sa.Column('station_id', sa.String(36), nullable=True),
        sa.Column('notes', sa.String(1000), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id']),
        sa.ForeignKeyConstraint(['box_id'], ['boxes.id']),
        sa.ForeignKeyConstraint(['ecu_context_id'], ['session_box_ecus.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['station_id'], ['stations.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create ecus table
    op.create_table(
        'ecus',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('ecu_code', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ecu_code')
    )
    op.create_index(op.f('ix_ecus_ecu_code'), 'ecus', ['ecu_code'], unique=True)

    # Create uploads table
    op.create_table(
        'uploads',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('ecu_context_id', sa.String(36), nullable=False),
        sa.Column('uploader_id', sa.String(36), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('s3_key', sa.String(1000), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=True, server_default='0'),
        sa.Column('checksum_sha256', sa.String(64), nullable=True),
        sa.Column('kind', sa.String(50), nullable=False, server_default='log'),
        sa.Column('notes', sa.String(1000), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['ecu_context_id'], ['session_box_ecus.id']),
        sa.ForeignKeyConstraint(['uploader_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_uploads_ecu_context_id'), 'uploads', ['ecu_context_id'])

    # Create history table
    op.create_table(
        'history',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('session_id', sa.String(36), nullable=True),
        sa.Column('box_id', sa.String(36), nullable=True),
        sa.Column('ecu_context_id', sa.String(36), nullable=True),
        sa.Column('user_id', sa.String(36), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id']),
        sa.ForeignKeyConstraint(['box_id'], ['boxes.id']),
        sa.ForeignKeyConstraint(['ecu_context_id'], ['session_box_ecus.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ecu_history_ecu_id'), 'history', ['ecu_context_id'])
    op.create_index(op.f('ix_ecu_history_created_at'), 'history', ['created_at'])


def downgrade() -> None:
    op.drop_table('flash_attempts')
    op.drop_table('session_box_ecus')
    op.drop_table('station_setups')
    op.drop_table('station_members')
    op.drop_table('stations')
    op.drop_table('boxes')
    op.drop_table('sessions')
    op.drop_index(op.f('ix_ecu_history_created_at'), table_name='history')
    op.drop_index(op.f('ix_ecu_history_ecu_id'), table_name='history')
    op.drop_table('history')
    
    op.drop_index(op.f('ix_uploads_ecu_context_id'), table_name='uploads')
    op.drop_table('uploads')
    
    op.drop_index(op.f('ix_ecus_ecu_code'), table_name='ecus')
    op.drop_table('ecus')
    
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
