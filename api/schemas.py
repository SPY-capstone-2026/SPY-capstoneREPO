from pydantic import BaseModel
from datetime import date, time
from typing import Optional


class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    income_type: Optional[str] = None
    payday: Optional[int] = None
    spend_profile: Optional[str] = None


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


class LoginRequest(BaseModel):
    email: str
    password: str


class TransactionCreateRequest(BaseModel):
    tx_date: date
    tx_time: Optional[time] = None
    amount: int
    merchant_name: str
    mydata_category: str = "직접 입력"
    final_category: str
    is_user_corrected: bool = True


class TransactionUpdateRequest(BaseModel):
    tx_date: Optional[date] = None
    tx_time: Optional[time] = None
    amount: Optional[int] = None
    merchant_name: Optional[str] = None
    mydata_category: Optional[str] = None
    final_category: Optional[str] = None
    is_user_corrected: Optional[bool] = None


class InventoryEquipRequest(BaseModel):
    equip: bool
