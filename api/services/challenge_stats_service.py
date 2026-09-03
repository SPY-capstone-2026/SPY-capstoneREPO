from datetime import date, timedelta
from typing import Optional
from collections import defaultdict
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


def get_category_stats(
    session: Session,
    user_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list:
    """
    카테고리별 [생성된 챌린지 개수 / 달성(SUCCESS)한 개수 / 달성률] 집계.
    start_date~end_date 안 주면 전체 기간 기준.
    (데이터가 유저당 수백 건 수준이라 SQL GROUP BY 대신 파이썬에서 바로 집계)
    """
    query = select(DailyChallenge).where(DailyChallenge.user_id == user_id)

    if start_date:
        query = query.where(DailyChallenge.challenge_date >= start_date)
    if end_date:
        query = query.where(DailyChallenge.challenge_date <= end_date)

    challenges = session.exec(query).all()

    counts = defaultdict(lambda: {"total_count": 0, "completed_count": 0})

    for challenge in challenges:
        counts[challenge.category_name]["total_count"] += 1
        if challenge.status == "SUCCESS":
            counts[challenge.category_name]["completed_count"] += 1

    result = []
    for category_name, c in counts.items():
        total = c["total_count"]
        completed = c["completed_count"]
        result.append({
            "category_name": category_name,
            "total_count": total,
            "completed_count": completed,
            "completion_rate": round(completed / total, 4) if total > 0 else 0,
        })

    result.sort(key=lambda item: item["category_name"])
    return result
