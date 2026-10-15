from datetime import date, datetime

from sqlalchemy import text
from sqlmodel import Session


def make_fallback_challenge(user_id: str, target_date: date):
    return {
        "user_id": user_id,
        "category_name": "카페",
        "challenge_date": target_date,
        "challenge_type": "제한형",
        "challenge_text": "오늘은 카페 지출을 한 번만 줄여보세요.",
        "difficulty": "Easy",
        "status": "PENDING",
        "xp_reward": 10,
        "ai_metadata": {
            "model_version": "fallback-v1",
            "generated_at": datetime.now().isoformat(),
            "budget_limit": 30000,
            "month_to_date_actual": 0,
            "predicted_remaining_spend": 0,
            "predicted_monthly_spend": 0,
            "budget_pressure": 1,
            "evaluated_categories": [
                {
                    "category_name": "카페",
                    "budget_pressure": 1,
                    "budget_limit": 30000,
                    "predicted_monthly_spend": 0,
                    "rank": 1,
                }
            ],
        },
    }


def serialize_generation(session: Session, user_id: str, target_date: date) -> None:
    """
    같은 유저 + 같은 날짜의 챌린지 생성/교체를 한 줄로 세운다. (Postgres 트랜잭션 단위 advisory lock)

    챌린지 생성은 AI 예측 + LLM 문구 생성 때문에 몇 초 걸린다. 그 사이에 같은 작업이 한 번 더 들어오면
    (홈/챌린지 탭 동시 진입, 재시도, 예산 수정에 따른 재생성 등) 둘 다 같은 판단을 하고 둘 다 저장해 버린다.
    잠금은 이 트랜잭션이 끝나면(커밋/롤백/세션 종료) 자동으로 풀리므로 연결 풀러(pgbouncer)에서도 안전하다.

    주의: 이 호출 '이후'에 session.commit() 이 한 번이라도 일어나면 잠금이 풀린다.
    (ensure_default_category_settings 처럼 내부에서 commit 하는 함수는 반드시 이 호출 앞에 둘 것)
    """
    if session.get_bind().dialect.name != "postgresql":
        return  # SQLite(테스트 등)에는 advisory lock 이 없다
    key = f"challenge-generate:{user_id}:{target_date.isoformat()}"
    session.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": key})
