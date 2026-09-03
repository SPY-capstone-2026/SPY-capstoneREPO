from datetime import date, datetime, timedelta
from typing import Optional
import pandas as pd
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select

from models import engine, User, DailyChallenge, Transaction
from auth import get_current_user_id
from schemas import ChallengeStatusUpdateRequest
from serializers import serialize_challenge, serialize_user_progress
from services.common_service import ensure_default_category_settings
from services.challenge_service import make_fallback_challenge
from services.leveling import (
    process_challenge_completion,
    calculate_level_from_xp,
    reverse_challenge_completion,
)
from services.challenge_stats_service import (
    get_weekly_completed_count,
    get_current_streak,
    get_category_stats,
)
from moni_engine.engine import get_today_challenges

router = APIRouter()


# [챌린지 통계] 주간 달성 개수 + 연속 달성일(스트릭)
@router.get("/challenges/stats")
def get_challenge_stats_api(
    category_name: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        weekly = get_weekly_completed_count(session, user_id)
        streak = get_current_streak(session, user_id, category_name=category_name)

        return {
            "status": "success",
            "data": {
                "weekly": weekly,
                "streak": streak,
            },
        }


# [챌린지 통계] 카테고리별 생성/달성 개수 (AI 팀 요청용)
# 기본은 '이번 주'만 집계 (매주 자동 리셋). period=all 이면 전체 누적.
@router.get("/challenges/stats/by-category")
def get_challenge_stats_by_category_api(
    period: str = "week",  # "week" | "all"
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user_id: str = Depends(get_current_user_id),
):
    if period not in ("week", "all"):
        raise HTTPException(status_code=400, detail="period는 'week' 또는 'all'이어야 합니다")

    with Session(engine) as session:
        # start_date/end_date를 직접 넘기면 그게 우선, 안 넘기면 period 기준으로 자동 계산
        if start_date is None and end_date is None and period == "week":
            today = date.today()
            start_date = today - timedelta(days=today.weekday())  # 이번 주 월요일
            end_date = start_date + timedelta(days=6)              # 이번 주 일요일

        category_stats = get_category_stats(
            session, user_id, start_date=start_date, end_date=end_date
        )

        return {
            "status": "success",
            "data": {
                "period": period,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "categories": category_stats,
            },
        }


@router.get("/challenges/today")
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


@router.post("/challenges/generate")
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


@router.patch("/challenges/{challenge_id}/status")
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
        session.add(challenge)

        level_result = None
        reversal_result = None

        if previous_status != "SUCCESS" and req.status == "SUCCESS":
            # 챌린지 달성 → XP 적립 + 레벨업/포인트 판정
            level_result = process_challenge_completion(session, user, challenge.xp_reward)
            # 완료 시점의 지급 내역을 챌린지에 스냅샷으로 저장 (취소 시 정확히 회수하기 위함)
            challenge.reward_snapshot = level_result
            challenge.completed_at = datetime.now()  # 스트릭/주간 통계용 완료 시각 기록
            session.add(challenge)
            session.commit()
            session.refresh(challenge)

        elif previous_status == "SUCCESS" and req.status != "SUCCESS":
            # 챌린지 완료 취소 → 스냅샷 기준으로 XP + 포인트 + 마일스톤 아이템 전부 회수
            reversal_result = reverse_challenge_completion(session, user, challenge)
            challenge.reward_snapshot = None  # 회수 완료했으니 스냅샷 제거
            challenge.completed_at = None  # 완료 취소했으니 완료 시각도 초기화
            session.add(challenge)
            session.commit()
            session.refresh(challenge)

        else:
            # 동일 상태로의 반복 요청 등 -> 중복 지급/회수 없이 상태만 저장
            session.commit()

        session.refresh(challenge)

        return {
            "status": "success",
            "data": {
                "challenge": serialize_challenge(challenge),
                "user_progress": serialize_user_progress(user),
                "level_result": level_result,
                "reversal_result": reversal_result,
            },
        }
