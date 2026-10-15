"""
챌린지 재생성 서비스 — 예산을 '늘렸을 때' 오늘의 미완료 챌린지를 새 예산 기준으로 다시 만든다.

배경
----
예산이 꽉 차서 "식비 무지출" 같은 금지형 챌린지가 나왔는데 사용자가 예산을 늘렸다면,
그 챌린지는 더 이상 말이 안 된다. 예산을 늘리면 그 카테고리의 챌린지를 다시 만든다.

정책 (팀에서 정한 것)
--------------------
- 예산을 '늘린' 경우에만, 그 카테고리가 챌린지 대상(is_daily_challenge)일 때만 재생성한다.
- 오늘(KST) 날짜의 챌린지 중 아직 체크하지 않은 것(PENDING)만 교체한다.
  이미 체크했거나(VERIFYING) 정산이 끝난(SUCCESS/FAILED) 챌린지는 절대 건드리지 않는다.
  (보상/검증 이력 보호. 같은 종류가 중복 생성되지도 않게 한다.)
- 지난 날짜 챌린지는 건드리지 않는다.
- 챌린지 대상에서 '해제'한 카테고리의 기존 챌린지는 그대로 둔다. (이 서비스는 해제와 무관)

안전장치
--------
- 엔진 오류/빈 결과 -> 기존 챌린지를 그대로 둔다. (새 걸 못 만들었는데 옛것까지 지우지 않는다)
- 엔진이 다른 카테고리 챌린지는 만들었는데 이 카테고리는 안 만들었다면(새 예산에서는 오늘 챌린지가 필요 없는
  카테고리) 옛 챌린지만 제거한다.
- 생성(/challenges/generate)과 같은 advisory lock 을 써서 동시에 돌아도 중복 생성되지 않는다.
- 엔진 호출은 몇 초 걸리므로 챌린지 행 잠금은 엔진 호출 '뒤' 교체 직전에만 잡는다.
  그 사이에 사용자가 체크(VERIFYING)한 챌린지는 교체 대상에서 빠진다.
"""

import logging
from datetime import date
from typing import Optional

import pandas as pd
from sqlmodel import Session, select

from models import engine as default_engine, User, DailyChallenge, Transaction, UserCategorySetting
from services.challenge_service import serialize_generation
from services.time_utils import kst_today
from moni_engine.engine import get_today_challenges

logger = logging.getLogger(__name__)

STATUS_PENDING = "PENDING"


def _origin(meta: Optional[dict], challenge_type: Optional[str]) -> str:
    """pressure(압박도) / streak(무지출 연속) 구분. 한 카테고리에 종류당 하나만 두기 위한 기준."""
    origin = (meta or {}).get("challenge_origin")
    if origin:
        return origin
    return "streak" if challenge_type == "streak형" else "pressure"


def regenerate_pending_challenges_for_category(
    user_id: str,
    category_name: str,
    target_date: Optional[date] = None,
) -> dict:
    """
    반환: {"regenerated": 새로 만든 개수, "removed": 지운 개수, "reason": 결과 사유}
    어떤 경우에도 예외를 밖으로 던지지 않는다. (예산 수정 응답 뒤에 백그라운드로 도는 작업이라서)
    """
    today = target_date or kst_today()
    try:
        with Session(default_engine) as session:
            result = _regenerate(session, user_id, category_name, today)
    except Exception:
        logger.exception("챌린지 재생성 실패 user_id=%s category=%s", user_id, category_name)
        return {"regenerated": 0, "removed": 0, "reason": "error"}

    logger.info("챌린지 재생성 user_id=%s category=%s -> %s", user_id, category_name, result)
    return result


def _skip(reason: str) -> dict:
    return {"regenerated": 0, "removed": 0, "reason": reason}


def _regenerate(session: Session, user_id: str, category_name: str, today: date) -> dict:
    user = session.get(User, user_id)
    if user is None:
        return _skip("no_user")

    # 생성 API 와 같은 잠금. 이 트랜잭션이 끝날 때까지 같은 유저·날짜의 생성/재생성이 순서대로 처리된다.
    serialize_generation(session, user_id, today)

    setting = session.exec(
        select(UserCategorySetting)
        .where(UserCategorySetting.user_id == user_id)
        .where(UserCategorySetting.category_name == category_name)
    ).first()
    if setting is None or not setting.is_daily_challenge:
        return _skip("not_a_challenge_category")

    def todays_rows(*extra):
        query = (
            select(DailyChallenge)
            .where(DailyChallenge.user_id == user_id)
            .where(DailyChallenge.challenge_date == today)
            .where(DailyChallenge.category_name == category_name)
        )
        for condition in extra:
            query = query.where(condition)
        return query

    if not session.exec(todays_rows(DailyChallenge.status == STATUS_PENDING)).first():
        return _skip("no_pending_challenge")

    # ---- 새 예산(이미 커밋됨)으로 엔진 실행: 생성 API 와 같은 입력 ----
    category_settings = session.exec(
        select(UserCategorySetting).where(UserCategorySetting.user_id == user_id)
    ).all()
    transactions = session.exec(
        select(Transaction).where(Transaction.user_id == user_id)
    ).all()
    try:
        generated = get_today_challenges(
            transactions_df=pd.DataFrame([t.model_dump() for t in transactions]),
            user_profile=user.model_dump(),
            category_settings_df=pd.DataFrame([c.model_dump() for c in category_settings]),
            target_date=today,
        )
    except Exception:
        logger.exception("재생성 중 AI 엔진 오류 -> 기존 챌린지 유지 user_id=%s", user_id)
        return _skip("engine_error")

    if not generated:
        return _skip("engine_empty")

    # ---- 교체: 엔진이 도는 동안 사용자가 체크했을 수 있으니 이 시점에 다시 잠그고 확인 ----
    stale = session.exec(
        todays_rows(DailyChallenge.status == STATUS_PENDING).with_for_update()
    ).all()
    kept = session.exec(todays_rows(DailyChallenge.status != STATUS_PENDING)).all()
    kept_origins = {_origin(c.ai_metadata, c.challenge_type) for c in kept}

    fresh = [
        dict(c) for c in generated
        if c.get("category_name") == category_name
        and _origin(c.get("ai_metadata"), c.get("challenge_type")) not in kept_origins
    ]

    for row in stale:
        session.delete(row)
    for item in fresh:
        if isinstance(item.get("challenge_date"), str):
            item["challenge_date"] = date.fromisoformat(item["challenge_date"])
        session.add(DailyChallenge(**item))
    session.commit()

    return {"regenerated": len(fresh), "removed": len(stale), "reason": "ok"}
