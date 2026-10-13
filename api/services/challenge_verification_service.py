"""
챌린지 검증(자정 정산) 서비스
=============================

흐름
----
1. 사용자가 완료 체크  -> status = VERIFYING (검증 대기). 이 단계에서는 XP/포인트를 주지 않는다.
2. 자정 이후 이 모듈의 verify_pending_challenges()가 실행되면,
   challenge_date 가 '오늘(KST)'보다 이전인 VERIFYING 챌린지를 모두 찾아서
   그 날짜의 지출 기록과 챌린지 조건을 비교한다.
     - 조건 충족   -> SUCCESS + 보상(XP/포인트/마일스톤) 지급
     - 조건 미충족 -> FAILED  (보상 없음)
3. 한 번 SUCCESS/FAILED가 되면 이후 거래가 바뀌어도 재검증하지 않는다. (의도된 정책)

안정성
------
- 중복 실행/지연 실행에 안전: 상태 전이(VERIFYING -> SUCCESS/FAILED)가 곧 멱등성 보장 장치다.
  이미 처리된 챌린지는 조회 조건(status == VERIFYING)에서 빠지므로 보상이 두 번 나가지 않는다.
- 동시 실행에 안전: 챌린지 행을 FOR UPDATE SKIP LOCKED 로 잡고, 보상 대상 유저 행도 FOR UPDATE 로 잡는다.
  (같은 유저의 챌린지 두 개를 두 프로세스가 동시에 정산해도 XP가 덮어써지지 않게)
- 상태 변경과 보상 지급은 한 트랜잭션에서 커밋된다. (process_challenge_completion(commit=False))
- 챌린지 하나가 실패해도 나머지는 계속 처리한다. (챌린지마다 별도 세션/트랜잭션)
- 지연 실행(catch-up): 자정에 못 돌았어도 다음 실행에서 '과거 날짜의 VERIFYING 전부'를 처리한다.
  검증에는 실행 시점이 아니라 챌린지의 challenge_date 를 쓴다.
"""

import logging
from datetime import date
from typing import Optional, Tuple

from sqlmodel import Session, select

from models import engine as default_engine, DailyChallenge, Transaction, User
from services.leveling import process_challenge_completion
from services.report_cache_service import invalidate_reports_containing_date
from services.time_utils import kst_today, kst_now, kst_now_naive

logger = logging.getLogger(__name__)

# ---- 챌린지 상태값 ------------------------------------------------------
# 기존 코드에는 Enum 없이 문자열 "PENDING" / "SUCCESS" / "FAILED" 만 쓰였다.
# 이번에 추가하는 값은 VERIFYING(검증 대기) 하나뿐이다.
STATUS_PENDING = "PENDING"      # 아직 완료 체크 안 함 (또는 완료 체크를 취소함)
STATUS_VERIFYING = "VERIFYING"  # 사용자가 완료 체크함 -> 자정 검증 대기
STATUS_SUCCESS = "SUCCESS"      # 검증 통과 + 보상 지급 완료
STATUS_FAILED = "FAILED"        # 검증 실패(조건 미충족) 또는 사용자가 포기

# ---- 검증 불가 챌린지 정책 ---------------------------------------------
# AI 엔진이 실패해서 만든 fallback 챌린지는 ai_metadata에 daily_limit 이 없고
# 문구도 "한 번만 줄여보세요"처럼 금액 기준이 없어 지출로 검증할 수 없다.
#   "approve": 사용자의 완료 체크를 믿고 달성 처리 (기존 '수동 체크' 동작과 동일)
#   "reject" : 검증 불가는 미달성 처리
UNVERIFIABLE_POLICY = "approve"


