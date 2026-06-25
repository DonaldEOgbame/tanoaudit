"""attack_paths.tier (confirmed vs potential)

Adds a confidence tier to detected attack chains so the UI/chat can label a
fully-matched chain as 'confirmed' vs a partial 'potential' path. Idempotent.

Revision ID: d2f8b4a6e1c9
Revises: c1e7a9b3f5d8
Create Date: 2026-06-25 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2f8b4a6e1c9'
down_revision: Union[str, Sequence[str], None] = 'c1e7a9b3f5d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(bind) -> set[str]:
    return {c['name'] for c in sa.inspect(bind).get_columns('attack_paths')}


def upgrade() -> None:
    bind = op.get_bind()
    if 'attack_paths' not in sa.inspect(bind).get_table_names():
        return
    if 'tier' not in _cols(bind):
        op.add_column('attack_paths',
                      sa.Column('tier', sa.String(length=16), nullable=False,
                                server_default='confirmed'))


def downgrade() -> None:
    bind = op.get_bind()
    if 'attack_paths' in sa.inspect(bind).get_table_names() and 'tier' in _cols(bind):
        op.drop_column('attack_paths', 'tier')
