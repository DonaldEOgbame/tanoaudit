"""scan worker-claim column

Adds scans.worker_id so a worker can atomically claim a queued scan (status
'claimed') before running it, preventing two workers from grabbing the same
scan. Postgres uses SELECT ... FOR UPDATE SKIP LOCKED; the column records the
claimant for debugging / reclaiming orphaned scans.

Revision ID: e4a1b8c6f2d9
Revises: d3f9a2c5e1b7
Create Date: 2026-06-13 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4a1b8c6f2d9'
down_revision: Union[str, Sequence[str], None] = 'd3f9a2c5e1b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('scans', sa.Column('worker_id', sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('scans', 'worker_id')
