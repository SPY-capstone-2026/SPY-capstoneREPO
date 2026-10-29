from pydantic import BaseModel
from datetime import date, datetime, time
from typing import List, Optional


class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    income_type: Optional[str] = None
    payday: Optional[int] = None
    spend_profile: Optional[str] = None
    nickname: Optional[str] = None


class ChallengeStatusUpdateRequest(BaseModel):
    status: str


class CategoryUpdateRequest(BaseModel):
    budget_limit: Optional[int] = None
    is_daily_challenge: Optional[bool] = None
    alert_threshold: Optional[int] = None


class SignupRequest(BaseModel):
    email: str
    password: str
    income_type: str = "STUDENT"
    payday: int = 25
    spend_profile: str = "IMPULSIVE"
    nickname: Optional[str] = None  # 선택. 비우면 나중에 PATCH /me 로 설정


class LoginRequest(BaseModel):
    email: str
    password: str


class TransactionCreateRequest(BaseModel):
    tx_date: date
    tx_time: Optional[time] = None
    amount: int
    merchant_name: str
    mydata_category: str = "직접 입력"
    final_category: Optional[str] = None  # 비우면 거래처명으로 자동 분류
    is_user_corrected: bool = True
    memo: Optional[str] = None


class TransactionUpdateRequest(BaseModel):
    tx_date: Optional[date] = None
    tx_time: Optional[time] = None
    amount: Optional[int] = None
    merchant_name: Optional[str] = None
    mydata_category: Optional[str] = None
    final_category: Optional[str] = None
    is_user_corrected: Optional[bool] = None
    memo: Optional[str] = None  # "" 를 보내면 메모 삭제


class CategorySuggestRequest(BaseModel):
    merchant_names: List[str]


class ImportRow(BaseModel):
    import_key: str
    occurred_at: datetime
    merchant_name: str
    amount: int
    final_category: Optional[str] = None  # 비어 있으면 400 '카테고리를 선택해 주세요'
    memo: Optional[str] = None
    tx_type: Optional[str] = None


class ImportConfirmRequest(BaseModel):
    source_format: str  # 미리보기 응답의 source_format 그대로 (TOSS | GENERIC)
    rows: List[ImportRow]
    cancel_tx_ids: List[str] = []


class InventoryEquipRequest(BaseModel):
    equip: bool


class FriendRequestCreateRequest(BaseModel):
    nickname: str
