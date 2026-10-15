"""add social: user.nickname, friendship table

Revision ID: a1f3c9d2e7b4
Revises: ef0e49b6d593
Create Date: 2026-10-15 16:00:00

※ main.py 의 create_db_and_tables()(create_all)가 서버 시작 때 새 '테이블'은 만들지만
  기존 테이블에 '컬럼'은 추가하지 않는다. 그래서 이미 friendship 테이블이 생긴 DB에서도
  이 마이그레이션이 실패하지 않도록 존재 여부를 확인하고 만든다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f3c9d2e7b4'
down_revision: Union[str, Sequence[str], None] = 'ef0e49b6d593'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector():
    return sa.inspect(op.get_bind())


def upgrade() -> None:
    insp = _inspector()

    # 1) user.nickname (NULL 허용, 유니크 인덱스. 기존 유저는 NULL 이라 충돌 없음)
    user_cols = {c["name"] for c in insp.get_columns("user")}
    if "nickname" not in user_cols:
        op.add_column("user", sa.Column("nickname", sa.String(), nullable=True))
    user_idx = {i["name"] for i in insp.get_indexes("user")}
    if "ix_user_nickname" not in user_idx:
        op.create_index("ix_user_nickname", "user", ["nickname"], unique=True)

    # 2) friendship
    if not insp.has_table("friendship"):
        op.create_table(
            "friendship",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("requester_id", sa.String(), nullable=False),
            sa.Column("addressee_id", sa.String(), nullable=False),
            sa.Column("pair_key", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("responded_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["addressee_id"], ["user.user_id"]),
            sa.ForeignKeyConstraint(["requester_id"], ["user.user_id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("pair_key", name="uq_friendship_pair_key"),
        )
    fr_idx = {i["name"] for i in _inspector().get_indexes("friendship")}
    if "ix_friendship_requester_id" not in fr_idx:
        op.create_index("ix_friendship_requester_id", "friendship", ["requester_id"], unique=False)
    if "ix_friendship_addressee_id" not in fr_idx:
        op.create_index("ix_friendship_addressee_id", "friendship", ["addressee_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_friendship_addressee_id", table_name="friendship")
    op.drop_index("ix_friendship_requester_id", table_name="friendship")
    op.drop_table("friendship")
    op.drop_index("ix_user_nickname", table_name="user")
    op.drop_column("user", "nickname")
