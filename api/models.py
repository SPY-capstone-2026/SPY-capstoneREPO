from typing import Optional, Dict, Any
from sqlalchemy import Column, JSON, UniqueConstraint
from sqlmodel import Field, SQLModel, create_engine
from datetime import date, time, datetime
from dotenv import load_dotenv
import os
import uuid


# ----------------------------------------
# 1. Users 테이블 (사용자 인증 및 프로필)
# ----------------------------------------
class User(SQLModel, table=True):
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    email: str
    password_hash: str
    income_type: Optional[str] = None
    payday: Optional[int] = None
    spend_profile: Optional[str] = None
    valid_data_start_date: Optional[date] = None
    total_xp: int = Field(default=0)
    current_level: int = Field(default=1)
    current_points: int = Field(default=0)  # 👈 추가된 필드
    # 소셜: 친구 검색·공개 프로필에 쓰는 표시 이름. 기존 유저는 NULL(설정 전엔 검색 안 됨)
    nickname: Optional[str] = Field(default=None, unique=True, index=True)
    created_at: datetime = Field(default_factory=datetime.now)


# ----------------------------------------
# 2. User_Category_Settings 테이블 (카테고리별 예산)
# ----------------------------------------
class UserCategorySetting(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.user_id")
    category_name: str
    budget_limit: int
    is_daily_challenge: bool = Field(default=False)
    alert_threshold: int = Field(default=80)


# ----------------------------------------
# 3. Transactions 테이블 (결제 내역)
# ----------------------------------------
class Transaction(SQLModel, table=True):
    # 같은 은행 파일을 두 번 올려도 같은 거래가 두 번 들어가지 않게 (import_key 가 NULL 인 직접 입력/시드는 해당 없음)
    __table_args__ = (UniqueConstraint("user_id", "import_key", name="uq_transaction_user_import_key"),)

    tx_id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.user_id")
    tx_date: date
    tx_time: time
    amount: int
    merchant_name: str
    mydata_category: str
    final_category: str
    is_user_corrected: bool = Field(default=False)
    memo: Optional[str] = Field(default=None, max_length=200)
    # 은행 파일에서 가져온 거래의 고유 키 (토스: 거래 일시+적요+금액+거래 후 잔액의 해시). 직접 입력/시드는 NULL
    import_key: Optional[str] = Field(default=None, index=True)


# ----------------------------------------
# 거래처 → 카테고리 규칙 (사용자가 고른/고친 카테고리를 기억해 다음 추천에 재사용)
# merchant_key = 정규화한 거래처명(소문자, 공백 제거). 유저·거래처당 1행.
# ----------------------------------------
class MerchantCategoryRule(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "merchant_key", name="uq_merchant_rule_user_key"),)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.user_id", index=True)
    merchant_key: str
    category_name: str
    updated_at: datetime = Field(default_factory=datetime.now)


# ----------------------------------------
# 4. AI_Daily_Features 테이블 (AI 예측 결과물)
# ----------------------------------------
class AIDailyFeature(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    target_date: date
    user_id: str = Field(foreign_key="user.user_id")
    category_name: str
    daily_category_spend: int
    category_budget_pressure: float


# ----------------------------------------
# 5. Daily_Challenges 테이블 (코칭 및 게이미피케이션)
# ----------------------------------------
class DailyChallenge(SQLModel, table=True):
    challenge_id: Optional[int] = Field(default=None, primary_key=True)

    user_id: str = Field(foreign_key="user.user_id")
    category_name: str
    challenge_date: date
    challenge_type: str
    challenge_text: str
    difficulty: str
    status: str = Field(default="PENDING")
    xp_reward: int

    ai_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    reward_snapshot: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column(JSON)
    )

    completed_at: Optional[datetime] = Field(default=None)
    verification_result: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))


# ----------------------------------------
# 6. Category 테이블 (카테고리 마스터)
# ----------------------------------------
class Category(SQLModel, table=True):
    category_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), primary_key=True
    )
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    parent_category: Optional[str] = None
    is_default: bool = Field(default=True)


# ----------------------------------------
# 7. Point_Transactions 테이블 (포인트 적립/사용 로그)
# ----------------------------------------
class PointTransaction(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.user_id", index=True)
    amount: int
    reason: str
    reference_id: Optional[str] = None
    balance_after: int
    created_at: datetime = Field(default_factory=datetime.now, index=True)


# ----------------------------------------
# 8. Shop_Items 테이블 (상점 아이템 마스터)
# ----------------------------------------
class ShopItem(SQLModel, table=True):
    item_id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    description: Optional[str] = None
    category: str
    price: Optional[int] = None
    image_url: Optional[str] = None
    is_purchasable: bool = Field(default=True)
    is_repeatable: bool = Field(default=False)
    rarity: str = Field(default="COMMON")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.now)
    unlock_level: Optional[int] = Field(default=None, index=True)


# ----------------------------------------
# 9. User_Inventory 테이블 (유저가 보유한 아이템)
# ----------------------------------------
class UserInventory(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.user_id", index=True)
    item_id: str = Field(foreign_key="shopitem.item_id", index=True)
    acquired_type: str
    is_equipped: bool = Field(default=False)
    acquired_at: datetime = Field(default_factory=datetime.now)


# ----------------------------------------
# 데이터베이스 연결 엔진 설정
# ----------------------------------------
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./moni.db")

engine = create_engine(
    DATABASE_URL,
    echo=True,
    connect_args=(
        {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    ),
)


class GeneratedReport(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.user_id", index=True)
    report_type: str  # "WEEKLY" | "MONTHLY"
    period_start: date = Field(index=True)
    period_end: date = Field(index=True)
    report_data: Dict[str, Any] = Field(sa_column=Column(JSON))  # 집계 결과 통째로
    created_at: datetime = Field(default_factory=datetime.now)


class BudgetChangeLog(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.user_id", index=True)
    category_name: str
    old_limit: int
    new_limit: int
    changed_at: datetime = Field(default_factory=datetime.now, index=True)


# ----------------------------------------
# 친구 관계 (요청 1건 = 행 1개, 수락되면 status 만 ACCEPTED 로 바뀐다)
# 거절/취소/친구 삭제는 행을 지운다.
# pair_key = 두 user_id 를 정렬해 '|'로 이은 값. 방향과 무관하게 두 사람 사이에 행이 하나만
# 존재하도록 DB가 보장한다 (A→B, B→A 동시 요청 경쟁도 여기서 막힘).
# ----------------------------------------
class Friendship(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("pair_key", name="uq_friendship_pair_key"),)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    requester_id: str = Field(foreign_key="user.user_id", index=True)
    addressee_id: str = Field(foreign_key="user.user_id", index=True)
    pair_key: str
    status: str = Field(default="PENDING")  # PENDING | ACCEPTED
    created_at: datetime = Field(default_factory=datetime.now)
    responded_at: Optional[datetime] = None


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
