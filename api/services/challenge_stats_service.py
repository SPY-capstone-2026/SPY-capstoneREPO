from datetime import date, timedelta
from typing import Optional
from sqlmodel import Session, select
from models import DailyChallenge


def get_completed_challenges(
    session: Session,
    user_id: str,
    start_date: date,
    end_date: date,
    category_name: Optional[str] = None,
):
    """기간 내 완료(SUCCESS)된 챌린지 목록. 카테고리로도 필터링 가능."""
    query = (
        select(DailyChallenge)
        .where(DailyChallenge.user_id == user_id)
        .where(DailyChallenge.status == "SUCCESS")
        .where(DailyChallenge.challenge_date >= start_date)
        .where(DailyChallenge.challenge_date <= end_date)
    )

    if category_name:
        query = query.where(DailyChallenge.category_name == category_name)

    return session.exec(query.order_by(DailyChallenge.challenge_date.desc())).all()


def get_weekly_completed_count(
    session: Session,
    user_id: str,
    target_date: Optional[date] = None,
) -> dict:
    """target_date가 속한 주(월요일 시작)의 완료 챌린지 개수."""
    target_date = target_date or date.today()
    week_start = target_date - timedelta(days=target_date.weekday())  # 이번 주 월요일
    week_end = week_start + timedelta(days=6)  # 이번 주 일요일

    completed = get_completed_challenges(session, user_id, week_start, week_end)

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "completed_count": len(completed),
    }


def get_current_streak(
    session: Session,
    user_id: str,
    category_name: Optional[str] = None,
) -> dict:
    """
    오늘부터 거슬러 올라가며 'SUCCESS 챌린지가 하나라도 있었던 날'을 기준으로
    연속 일수를 계산. (오늘 아직 안 깼으면 어제부터 카운트 시작 -> 오늘 안 깼다고
    바로 스트릭이 0으로 끊긴 것처럼 보이지 않게 함)
    """
    query = (
        select(DailyChallenge.challenge_date)
        .where(DailyChallenge.user_id == user_id)
        .where(DailyChallenge.status == "SUCCESS")
    )

    if category_name:
        query = query.where(DailyChallenge.category_name == category_name)

    completed_dates = set(session.exec(query).all())

    if not completed_dates:
        return {"current_streak": 0, "last_completed_date": None}

    today = date.today()
    cursor = today if today in completed_dates else today - timedelta(days=1)

    streak = 0
    while cursor in completed_dates:
        streak += 1
        cursor -= timedelta(days=1)

    return {
        "current_streak": streak,
        "last_completed_date": max(completed_dates).isoformat(),
    }
