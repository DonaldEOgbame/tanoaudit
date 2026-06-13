"""scan unparseable-segment counter

Adds scans.segments_unparsed — the number of segments whose model output never
parsed (even after the repair retry), so their findings were lost. Surfaced as a
recall-miss counter instead of failing silently.

Revision ID: d3f9a2c5e1b7
Revises: c2e8a1b4d7f0
Create Date: 2026-06-13 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3f9a2c5e1b7'
down_revision: Union[str, Sequence[str], None] = 'c2e8a1b4d7f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'scans',
        sa.Column('segments_unparsed', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('scans', 'segments_unparsed')
