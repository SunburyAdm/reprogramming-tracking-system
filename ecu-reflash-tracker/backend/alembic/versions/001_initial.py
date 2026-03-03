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
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('role', sa.Enum('admin', 'tech', 'viewer', name='userrole'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create ecus table
    op.create_table(
        'ecus',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('barcode', sa.String(), nullable=False),
        sa.Column('serial', sa.String(), nullable=True),
        sa.Column('hw_part_no', sa.String(), nullable=True),
        sa.Column('hw_version', sa.String(), nullable=True),
        sa.Column('sw_version', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('assignee_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('lock_owner_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('lock_until', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id']),
        sa.ForeignKeyConstraint(['lock_owner_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('barcode')
    )
    op.create_index(op.f('ix_ecus_barcode'), 'ecus', ['barcode'], unique=True)
    op.create_index(op.f('ix_ecus_status'), 'ecus', ['status'])
    op.create_index(op.f('ix_ecus_assignee_id'), 'ecus', ['assignee_id'])
    op.create_index(op.f('ix_ecus_last_seen'), 'ecus', ['last_seen'])
    op.create_index('ix_ecus_status_updated_at', 'ecus', ['status', 'updated_at'])
    op.create_index('ix_ecus_assignee_status', 'ecus', ['assignee_id', 'status'])

    # Create uploads table
    op.create_table(
        'uploads',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ecu_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('uploader_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('s3_key', sa.String(), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('checksum_sha256', sa.String(), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['ecu_id'], ['ecus.id']),
        sa.ForeignKeyConstraint(['uploader_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_uploads_ecu_id'), 'uploads', ['ecu_id'])

    # Create ecu_history table
    op.create_table(
        'ecu_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ecu_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['ecu_id'], ['ecus.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ecu_history_ecu_id'), 'ecu_history', ['ecu_id'])
    op.create_index(op.f('ix_ecu_history_created_at'), 'ecu_history', ['created_at'])


def downgrade() -> None:
    op.drop_index(op.f('ix_ecu_history_created_at'), table_name='ecu_history')
    op.drop_index(op.f('ix_ecu_history_ecu_id'), table_name='ecu_history')
    op.drop_table('ecu_history')
    
    op.drop_index(op.f('ix_uploads_ecu_id'), table_name='uploads')
    op.drop_table('uploads')
    
    op.drop_index('ix_ecus_assignee_status', table_name='ecus')
    op.drop_index('ix_ecus_status_updated_at', table_name='ecus')
    op.drop_index(op.f('ix_ecus_last_seen'), table_name='ecus')
    op.drop_index(op.f('ix_ecus_assignee_id'), table_name='ecus')
    op.drop_index(op.f('ix_ecus_status'), table_name='ecus')
    op.drop_index(op.f('ix_ecus_barcode'), table_name='ecus')
    op.drop_table('ecus')
    
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
