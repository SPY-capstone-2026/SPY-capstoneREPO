from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session

from models import engine, User, UserCategorySetting
from auth import get_current_user_id
from schemas import CategoryUpdateRequest
from serializers import serialize_category_setting
from services.common_service import ensure_default_category_settings

router = APIRouter()


@router.get("/categories")
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


@router.patch("/categories/{category_id}")
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
