"""add agent_configs table

Revision ID: b91259669d4f
Revises: 090bf6ad692c
Create Date: 2026-03-02 09:51:13.004653

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b91259669d4f'
down_revision: Union[str, Sequence[str], None] = '090bf6ad692c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_configs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "file_name", name="uq_agent_configs_tenant_file"),
    )


def downgrade() -> None:
    op.drop_table("agent_configs")
