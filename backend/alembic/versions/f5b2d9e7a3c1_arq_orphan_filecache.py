"""scan retry_count + file_cache_path (arq queue + orphan recovery + file cache)

- scans.retry_count: times a scan has been (re)dispatched; orphan recovery
  re-enqueues a stuck scan until this hits the cap, then marks it failed.
- scans.file_cache_path: on-disk location of the scan's source files (set at
  ingestion) so fix/implementation generation has full-file context for ZIP/URL
  scans, not just GitHub.

Revision ID: f5b2d9e7a3c1
Revises: e4a1b8c6f2d9
Create Date: 2026-06-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5b2d9e7a3c1'
down_revision: Union[str, Sequence[str], None] = 'e4a1b8c6f2d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'scans',
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
    )
    op.add_column('scans', sa.Column('file_cache_path', sa.String(length=600), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('scans', 'file_cache_path')
    op.drop_column('scans', 'retry_count')
