from sqlmodel import Session, select
from models import UserCategorySetting


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
