import uuid
from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select

from models import engine, User
from auth import hash_password, verify_password, create_access_token
from schemas import SignupRequest, LoginRequest
from services.common_service import ensure_default_category_settings

router = APIRouter()


@router.post("/signup")
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


@router.post("/login")
def login(req: LoginRequest):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == req.email)).first()
        if not user or not verify_password(req.password, user.password_hash):
            raise HTTPException(
                status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다"
            )
        token = create_access_token(user.user_id)
        return {"access_token": token, "token_type": "bearer"}
