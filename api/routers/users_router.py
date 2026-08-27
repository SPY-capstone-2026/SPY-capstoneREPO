from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select

from models import engine, User
from auth import get_current_user_id
from schemas import UserUpdateRequest
from serializers import serialize_user_profile

router = APIRouter()


@router.get("/me")
def get_me(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        return serialize_user_profile(user)


@router.patch("/me")
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