def get_challenge_limit(challenge: DailyChallenge) -> Tuple[Optional[int], str]:
    """
    챌린지의 '하루 지출 한도'와 검증 모드를 돌려준다.

    반환: (limit, mode)
      mode == "no_spend"     : 한도 0원 -> 지출이 0원이어야 달성 (금지형 / streak형 / daily_limit==0)
      mode == "limit"        : 지출 합계 <= limit 이어야 달성
      mode == "unverifiable" : 한도 정보가 없어 검증 불가 (limit은 None)

    한도는 ai_metadata["daily_limit"] 에 저장돼 있다. (AI 파트가 '달성 자동 판정에도 활용 가능'하다고
    남겨둔 필드) 별도 컬럼은 없으므로 새 컬럼을 만들지 않고 이 값을 그대로 읽는다.
    """
    meta = challenge.ai_metadata or {}

    # streak형(무지출 연속 챌린지)은 daily_limit 없이 '무지출'이 조건이다.
    if meta.get("challenge_origin") == "streak" or challenge.challenge_type == "streak형":
        return 0, "no_spend"

    raw = meta.get("daily_limit")
    if raw is not None:
        try:
            limit = int(round(float(raw)))
        except (TypeError, ValueError):
            return None, "unverifiable"
        return limit, ("no_spend" if limit <= 0 else "limit")

    # daily_limit 이 없어도 금지형이면 정의상 무지출이다.
    if challenge.challenge_type == "금지형":
        return 0, "no_spend"

    return None, "unverifiable"


def get_spent_on_date(
    session: Session, user_id: str, category_name: str, target_date: date
) -> int:
    """
    챌린지 대상 날짜(target_date)의 해당 카테고리 지출 합계.

    집계 규칙은 리포트/AI 엔진과 동일하다: Transaction.final_category 기준, amount 단순 합.
    (현재 Transaction에는 취소/환불/수입을 구분하는 필드가 없다. '수익 제외' 처리가 생기면
     이 함수 한 곳과 리포트 집계를 같이 고치면 된다.)
    """
    amounts = session.exec(
        select(Transaction.amount)
        .where(Transaction.user_id == user_id)
        .where(Transaction.tx_date == target_date)
        .where(Transaction.final_category == category_name)
    ).all()
    return int(sum(amounts))


def evaluate_challenge(challenge: DailyChallenge, spent: int) -> Tuple[bool, dict]:
    """지출 합계와 챌린지 조건을 비교해 (달성 여부, 검증 결과 기록)을 돌려준다."""
    limit, mode = get_challenge_limit(challenge)

    if mode == "unverifiable":
        passed = UNVERIFIABLE_POLICY == "approve"
    else:
        passed = spent <= limit  # 미사용(limit=0)도 '합계 <= 0'으로 같은 규칙

    result = {
        "result": STATUS_SUCCESS if passed else STATUS_FAILED,
        "mode": mode,
        "target_date": challenge.challenge_date.isoformat(),  # 지출을 조회한 날짜
        "category": challenge.category_name,
        "spent": spent,
        "limit": limit,
        "unverifiable_policy": UNVERIFIABLE_POLICY if mode == "unverifiable" else None,
        "verified_at": kst_now().isoformat(),
    }
    return passed, result


