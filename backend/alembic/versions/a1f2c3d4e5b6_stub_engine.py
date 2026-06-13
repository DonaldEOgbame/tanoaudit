"""stub & placeholder detection engine

Adds the stub finding fields, scan completeness_score, and the
intentional_stub_suppressions table.

Revision ID: a1f2c3d4e5b6
Revises: 45768b34ff96
Create Date: 2026-06-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f2c3d4e5b6'
down_revision: Union[str, Sequence[str], None] = '45768b34ff96'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('findings', sa.Column('stub_category', sa.String(length=20), nullable=True))
    op.add_column('findings', sa.Column('completion_suggestion', sa.Text(), nullable=True))
    op.add_column('findings', sa.Column('risk_if_shipped', sa.Text(), nullable=True))
    op.add_column('scans', sa.Column('completeness_score', sa.Integer(), nullable=True))

    op.create_table(
        'intentional_stub_suppressions',
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('repo', sa.String(length=300), nullable=False),
        sa.Column('file_path', sa.String(length=600), nullable=False),
        sa.Column('stub_category', sa.String(length=20), nullable=True),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('origin_finding_id', sa.String(length=36), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_intentional_stub_suppressions_user_id'), 'intentional_stub_suppressions', ['user_id'], unique=False)
    op.create_index(op.f('ix_intentional_stub_suppressions_repo'), 'intentional_stub_suppressions', ['repo'], unique=False)
    op.create_index(op.f('ix_intentional_stub_suppressions_content_hash'), 'intentional_stub_suppressions', ['content_hash'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_intentional_stub_suppressions_content_hash'), table_name='intentional_stub_suppressions')
    op.drop_index(op.f('ix_intentional_stub_suppressions_repo'), table_name='intentional_stub_suppressions')
    op.drop_index(op.f('ix_intentional_stub_suppressions_user_id'), table_name='intentional_stub_suppressions')
    op.drop_table('intentional_stub_suppressions')
    op.drop_column('scans', 'completeness_score')
    op.drop_column('findings', 'risk_if_shipped')
    op.drop_column('findings', 'completion_suggestion')
    op.drop_column('findings', 'stub_category')
