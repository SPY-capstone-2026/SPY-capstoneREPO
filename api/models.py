from typing import Optional, Dict, Any
from sqlalchemy import Column, JSON, UniqueConstraint
from sqlmodel import Field, SQLModel, create_engine
from datetime import date, time, datetime
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
    tx_id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.user_id")
    tx_date: date
    tx_time: time
    amount: int
    merchant_name: str
    mydata_category: str
    final_category: str
    is_user_corrected: bool = Field(default=False)


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
    reward_snapshot: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))


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
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./moni.db")

engine = create_engine(
    DATABASE_URL,
    echo=True,
    connect_args=(
        {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    ),
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
