"""add import job chart snapshots

Revision ID: 8a1e6e7bd934
Revises: 4df3c6a1d2be
Create Date: 2026-03-03 22:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8a1e6e7bd934"
down_revision: Union[str, Sequence[str], None] = "4df3c6a1d2be"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("import_jobs", sa.Column("chart_summary", sa.JSON(), nullable=True))
    op.add_column("import_jobs", sa.Column("chart_trend", sa.JSON(), nullable=True))
    op.add_column("import_jobs", sa.Column("chart_stores", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("import_jobs", "chart_stores")
    op.drop_column("import_jobs", "chart_trend")
    op.drop_column("import_jobs", "chart_summary")
