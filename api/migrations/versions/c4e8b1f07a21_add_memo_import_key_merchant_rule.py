"""add transaction.memo, transaction.import_key, merchantcategoryrule

Revision ID: c4e8b1f07a21
Revises: a1f3c9d2e7b4
Create Date: 2026-10-29 16:00:00

※ 컬럼은 모두 NULL 허용이라 기존 코드와 호환된다 → "마이그레이션 먼저, 배포 나중" 순서가 안전하다.
※ create_all 이 서버 시작 때 새 테이블을 먼저 만들었을 수 있으므로 존재 여부를 확인하고 만든다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4e8b1f07a21'
down_revision: Union[str, Sequence[str], None] = 'a1f3c9d2e7b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _insp():
    return sa.inspect(op.get_bind())


def upgrade() -> None:
    insp = _insp()

    # 1) transaction.memo / import_key
    cols = {c["name"] for c in insp.get_columns("transaction")}
    if "memo" not in cols:
        op.add_column("transaction", sa.Column("memo", sa.String(length=200), nullable=True))
    if "import_key" not in cols:
        op.add_column("transaction", sa.Column("import_key", sa.String(), nullable=True))
    idx = {i["name"] for i in insp.get_indexes("transaction")}
    if "ix_transaction_import_key" not in idx:
        op.create_index("ix_transaction_import_key", "transaction", ["import_key"], unique=False)
    uqs = {u["name"] for u in insp.get_unique_constraints("transaction")}
    if "uq_transaction_user_import_key" not in uqs:
        op.create_unique_constraint("uq_transaction_user_import_key", "transaction", ["user_id", "import_key"])

    # 2) merchantcategoryrule
    if not insp.has_table("merchantcategoryrule"):
        op.create_table(
            "merchantcategoryrule",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("merchant_key", sa.String(), nullable=False),
            sa.Column("category_name", sa.String(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["user.user_id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "merchant_key", name="uq_merchant_rule_user_key"),
        )
    rule_idx = {i["name"] for i in _insp().get_indexes("merchantcategoryrule")}
    if "ix_merchantcategoryrule_user_id" not in rule_idx:
        op.create_index("ix_merchantcategoryrule_user_id", "merchantcategoryrule", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_merchantcategoryrule_user_id", table_name="merchantcategoryrule")
    op.drop_table("merchantcategoryrule")
    op.drop_constraint("uq_transaction_user_import_key", "transaction", type_="unique")
    op.drop_index("ix_transaction_import_key", table_name="transaction")
    op.drop_column("transaction", "import_key")
    op.drop_column("transaction", "memo")
