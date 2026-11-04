"""
지난 챌린지 날짜별 조회.

DB의 status 는 그대로 두고, 화면에 보여 줄 결과(result)만 계산해서 붙인다.
- SUCCESS   : 달성 (보상 지급됨)
- FAILED    : 미달성 (정산 결과 한도 초과, 또는 사용자가 포기)
- VERIFYING : 정산 대기 (체크했고 아직 자정 정산 전)
- MISSED    : 체크하지 않은 채 날짜가 지남 (DB status 는 PENDING 그대로)
- PENDING   : 오늘 챌린지, 아직 체크 안 함
"""
from collections import OrderedDict
from datetime import date, timedelta
from typing import Iterable, List, Optional

from fastapi import HTTPException
from sqlmodel import Session, select

from models import DailyChallenge
from services.challenge_verification_service import (
    STATUS_PENDING,
    STATUS_VERIFYING,
    STATUS_SUCCESS,
    STATUS_FAILED,
)
from services.time_utils import kst_today

RESULT_SUCCESS = "SUCCESS"
RESULT_FAILED = "FAILED"
RESULT_VERIFYING = "VERIFYING"
RESULT_MISSED = "MISSED"
RESULT_PENDING = "PENDING"
ALL_RESULTS = (RESULT_SUCCESS, RESULT_FAILED, RESULT_VERIFYING, RESULT_MISSED, RESULT_PENDING)

DEFAULT_DAYS = 30
MAX_DAYS = 93


def challenge_result(challenge: DailyChallenge, today: date) -> str:
    if challenge.status == STATUS_SUCCESS:
        return RESULT_SUCCESS
    if challenge.status == STATUS_FAILED:
        return RESULT_FAILED
    if challenge.status == STATUS_VERIFYING:
        return RESULT_VERIFYING
    if challenge.status == STATUS_PENDING and challenge.challenge_date < today:
        return RESULT_MISSED
    return RESULT_PENDING


def parse_result_filter(raw: Optional[str]) -> Optional[set]:
    if not raw:
        return None
    values = {v.strip().upper() for v in raw.split(",") if v.strip()}
    unknown = values - set(ALL_RESULTS)
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"result 는 {', '.join(ALL_RESULTS)} 중에서 쉼표로 골라 주세요",
        )
    return values


def resolve_range(start_date: Optional[date], end_date: Optional[date], today: date):
    """기본: 어제까지 최근 30일. 오늘 이후는 조회 불가, 최대 93일."""
    end = end_date or (today - timedelta(days=1))
    start = start_date or (end - timedelta(days=DEFAULT_DAYS - 1))
    if end > today:
        raise HTTPException(status_code=400, detail="미래 날짜는 조회할 수 없습니다")
    if start > end:
        raise HTTPException(status_code=400, detail="start_date 가 end_date 보다 늦습니다")
    if (end - start).days + 1 > MAX_DAYS:
        raise HTTPException(status_code=400, detail=f"한 번에 최대 {MAX_DAYS}일까지 조회할 수 있습니다")
    return start, end


def get_challenge_history(
    session: Session,
    user_id: str,
    start: date,
    end: date,
    today: date,
    results: Optional[Iterable[str]] = None,
    category_name: Optional[str] = None,
) -> List[dict]:
    """
    반환: 최신 날짜부터
      [{"date": date, "challenges": [(DailyChallenge, result), ...]}, ...]
    챌린지가 없는 날짜(또는 필터 후 비는 날짜)는 넣지 않는다.
    """
    query = (
        select(DailyChallenge)
        .where(DailyChallenge.user_id == user_id)
        .where(DailyChallenge.challenge_date >= start)
        .where(DailyChallenge.challenge_date <= end)
    )
    if category_name:
        query = query.where(DailyChallenge.category_name == category_name)

    rows = session.exec(
        query.order_by(DailyChallenge.challenge_date.desc(), DailyChallenge.challenge_id)
    ).all()

    wanted = set(results) if results else None
    grouped: "OrderedDict[date, list]" = OrderedDict()
    for challenge in rows:
        result = challenge_result(challenge, today)
        if wanted is not None and result not in wanted:
            continue
        grouped.setdefault(challenge.challenge_date, []).append((challenge, result))

    return [{"date": d, "challenges": items} for d, items in grouped.items()]


def summarize_day(items) -> dict:
    counts = {r: 0 for r in ALL_RESULTS}
    xp = 0
    for challenge, result in items:
        counts[result] += 1
        if result == RESULT_SUCCESS:
            xp += challenge.xp_reward
    return {
        "total": len(items),
        "success": counts[RESULT_SUCCESS],
        "failed": counts[RESULT_FAILED],
        "missed": counts[RESULT_MISSED],
        "verifying": counts[RESULT_VERIFYING],
        "xp_earned": xp,
    }
