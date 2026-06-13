"""normalized subcategory + preserved raw label

Adds findings.subcategory_raw to keep the model's original free-text label
while `subcategory` holds the canonical (normalized) taxonomy name used for
grouping/dedup across scans.

Revision ID: c2e8a1b4d7f0
Revises: a1f2c3d4e5b6
Create Date: 2026-06-12 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2e8a1b4d7f0'
down_revision: Union[str, Sequence[str], None] = 'a1f2c3d4e5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('findings', sa.Column('subcategory_raw', sa.String(length=120), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('findings', 'subcategory_raw')
