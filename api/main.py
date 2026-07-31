import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "ai"))

from fastapi import FastAPI, HTTPException, Depends
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from models import (
    create_db_and_tables,
    engine,
    User,
    DailyChallenge,
    Transaction,
    UserCategorySetting,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_id,
)
from pydantic import BaseModel
from datetime import date, datetime, time
import pandas as pd
from typing import Optional
from moni_engine.engine import get_today_challenges
from fastapi.middleware.cors import CORSMiddleware
from calendar import monthrange
from collections import defaultdict
import uuid


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="Moni API 서버", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "https://spy-capstone-repo.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ensure_default_category_settings(session: Session, user_id: str):
    existing = session.exec(
        select(UserCategorySetting).where(UserCategorySetting.user_id == user_id)
    ).all()

    if existing:
        return existing

    defaults = [
        {
            "category_name": "카페",
            "budget_limit": 30000,
            "is_daily_challenge": True,
            "alert_threshold": 80,
        },
        {
            "category_name": "식비",
            "budget_limit": 180000,
            "is_daily_challenge": True,
            "alert_threshold": 80,
        },
        {
            "category_name": "쇼핑",
            "budget_limit": 90000,
            "is_daily_challenge": True,
            "alert_threshold": 85,
        },
        {
            "category_name": "교통",
            "budget_limit": 60000,
            "is_daily_challenge": False,
            "alert_threshold": 90,
        },
    ]

    created = []

    for item in defaults:
        setting = UserCategorySetting(
            user_id=user_id,
            category_name=item["category_name"],
            budget_limit=item["budget_limit"],
            is_daily_challenge=item["is_daily_challenge"],
            alert_threshold=item["alert_threshold"],
        )
        session.add(setting)
        created.append(setting)

    session.commit()

    for setting in created:
        session.refresh(setting)

    return created


def calculate_level(total_xp: int, session: Session = None) -> int:
    # LevelDefinition 테이블이 생기면 여기서 DB 조회로 교체 가능
    # 지금은 임시 규칙 사용
    thresholds = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000]
    level = 1
    for i, xp in enumerate(thresholds):
        if total_xp >= xp:
            level = i + 1
    return level


def serialize_user_progress(user: User):
    return {
        "user_id": user.user_id,
        "total_xp": user.total_xp,
        "current_level": user.current_level,
    }


