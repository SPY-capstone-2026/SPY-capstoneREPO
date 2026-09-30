from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from sqlmodel import Session

from models import engine, User, UserCategorySetting
from auth import get_current_user_id
from schemas import CategoryUpdateRequest
from serializers import serialize_category_setting
from services.common_service import ensure_default_category_settings
from services.budget_service import log_budget_change, get_budget_change_history

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

            # 실제로 바뀌는 경우에만 변경 이력을 남김 (같은 값으로 PATCH해도 로그 안 쌓이게)
            log_budget_change(
                session=session,
                user_id=user_id,
                category_name=category.category_name,
                old_limit=category.budget_limit,
                new_limit=req.budget_limit,
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


# [예산 변경 이력 조회] 월간/주간 리포트에서 "예산 변경 코멘트" 만들 때 사용
@router.get("/categories/budget-history")
def get_budget_history_api(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category_name: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        history = get_budget_change_history(
            session,
            user_id,
            start_date=start_date,
            end_date=end_date,
            category_name=category_name,
        )

        return {
            "status": "success",
            "count": len(history),
            "data": [
                {
                    "category_name": log.category_name,
                    "old_limit": log.old_limit,
                    "new_limit": log.new_limit,
                    "changed_at": log.changed_at.isoformat(),
                }
                for log in history
            ],
        }
