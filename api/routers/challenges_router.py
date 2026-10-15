from datetime import date, timedelta
from typing import Optional
import pandas as pd
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select

from models import engine, User, DailyChallenge, Transaction
from auth import get_current_user_id
from schemas import ChallengeStatusUpdateRequest
from serializers import serialize_challenge, serialize_user_progress
from services.common_service import ensure_default_category_settings
from services.challenge_service import make_fallback_challenge, serialize_generation
from services.time_utils import kst_today
from services.challenge_verification_service import (
    STATUS_PENDING,
    STATUS_VERIFYING,
    STATUS_SUCCESS,
    STATUS_FAILED,
    verify_pending_challenges_safely,
)
# 보상 지급(process_challenge_completion)/회수(reverse_challenge_completion)는 더 이상 이 라우터에서
# 호출하지 않는다. 보상은 자정 정산(challenge_verification_service)에서만 지급된다.
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
            today = kst_today()
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
    # 스케줄러가 자정에 못 돌았더라도, 사용자가 앱을 열면 이 사용자의 밀린 정산을 먼저 처리한다.
    # (정산 대상이 없으면 가벼운 조회 한 번으로 끝나고, 실패해도 이 API는 깨지지 않는다)
    verify_pending_challenges_safely(user_id)

    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        today = kst_today()

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
    verify_pending_challenges_safely(user_id)

    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        # 챌린지의 '대상 날짜'가 된다. 자정 검증이 이 날짜의 지출을 보므로 반드시 KST 기준.
        # (UTC 서버에서 date.today()를 쓰면 KST 00~09시에 어제 날짜로 챌린지가 만들어진다)
        today = kst_today()

        # 주의: ensure_default_category_settings 는 내부에서 commit 한다. 트랜잭션 단위 잠금은 커밋에서 풀리므로
        # 반드시 이 호출 '다음에' 잠금을 잡아야 한다. (순서를 바꾸면 중복 생성 방어가 조용히 깨진다)
        category_settings = ensure_default_category_settings(session, user_id)

        # 존재 확인 -> 생성 -> 저장 구간 전체를 같은 유저·날짜 기준으로 직렬화
        serialize_generation(session, user_id, today)

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
    # 기존 FE 호환: 완료 체크는 지금까지처럼 {"status": "SUCCESS"}, 취소는 {"status": "PENDING"}.
    # 단, SUCCESS 요청이 더 이상 '달성 확정'이 아니라 '검증 대기(VERIFYING)로 전환'을 뜻한다.
    allowed_statuses = [STATUS_PENDING, STATUS_VERIFYING, STATUS_SUCCESS, STATUS_FAILED]

    if req.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="올바르지 않은 상태입니다")

    # 사용자가 보낸 값 -> 실제로 저장할 상태
    if req.status in (STATUS_SUCCESS, STATUS_VERIFYING):
        requested = STATUS_VERIFYING  # 완료 체크
    else:
        requested = req.status        # PENDING(체크 취소) / FAILED(포기)

    with Session(engine) as session:
        # 행 잠금: 같은 챌린지에 대한 사용자 요청과 자정 정산이 서로 엇갈리지 않게 한다.
        # (정산이 먼저 잡았으면 여기서 기다렸다가 '이미 확정됨'을 보게 된다)
        challenge = session.exec(
            select(DailyChallenge)
            .where(DailyChallenge.challenge_id == challenge_id)
            .with_for_update()
        ).first()

        if not challenge:
            raise HTTPException(status_code=404, detail="챌린지를 찾을 수 없습니다")

        if challenge.user_id != user_id:
            raise HTTPException(status_code=403, detail="수정 권한이 없습니다")

        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        current = challenge.status
        already_final = current in (STATUS_SUCCESS, STATUS_FAILED)

        if already_final:
            # 이미 정산이 끝난 챌린지. 같은 의미의 재요청은 그대로 성공 처리(멱등)하고,
            # 결과를 바꾸는 요청(체크 취소 등)은 막는다.
            repeats_result = (
                (current == STATUS_SUCCESS and requested == STATUS_VERIFYING)
                or current == requested
            )
            if not repeats_result:
                raise HTTPException(
                    status_code=409,
                    detail="이미 검증이 끝난 챌린지는 변경할 수 없습니다",
                )
        elif current != requested:
            # 상태를 실제로 바꾸는 요청은 '당일(KST)' 챌린지에만 허용.
            # 자정이 지나면 서버가 정산을 아직 못 돌았어도 체크/취소를 더 이상 받지 않는다.
            if challenge.challenge_date != kst_today():
                raise HTTPException(
                    status_code=400,
                    detail="당일 챌린지만 완료 체크/취소할 수 있습니다",
                )

            challenge.status = requested
            session.add(challenge)
            session.commit()
        # current == requested (VERIFYING 재요청, PENDING 재요청)는 아무것도 하지 않는다.

        session.refresh(challenge)

        # 응답 키는 기존과 동일하게 유지한다. 보상은 자정 정산에서 지급되므로 이 시점엔 항상 null.
        return {
            "status": "success",
            "data": {
                "challenge": serialize_challenge(challenge),
                "user_progress": serialize_user_progress(user),
                "level_result": None,
                "reversal_result": None,
            },
        }
