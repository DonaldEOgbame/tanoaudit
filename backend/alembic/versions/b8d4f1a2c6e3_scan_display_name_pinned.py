"""scan display_name + pinned (rename and pin from the sidebar)

Adds two user-editable metadata columns to scans: a display_name override for
the sidebar/report label and a pinned flag that floats a scan to the top of
lists. Idempotent so a dev DB that already has them via create_all() is fine.

Revision ID: b8d4f1a2c6e3
Revises: a7c3e5d9f1b2
Create Date: 2026-06-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8d4f1a2c6e3'
down_revision: Union[str, Sequence[str], None] = 'a7c3e5d9f1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(bind) -> set[str]:
    return {c['name'] for c in sa.inspect(bind).get_columns('scans')}


def upgrade() -> None:
    bind = op.get_bind()
    cols = _cols(bind)
    if 'display_name' not in cols:
        op.add_column('scans', sa.Column('display_name', sa.String(length=200), nullable=True))
    if 'pinned' not in cols:
        op.add_column(
            'scans',
            sa.Column('pinned', sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    cols = _cols(bind)
    if 'pinned' in cols:
        op.drop_column('scans', 'pinned')
    if 'display_name' in cols:
        op.drop_column('scans', 'display_name')
