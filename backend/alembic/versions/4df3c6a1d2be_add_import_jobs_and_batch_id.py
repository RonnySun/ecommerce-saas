"""add import_jobs and order import batch id

Revision ID: 4df3c6a1d2be
Revises: b91259669d4f
Create Date: 2026-03-03 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4df3c6a1d2be"
down_revision: Union[str, Sequence[str], None] = "b91259669d4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("import_batch_id", sa.String(length=64), nullable=True))
    op.create_index("ix_orders_import_batch_id", "orders", ["import_batch_id"], unique=False)

    op.create_table(
        "import_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("batch_id", sa.String(length=64), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mapped_columns", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="running"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_import_jobs_tenant_created", "import_jobs", ["tenant_id", "created_at"], unique=False)
    op.create_index("ix_import_jobs_batch_id", "import_jobs", ["batch_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_import_jobs_batch_id", table_name="import_jobs")
    op.drop_index("ix_import_jobs_tenant_created", table_name="import_jobs")
    op.drop_table("import_jobs")

    op.drop_index("ix_orders_import_batch_id", table_name="orders")
    op.drop_column("orders", "import_batch_id")
