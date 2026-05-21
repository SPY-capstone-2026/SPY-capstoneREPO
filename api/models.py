from typing import Optional, Dict, Any
from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel, create_engine
from typing import Optional
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
    # UUID 대신 DB AUTO_INCREMENT (자동 증가 정수) 적용!
    challenge_id: Optional[int] = Field(default=None, primary_key=True) 
    
    user_id: str = Field(foreign_key="user.user_id")
    category_name: str
    challenge_date: date
    challenge_type: str
    challenge_text: str
    difficulty: str
    status: str = Field(default="PENDING")
    xp_reward: int
    
    # 💡 [핵심] AI 예측 메타데이터를 통째로 담을 JSON 컬럼 추가!
    ai_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

# ----------------------------------------
# 데이터베이스 연결 엔진 설정 (SQLite 사용)
# ----------------------------------------
sqlite_file_name = "moni.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)