def serialize_user_profile(user: User):
    return {
        "user_id": user.user_id,
        "email": user.email,
        "income_type": user.income_type,
        "payday": user.payday,
        "spend_profile": user.spend_profile,
        "total_xp": user.total_xp,
        "current_level": user.current_level,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def serialize_challenge(challenge: DailyChallenge):
    return {
        "challenge_id": challenge.challenge_id,
        "user_id": challenge.user_id,
        "category_name": challenge.category_name,
        "challenge_date": challenge.challenge_date.isoformat(),
        "challenge_type": challenge.challenge_type,
        "challenge_text": challenge.challenge_text,
        "difficulty": challenge.difficulty,
        "status": challenge.status,
        "xp_reward": challenge.xp_reward,
        "ai_metadata": challenge.ai_metadata,
    }


def make_fallback_challenge(user_id: str, target_date: date):
    return {
        "user_id": user_id,
        "category_name": "카페",
        "challenge_date": target_date,
        "challenge_type": "제한형",
        "challenge_text": "오늘은 카페 지출을 한 번만 줄여보세요.",
        "difficulty": "Easy",
        "status": "PENDING",
        "xp_reward": 10,
        "ai_metadata": {
            "model_version": "fallback-v1",
            "generated_at": datetime.now().isoformat(),
            "budget_limit": 30000,
            "month_to_date_actual": 0,
            "predicted_remaining_spend": 0,
            "predicted_monthly_spend": 0,
            "budget_pressure": 1,
            "evaluated_categories": [
                {
                    "category_name": "카페",
                    "budget_pressure": 1,
                    "budget_limit": 30000,
                    "predicted_monthly_spend": 0,
                    "rank": 1,
                }
            ],
        },
    }


def serialize_category_setting(setting: UserCategorySetting):
    return {
        "id": setting.id,
        "user_id": setting.user_id,
        "category_name": setting.category_name,
        "budget_limit": setting.budget_limit,
        "is_daily_challenge": setting.is_daily_challenge,
        "alert_threshold": setting.alert_threshold,
    }


def serialize_transaction(transaction: Transaction):
    return {
        "tx_id": transaction.tx_id,
        "user_id": transaction.user_id,
        "tx_date": transaction.tx_date.isoformat(),
        "tx_time": (
            transaction.tx_time.strftime("%H:%M") if transaction.tx_time else None
        ),
        "amount": transaction.amount,
        "merchant_name": transaction.merchant_name,
        "mydata_category": transaction.mydata_category,
        "final_category": transaction.final_category,
        "is_user_corrected": transaction.is_user_corrected,
    }


def get_month_date_range(target_date: date):
    first_day = target_date.replace(day=1)
    last_day = target_date.replace(
        day=monthrange(target_date.year, target_date.month)[1]
    )

    return first_day, last_day


def get_weekly_trend(transactions):
    labels = ["월", "화", "수", "목", "금", "토", "일"]
    amount_by_weekday = defaultdict(int)

    for transaction in transactions:
        amount_by_weekday[transaction.tx_date.weekday()] += transaction.amount

    return [
        {
            "label": labels[index],
            "amount": amount_by_weekday[index],
        }
        for index in range(7)
    ]


def calculate_projected_amount(actual_amount: int, today: date):
    days_in_month = monthrange(today.year, today.month)[1]

    if today.day <= 0:
        return actual_amount

    if actual_amount <= 0:
        return 0

    return round((actual_amount / today.day) * days_in_month)


def build_evaluated_categories(category_settings, monthly_transactions, today: date):
    actual_by_category = defaultdict(int)

    for transaction in monthly_transactions:
        actual_by_category[transaction.final_category] += transaction.amount

    evaluated = []

    for setting in category_settings:
        actual_spend = actual_by_category[setting.category_name]
        predicted_monthly_spend = calculate_projected_amount(actual_spend, today)

        if setting.budget_limit > 0:
            budget_pressure = predicted_monthly_spend / setting.budget_limit
        else:
            budget_pressure = 0

        evaluated.append(
            {
                "category_name": setting.category_name,
                "budget_limit": setting.budget_limit,
                "actual_spend": actual_spend,
                "predicted_monthly_spend": predicted_monthly_spend,
                "budget_pressure": budget_pressure,
                "rank": None,
            }
        )

    evaluated.sort(
        key=lambda item: item["budget_pressure"],
        reverse=True,
    )

    for index, item in enumerate(evaluated, start=1):
        item["rank"] = index

    return evaluated


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


@app.get("/")
def read_root():
    return {"message": "Moni 백엔드 서버가 살아있습니다! 🚀"}


# [API 1] 회원가입
@app.post("/signup")
def signup(req: SignupRequest):
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.email == req.email)).first()
        if existing:
            raise HTTPException(status_code=400, detail="이미 존재하는 이메일입니다")
        if req.payday < 1 or req.payday > 31:
            raise HTTPException(
                status_code=400, detail="수입일은 1일부터 31일 사이여야 합니다"
            )

        user = User(
            user_id=str(uuid.uuid4()),
            email=req.email.strip(),
            password_hash=hash_password(req.password),
            income_type=req.income_type,
            payday=req.payday,
            spend_profile=req.spend_profile,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        ensure_default_category_settings(session, user.user_id)
        return {"status": "success", "user_id": user.user_id}


# [API 2] 로그인
@app.post("/login")
def login(req: LoginRequest):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == req.email)).first()
        if not user or not verify_password(req.password, user.password_hash):
            raise HTTPException(
                status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다"
            )
        token = create_access_token(user.user_id)
        return {"access_token": token, "token_type": "bearer"}


