"""attack_paths table (detected vulnerability-combination chains)

Stores the output of the post-scan correlation pass: each row is an attack chain
built from several findings (referenced by their public ids). Idempotent so a dev
DB that already has the table via create_all() is fine.

Revision ID: c1e7a9b3f5d8
Revises: b8d4f1a2c6e3
Create Date: 2026-06-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1e7a9b3f5d8'
down_revision: Union[str, Sequence[str], None] = 'b8d4f1a2c6e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if 'attack_paths' in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        'attack_paths',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scan_id', sa.String(length=36), nullable=False),
        sa.Column('public_id', sa.String(length=16), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('severity', sa.String(length=16), nullable=False, server_default='high'),
        sa.Column('source', sa.String(length=16), nullable=False, server_default='novel'),
        sa.Column('catalog_key', sa.String(length=200), nullable=True),
        sa.Column('finding_public_ids', sa.JSON(), nullable=True),
        sa.Column('steps', sa.JSON(), nullable=True),
        sa.Column('impact', sa.Text(), nullable=True),
        sa.Column('real_world', sa.Text(), nullable=True),
        sa.Column('remediation', sa.Text(), nullable=True),
        sa.Column('cwe_id', sa.String(length=32), nullable=True),
        sa.Column('learn_slug', sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(['scan_id'], ['scans.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_attack_paths_scan_id', 'attack_paths', ['scan_id'])
    op.create_index('ix_attack_paths_public_id', 'attack_paths', ['public_id'])
    op.create_index('ix_attack_paths_severity', 'attack_paths', ['severity'])


def downgrade() -> None:
    bind = op.get_bind()
    if 'attack_paths' in sa.inspect(bind).get_table_names():
        op.drop_table('attack_paths')
