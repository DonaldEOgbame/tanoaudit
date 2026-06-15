"""scan_dependencies table (dependency scan: declared deps + OSV advisories)

One row per declared dependency found in a scan's manifests, enriched with the
latest known version and any matching security advisories. Previously the table
only existed via create_all() in init_db, so a migration-only production DB
(alembic upgrade head) lacked it and the guarded dependency scan failed silently.

Revision ID: a7c3e5d9f1b2
Revises: f5b2d9e7a3c1
Create Date: 2026-06-14 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c3e5d9f1b2'
down_revision: Union[str, Sequence[str], None] = 'f5b2d9e7a3c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Idempotent: in dev the table may already exist via create_all() in init_db,
    so skip creation if it's present. On a migration-only production DB it won't
    exist and gets created here.
    """
    bind = op.get_bind()
    if sa.inspect(bind).has_table('scan_dependencies'):
        return
    op.create_table(
        'scan_dependencies',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scan_id', sa.String(length=36), nullable=False),
        sa.Column('manifest', sa.String(length=120), nullable=False),
        sa.Column('ecosystem', sa.String(length=32), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('version', sa.String(length=80), nullable=True),
        sa.Column('dev', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('latest_version', sa.String(length=80), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='clean'),
        sa.Column('advisory_id', sa.String(length=64), nullable=True),
        sa.Column('advisory_summary', sa.Text(), nullable=True),
        sa.Column('advisory_severity', sa.String(length=16), nullable=True),
        sa.Column('advisories', sa.JSON(), nullable=True),
        sa.Column('suggested', sa.String(length=80), nullable=True),
        sa.Column('note', sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(['scan_id'], ['scans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_scan_dependencies_scan_id', 'scan_dependencies', ['scan_id'])
    op.create_index('ix_scan_dependencies_name', 'scan_dependencies', ['name'])
    op.create_index('ix_scan_dependencies_status', 'scan_dependencies', ['status'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_scan_dependencies_status', table_name='scan_dependencies')
    op.drop_index('ix_scan_dependencies_name', table_name='scan_dependencies')
    op.drop_index('ix_scan_dependencies_scan_id', table_name='scan_dependencies')
    op.drop_table('scan_dependencies')