# [API 3] 내 정보 조회
@app.get("/me")
def get_me(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        return serialize_user_profile(user)


# [API 4] 오늘의 챌린지 생성
@app.get("/challenges/today")
def get_today_challenges_api(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        today = date.today()

        challenges = session.exec(
            select(DailyChallenge)
            .where(DailyChallenge.user_id == user_id)
            .where(DailyChallenge.challenge_date == today)
        ).all()

        return {
            "status": "success",
            "count": len(challenges),
            "data": [serialize_challenge(challenge) for challenge in challenges],
        }


@app.post("/challenges/generate")
def generate_challenges(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        today = date.today()

        existing_challenges = session.exec(
            select(DailyChallenge)
            .where(DailyChallenge.user_id == user_id)
            .where(DailyChallenge.challenge_date == today)
        ).all()

        if existing_challenges:
            return {
                "status": "success",
                "count": len(existing_challenges),
                "data": [
                    serialize_challenge(challenge) for challenge in existing_challenges
                ],
            }

        transactions = session.exec(
            select(Transaction).where(Transaction.user_id == user_id)
        ).all()

        category_settings = ensure_default_category_settings(session, user_id)

        transactions_df = pd.DataFrame([t.model_dump() for t in transactions])
        category_settings_df = pd.DataFrame([c.model_dump() for c in category_settings])

        user_profile = user.model_dump()

        try:
            challenges = get_today_challenges(
                transactions_df=transactions_df,
                user_profile=user_profile,
                category_settings_df=category_settings_df,
                target_date=today,
            )
        except Exception as e:
            print(f"[WARNING] AI 엔진 오류, fallback 사용: {e}")
            challenges = []

        if not challenges:
            challenges = [make_fallback_challenge(user_id, today)]

        saved = []

        for c in challenges:
            if isinstance(c.get("challenge_date"), str):
                c["challenge_date"] = date.fromisoformat(c["challenge_date"])

            challenge = DailyChallenge(**c)
            session.add(challenge)
            saved.append(challenge)

        session.commit()

        for challenge in saved:
            session.refresh(challenge)

        return {
            "status": "success",
            "count": len(saved),
            "data": [serialize_challenge(challenge) for challenge in saved],
        }


@app.get("/transactions")
def get_transactions_api(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        transactions = session.exec(
            select(Transaction).where(Transaction.user_id == user_id)
        ).all()

        sorted_transactions = sorted(
            transactions,
            key=lambda item: (item.tx_date, item.tx_time),
            reverse=True,
        )

        return {
            "status": "success",
            "count": len(sorted_transactions),
            "data": [
                serialize_transaction(transaction)
                for transaction in sorted_transactions
            ],
        }


@app.post("/transactions")
def create_transaction_api(
    req: TransactionCreateRequest,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        transaction = Transaction(
            user_id=user_id,
            tx_date=req.tx_date,
            tx_time=req.tx_time or datetime.now().time().replace(microsecond=0),
            amount=req.amount,
            merchant_name=req.merchant_name,
            mydata_category=req.mydata_category,
            final_category=req.final_category,
            is_user_corrected=req.is_user_corrected,
        )

        session.add(transaction)
        session.commit()
        session.refresh(transaction)

        return {
            "status": "success",
            "data": serialize_transaction(transaction),
        }


@app.patch("/transactions/{tx_id}")
def update_transaction_api(
    tx_id: str,
    req: TransactionUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        transaction = session.get(Transaction, tx_id)

        if not transaction:
            raise HTTPException(status_code=404, detail="지출 내역을 찾을 수 없습니다")

        if transaction.user_id != user_id:
            raise HTTPException(status_code=403, detail="수정 권한이 없습니다")

        if req.tx_date is not None:
            try:
                if isinstance(req.tx_date, date):
                    transaction.tx_date = req.tx_date
                else:
                    transaction.tx_date = date.fromisoformat(str(req.tx_date))
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="날짜 형식은 YYYY-MM-DD여야 합니다",
                )

        if req.tx_time is not None:
            try:
                if isinstance(req.tx_time, time):
                    transaction.tx_time = req.tx_time
                else:
                    transaction.tx_time = time.fromisoformat(str(req.tx_time))
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="시간 형식은 HH:MM이어야 합니다",
                )

        if req.amount is not None:
            transaction.amount = req.amount

        if req.merchant_name is not None:
            transaction.merchant_name = req.merchant_name

        if req.mydata_category is not None:
            transaction.mydata_category = req.mydata_category

        if req.final_category is not None:
            transaction.final_category = req.final_category

        if req.is_user_corrected is not None:
            transaction.is_user_corrected = req.is_user_corrected

        session.add(transaction)
        session.commit()
        session.refresh(transaction)

        return {
            "status": "success",
            "data": serialize_transaction(transaction),
        }


@app.delete("/transactions/{tx_id}")
def delete_transaction_api(
    tx_id: str,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        transaction = session.get(Transaction, tx_id)

        if not transaction:
            raise HTTPException(status_code=404, detail="지출 내역을 찾을 수 없습니다")

        if transaction.user_id != user_id:
            raise HTTPException(status_code=403, detail="삭제 권한이 없습니다")

        session.delete(transaction)
        session.commit()

        return {
            "status": "success",
            "deleted_id": tx_id,
        }


@app.get("/reports/monthly")
def get_monthly_report_api(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        today = date.today()
        first_day, last_day = get_month_date_range(today)

        category_settings = ensure_default_category_settings(session, user_id)

        monthly_transactions = session.exec(
            select(Transaction)
            .where(Transaction.user_id == user_id)
            .where(Transaction.tx_date >= first_day)
            .where(Transaction.tx_date <= last_day)
        ).all()

        total_spend = sum(transaction.amount for transaction in monthly_transactions)

        total_budget = sum(category.budget_limit for category in category_settings)

        predicted_monthly_spend = calculate_projected_amount(total_spend, today)

        if total_budget > 0:
            budget_pressure = predicted_monthly_spend / total_budget
        else:
            budget_pressure = 0

        evaluated_categories = build_evaluated_categories(
            category_settings=category_settings,
            monthly_transactions=monthly_transactions,
            today=today,
        )

        weekly_trend = get_weekly_trend(monthly_transactions)

        return {
            "status": "success",
            "data": {
                "month": today.strftime("%Y-%m"),
                "monthly_summary": {
                    "total_spend": total_spend,
                    "budget_limit": total_budget,
                    "predicted_monthly_spend": predicted_monthly_spend,
                    "budget_pressure": budget_pressure,
                    "transaction_count": len(monthly_transactions),
                },
                "weekly_trend": weekly_trend,
                "evaluated_categories": evaluated_categories,
            },
        }


@app.patch("/challenges/{challenge_id}/status")
def update_challenge_status_api(
    challenge_id: int,
    req: ChallengeStatusUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    allowed_statuses = ["PENDING", "SUCCESS", "FAILED"]

    if req.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="올바르지 않은 상태입니다")

    with Session(engine) as session:
        challenge = session.get(DailyChallenge, challenge_id)

        if not challenge:
            raise HTTPException(status_code=404, detail="챌린지를 찾을 수 없습니다")

        if challenge.user_id != user_id:
            raise HTTPException(status_code=403, detail="수정 권한이 없습니다")

        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        previous_status = challenge.status
        challenge.status = req.status

        if previous_status != "SUCCESS" and req.status == "SUCCESS":
            user.total_xp += challenge.xp_reward

        if previous_status == "SUCCESS" and req.status != "SUCCESS":
            user.total_xp = max(0, user.total_xp - challenge.xp_reward)

        user.current_level = calculate_level(user.total_xp)

        session.add(challenge)
        session.add(user)
        session.commit()
        session.refresh(challenge)
        session.refresh(user)

        return {
            "status": "success",
            "data": {
                "challenge": serialize_challenge(challenge),
                "user_progress": serialize_user_progress(user),
            },
        }


@app.patch("/me")
def update_me_api(
    req: UserUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        if req.email is not None:
            email = req.email.strip()

            if not email:
                raise HTTPException(status_code=400, detail="이메일을 입력해 주세요")

            existing_user = session.exec(
                select(User).where(User.email == email)
            ).first()

            if existing_user and existing_user.user_id != user_id:
                raise HTTPException(
                    status_code=409, detail="이미 사용 중인 이메일입니다"
                )

            user.email = email

        if req.income_type is not None:
            user.income_type = req.income_type

        if req.payday is not None:
            if req.payday < 1 or req.payday > 31:
                raise HTTPException(
                    status_code=400, detail="수입일은 1일부터 31일 사이여야 합니다"
                )

            user.payday = req.payday

        if req.spend_profile is not None:
            user.spend_profile = req.spend_profile

        session.add(user)
        session.commit()
        session.refresh(user)

        return {
            "status": "success",
            "data": serialize_user_profile(user),
        }


@app.get("/categories")
def get_categories_api(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        categories = ensure_default_category_settings(session, user_id)

        return {
            "status": "success",
            "count": len(categories),
            "data": [serialize_category_setting(category) for category in categories],
        }


@app.patch("/categories/{category_id}")
def update_category_api(
    category_id: str,
    req: CategoryUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        category = session.get(UserCategorySetting, category_id)

        if not category:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다")

        if category.user_id != user_id:
            raise HTTPException(status_code=403, detail="수정 권한이 없습니다")

        if req.budget_limit is not None:
            if req.budget_limit < 0:
                raise HTTPException(
                    status_code=400, detail="예산은 0원 이상이어야 합니다"
                )

            category.budget_limit = req.budget_limit

        if req.is_daily_challenge is not None:
            category.is_daily_challenge = req.is_daily_challenge

        if req.alert_threshold is not None:
            if req.alert_threshold < 1 or req.alert_threshold > 100:
                raise HTTPException(
                    status_code=400, detail="알림 기준은 1부터 100 사이여야 합니다"
                )

            category.alert_threshold = req.alert_threshold

        session.add(category)
        session.commit()
        session.refresh(category)

        return {
            "status": "success",
            "data": serialize_category_setting(category),
        }