def _verify_one(session: Session, challenge_id: int, today: date) -> Optional[str]:
    """
    챌린지 하나를 정산한다. 정산했으면 "SUCCESS"/"FAILED", 대상이 아니거나
    다른 프로세스가 처리 중이면 None.
    """
    # 1) 챌린지 행 잠금. 상태/날짜 조건을 잠금과 같은 쿼리에 넣어서
    #    이미 처리된 챌린지나 취소된 챌린지는 여기서 걸러진다.
    challenge = session.exec(
        select(DailyChallenge)
        .where(DailyChallenge.challenge_id == challenge_id)
        .where(DailyChallenge.status == STATUS_VERIFYING)
        .where(DailyChallenge.challenge_date < today)
        .with_for_update(skip_locked=True)
    ).first()
    if challenge is None:
        return None

    # 2) 보상 대상 유저 행 잠금 (같은 유저의 XP/포인트 동시 갱신 방지)
    user = session.exec(
        select(User).where(User.user_id == challenge.user_id).with_for_update()
    ).first()
    if user is None:
        logger.error("검증 건너뜀: 유저 없음 challenge_id=%s", challenge_id)
        return None

    owner_id = challenge.user_id
    target_date = challenge.challenge_date

    # 3) '챌린지에 설정된 대상 날짜'의 지출로 판정 (실행일/생성일 아님)
    spent = get_spent_on_date(session, owner_id, challenge.category_name, target_date)
    passed, result = evaluate_challenge(challenge, spent)

    challenge.verification_result = result
    if passed:
        challenge.status = STATUS_SUCCESS
        challenge.completed_at = kst_now_naive()
        session.add(challenge)
        # 기존 보상 로직 재사용. commit=False 라서 상태 변경과 보상이 아래 커밋 한 번으로 같이 확정된다.
        level_result = process_challenge_completion(
            session, user, challenge.xp_reward, commit=False
        )
        challenge.reward_snapshot = level_result
        session.add(challenge)
    else:
        challenge.status = STATUS_FAILED
        session.add(challenge)

    session.commit()

    # 4) 이 날짜가 포함된 리포트 캐시 무효화.
    #    (정산 전에 이미 캐싱된 '끝난 기간' 리포트가 챌린지 성과를 못 담은 채 굳는 것을 방지)
    invalidate_reports_containing_date(session, owner_id, target_date)

    outcome = STATUS_SUCCESS if passed else STATUS_FAILED
    logger.info(
        "챌린지 정산 challenge_id=%s date=%s spent=%s limit=%s -> %s",
        challenge_id, target_date, spent, result["limit"], outcome,
    )
    return outcome


def verify_pending_challenges(
    today: Optional[date] = None,
    user_id: Optional[str] = None,
    db_engine=None,
) -> dict:
    """
    challenge_date < today(KST) 인 VERIFYING 챌린지를 전부 정산한다.

    - 여러 번 실행해도, 늦게 실행해도 안전하다 (이미 정산된 챌린지는 대상에서 빠짐).
    - today 를 직접 넘기면 그 날짜 기준으로 동작한다. (테스트/수동 실행용)
    - user_id 를 넘기면 그 유저의 챌린지만 처리한다. (사용자 접속 시 보정용)
    """
    today = today or kst_today()
    eng = db_engine or default_engine

    with Session(eng) as session:
        query = (
            select(DailyChallenge.challenge_id)
            .where(DailyChallenge.status == STATUS_VERIFYING)
            .where(DailyChallenge.challenge_date < today)
        )
        if user_id:
            query = query.where(DailyChallenge.user_id == user_id)
        # 오래된 날짜부터 처리해야 레벨업/마일스톤이 시간순으로 반영된다.
        challenge_ids = session.exec(
            query.order_by(DailyChallenge.challenge_date, DailyChallenge.challenge_id)
        ).all()

    summary = {
        "as_of": today.isoformat(),
        "found": len(challenge_ids),
        "succeeded": 0,
        "failed": 0,
        "skipped": 0,
        "errors": 0,
    }

    for challenge_id in challenge_ids:
        try:
            # 챌린지마다 새 세션 = 새 트랜잭션. 하나가 터져도 다른 챌린지는 영향 없음.
            with Session(eng) as session:
                outcome = _verify_one(session, challenge_id, today)
        except Exception:
            logger.exception("챌린지 정산 중 오류 challenge_id=%s", challenge_id)
            summary["errors"] += 1
            continue

        if outcome == STATUS_SUCCESS:
            summary["succeeded"] += 1
        elif outcome == STATUS_FAILED:
            summary["failed"] += 1
        else:
            summary["skipped"] += 1

    return summary


def verify_pending_challenges_safely(user_id: str) -> Optional[dict]:
    """
    조회 API(/challenges/today 등)에서 부르는 보정용 래퍼.
    스케줄러가 못 돌았더라도 사용자가 앱을 열면 그 사용자의 밀린 정산이 처리된다.
    어떤 이유로든 실패해도 조회 API 자체는 절대 깨지지 않게 예외를 삼킨다.
    """
    try:
        return verify_pending_challenges(user_id=user_id)
    except Exception:
        logger.exception("보정용 챌린지 정산 실패 user_id=%s", user_id)
        return None
