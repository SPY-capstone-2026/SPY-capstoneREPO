import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(os.path.join(os.path.dirname(__file__), '../ai'))

from fastapi import FastAPI, HTTPException, Depends
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from models import create_db_and_tables, engine, User, DailyChallenge, Transaction, UserCategorySetting
from auth import hash_password, verify_password, create_access_token, get_current_user_id
from pydantic import BaseModel
from datetime import date
import pandas as pd
from moni_engine.engine import get_today_challenges

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(title="Moni API 서버", lifespan=lifespan)

class SignupRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

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
        user = User(
            email=req.email,
            password_hash=hash_password(req.password)
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"status": "success", "user_id": user.user_id}

# [API 2] 로그인
@app.post("/login")
def login(req: LoginRequest):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == req.email)).first()
        if not user or not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다")
        token = create_access_token(user.user_id)
        return {"access_token": token, "token_type": "bearer"}

# [API 3] 내 정보 조회
@app.get("/me")
def get_me(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")
        return {"user_id": user.user_id, "email": user.email}

# [API 4] 오늘의 챌린지 생성
@app.post("/challenges/generate")
def generate_challenges(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        # 유저 정보 조회
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        # 트랜잭션 조회
        transactions = session.exec(
            select(Transaction).where(Transaction.user_id == user_id)
        ).all()

        # 카테고리 설정 조회
        category_settings = session.exec(
            select(UserCategorySetting).where(UserCategorySetting.user_id == user_id)
        ).all()

        if not category_settings:
            raise HTTPException(status_code=400, detail="카테고리 설정이 없습니다")

        # DataFrame 변환
        transactions_df = pd.DataFrame([t.model_dump() for t in transactions])
        category_settings_df = pd.DataFrame([c.model_dump() for c in category_settings])

        # Prophet 엔진 실행
        user_profile = user.model_dump()
        challenges = get_today_challenges(
            transactions_df=transactions_df,
            user_profile=user_profile,
            category_settings_df=category_settings_df,
            target_date=date.today(),
        )

        if not challenges:
            return {"status": "success", "count": 0, "data": []}

        # DB에 저장
        saved = []
        for c in challenges:
            if isinstance(c.get('challenge_date'), str):
                c['challenge_date'] = date.fromisoformat(c['challenge_date'])
            challenge = DailyChallenge(**c)
            session.add(challenge)
            session.commit()
            session.refresh(challenge)
            saved.append(challenge)

        return {"status": "success", "count": len(saved), "data": saved}
    