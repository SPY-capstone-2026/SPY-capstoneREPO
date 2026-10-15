import logging
import os
import secrets
from datetime import date
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

from services.challenge_verification_service import verify_pending_challenges

logger = logging.getLogger(__name__)

# 외부 스케줄러(GitHub Actions / Render Cron / Supabase pg_cron 등)가 호출하는 내부용 API.
# 일반 사용자 JWT가 아니라 서버 환경변수 CRON_SECRET 으로 보호한다.
router = APIRouter(prefix="/internal", tags=["internal"])


def _check_cron_secret(provided: Optional[str]) -> None:
    expected = os.getenv("CRON_SECRET")

    # 비밀키가 설정 안 된 환경에서는 아무도 호출하지 못하게 막아둔다. (실수로 열려 있는 것 방지)
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="CRON_SECRET 환경변수가 설정되지 않아 비활성화된 엔드포인트입니다",
        )

    if not provided or not secrets.compare_digest(provided.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="인증에 실패했습니다")


@router.post("/challenges/verify")
def run_challenge_verification(
    as_of: Optional[date] = Query(
        None,
        description="테스트/시연용. 이 날짜를 '오늘'로 보고 정산한다. 비우면 KST 오늘.",
    ),
    user_id: Optional[str] = Query(
        None,
        description="수동 실행 시 이 유저의 챌린지만 정산한다. as_of 를 쓸 땐 반드시 같이 줄 것.",
    ),
    x_cron_secret: Optional[str] = Header(None),
):
    """
    검증 대기(VERIFYING) 챌린지 정산. 매일 KST 자정 직후에 호출한다.
    여러 번 호출하거나 늦게 호출해도 안전하다(이미 정산된 챌린지는 건너뜀).
    """
    _check_cron_secret(x_cron_secret)

    if as_of is not None:
        logger.warning("챌린지 정산을 as_of=%s, user_id=%s 로 수동 실행합니다", as_of, user_id)

    summary = verify_pending_challenges(today=as_of, user_id=user_id)
    if user_id:
        summary = {**summary, "user_id": user_id}
    return {"status": "success", "data": summary}
