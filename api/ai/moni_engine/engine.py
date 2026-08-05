"""
engine.py
=========

백엔드가 호출하는 단일 진입점.

핵심 함수:
    get_today_challenges(transactions_df, user_profile, category_settings_df, target_date)
        → Daily_Challenges 테이블에 저장 가능한 JSON dict들의 list (최대 4개)

챌린지 생성 정책 (C안)
----------------------
1. is_daily_challenge=True 카테고리만 평가
2. 각 카테고리의 예산 압박도 + 무지출 streak 계산
3. 압박도 상위 3개 카테고리 → 압박도 챌린지 각 1개 (최대 3개)
4. streak 자격을 갖춘 카테고리 중 streak이 가장 긴 1개 → 보너스 챌린지 1개
5. 총 최대 4개의 챌린지를 list로 반환

반환 규약
---------
- 정상: list[dict] (1~4개)
- 챌린지 가능 카테고리 없음 / 데이터 없음: 빈 list []
"""

from __future__ import annotations

from datetime import date
from typing import List, Optional

import pandas as pd

from moni_engine.preprocessing import (
    _coerce_date,
    make_daily_series,
    get_month_to_date_actual,
    has_category_correction,
    compute_no_spend_streak,
    get_transaction_count,
)
from moni_engine.prediction import (
    predict_monthly_spend,
    calculate_budget_pressure,
)
from moni_engine.challenge import (
    generate_challenge,
    generate_streak_challenge,
    streak_qualifies,
)


SCHEMA_VERSION = "1.2"   # 1.0 → 1.1: 다건 반환 + streak 챌린지 추가 / 1.2: ai_metadata에 predicted_today 추가
MAX_PRESSURE_CHALLENGES = 3   # 압박도 챌린지 최대 개수
MAX_STREAK_BONUSES = 1        # streak 보너스 최대 개수 (C안)


def _evaluate_category(
    transactions_df: pd.DataFrame,
    user_id: str,
    category_name: str,
    budget_limit: float,
    target_date: date,
    valid_data_start_date=None,
) -> dict:
    """한 카테고리에 대해 daily series + 예측 + 압박도 + streak까지 계산."""
    daily_df = make_daily_series(
        transactions_df=transactions_df,
        user_id=user_id,
        category_name=category_name,
        target_date=target_date,
        valid_data_start_date=valid_data_start_date,
    )
    mtd_actual = get_month_to_date_actual(
        transactions_df=transactions_df,
        user_id=user_id,
        category_name=category_name,
        target_date=target_date,
    )

    tx_count = get_transaction_count(
        transactions_df, user_id, category_name, target_date, valid_data_start_date=valid_data_start_date,
        )

    forecast = predict_monthly_spend(
        daily_df=daily_df,
        target_date=target_date,
        month_to_date_actual=mtd_actual,
        tx_count=tx_count,
    )
    pressure = calculate_budget_pressure(
        predicted_monthly_spend=forecast["predicted_monthly_spend"],
        budget_limit=budget_limit,
    )
    correction = has_category_correction(
        transactions_df=transactions_df,
        user_id=user_id,
        category_name=category_name,
    )
    streak = compute_no_spend_streak(daily_df, target_date)

    return {
        "category_name": category_name,
        "budget_limit": float(budget_limit),
        "budget_pressure": float(pressure),
        "category_correction_applied": correction,
        "no_spend_streak": int(streak),
        **forecast,
    }


def _build_pressure_challenge(ev: dict, user_id: str, target_date: date) -> dict:
    """평가 결과 → 압박도 챌린지 Daily_Challenges row."""
    challenge = generate_challenge(
        category_name=ev["category_name"],
        budget_limit=ev["budget_limit"],
        predicted_monthly_spend=ev["predicted_monthly_spend"],
        budget_pressure=ev["budget_pressure"],
        month_progress_ratio=ev.get("month_progress_ratio"),
    )
    return {
        "user_id": user_id,
        "category_name": ev["category_name"],
        "challenge_date": target_date.isoformat(),
        "challenge_type": challenge["challenge_type"],
        "challenge_text": challenge["challenge_text"],
        "difficulty": challenge["difficulty"],
        "status": "PENDING",
        "xp_reward": challenge["xp_reward"],
        "ai_metadata": {
            "schema_version": SCHEMA_VERSION,
            "challenge_origin": "pressure",
            "budget_limit": ev["budget_limit"],
            "predicted_monthly_spend": ev["predicted_monthly_spend"],
            "predicted_today": ev.get("predicted_today", 0.0),
            "month_to_date_actual": ev["month_to_date_actual"],
            "predicted_remaining_spend": ev["predicted_remaining_spend"],
            "forecast_lower": ev["forecast_lower"],
            "forecast_upper": ev["forecast_upper"],
            "budget_pressure": round(ev["budget_pressure"], 4),
            "model_used": ev["model_used"],
            "data_points_used": ev["data_points_used"],
            "nonzero_ratio": round(ev["nonzero_ratio"], 4),
            "no_spend_streak": ev["no_spend_streak"],
            "month_start_date": ev["month_start_date"],
            "month_end_date": ev["month_end_date"],
            "days_remaining_in_month": ev["days_remaining_in_month"],
            "month_progress_ratio": round(ev["month_progress_ratio"], 4),
            "category_correction_applied": ev["category_correction_applied"],
            "reason": challenge["reason"],
        },
    }


def _build_streak_challenge(ev: dict, user_id: str, target_date: date) -> dict:
    """평가 결과 → streak 보너스 챌린지 Daily_Challenges row."""
    challenge = generate_streak_challenge(
        category_name=ev["category_name"],
        streak_count=ev["no_spend_streak"],
    )
    return {
        "user_id": user_id,
        "category_name": ev["category_name"],
        "challenge_date": target_date.isoformat(),
        "challenge_type": challenge["challenge_type"],
        "challenge_text": challenge["challenge_text"],
        "difficulty": challenge["difficulty"],
        "status": "PENDING",
        "xp_reward": challenge["xp_reward"],
        "ai_metadata": {
            "schema_version": SCHEMA_VERSION,
            "challenge_origin": "streak",
            "no_spend_streak": ev["no_spend_streak"],
            "nonzero_ratio": round(ev["nonzero_ratio"], 4),
            "model_used": ev["model_used"],
            "reason": challenge["reason"],
        },
    }


def get_today_challenges(
    transactions_df: pd.DataFrame,
    user_profile: dict,
    category_settings_df: pd.DataFrame,
    target_date,
) -> List[dict]:
    """
    오늘의 챌린지들을 생성한다 (최대 4개).

    Parameters
    ----------
    transactions_df : pd.DataFrame
        Transactions 테이블 결과. 컬럼:
            user_id, tx_date, tx_time, amount, merchant_name,
            mydata_category, final_category, is_user_corrected
    user_profile : dict
        Users 테이블에서 가져온 단일 행.
    category_settings_df : pd.DataFrame
        User_Category_Settings 테이블 결과.
    target_date : date | str
        챌린지 생성 기준 날짜 (KST 기준 date 권장).

    Returns
    -------
    list[dict]
        Daily_Challenges INSERT용 dict들의 리스트 (1~4개).
        압박도 챌린지 최대 3개 + streak 보너스 최대 1개.
        챌린지 가능 카테고리가 없거나 거래 데이터가 전혀 없으면 빈 리스트 [].
    """
    user_id = user_profile["user_id"]
    target_date = _coerce_date(target_date)
    valid_data_start_date = user_profile.get("valid_data_start_date")
    if valid_data_start_date is None or pd.isna(valid_data_start_date):
        valid_data_start_date = None

    # ---- 1. is_daily_challenge=True 카테고리만 추출 ----
    candidates = category_settings_df[
        (category_settings_df["user_id"] == user_id)
        & (category_settings_df["is_daily_challenge"] == True)  # noqa: E712
    ]
    if candidates.empty:
        return []

    # ---- 2. 각 카테고리 평가 ----
    evaluations = []
    for _, row in candidates.iterrows():
        try:
            ev = _evaluate_category(
                transactions_df=transactions_df,
                user_id=user_id,
                category_name=row["category_name"],
                budget_limit=row["budget_limit"],
                target_date=target_date,
                valid_data_start_date=valid_data_start_date,
            )
        except Exception as e:
            ev = {
                "category_name": row["category_name"],
                "budget_limit": float(row["budget_limit"]),
                "budget_pressure": 0.0,
                "predicted_monthly_spend": 0.0,
                "no_spend_streak": 0,
                "nonzero_ratio": 0.0,
                "model_used": "error",
                "error_msg": str(e),
            }
        evaluations.append(ev)

    # ---- 3. 데이터가 전혀 없으면 빈 리스트 ----
    has_any_data = any(
        ev.get("model_used") not in (None, "no_data", "error")
        or ev.get("month_to_date_actual", 0) > 0
        for ev in evaluations
    )
    if not has_any_data:
        return []

    # ---- 4. 압박도 챌린지: 상위 3개 ----
    # tie-breaking: pressure desc → budget_limit asc → name asc
    pressure_sorted = sorted(
        evaluations,
        key=lambda e: (-e["budget_pressure"], e["budget_limit"], e["category_name"]),
    )
    top_pressure = pressure_sorted[:MAX_PRESSURE_CHALLENGES]

    challenges = [
        _build_pressure_challenge(ev, user_id, target_date)
        for ev in top_pressure
    ]

    # ---- 5. streak 보너스 챌린지: 자격 있는 것 중 streak 가장 긴 1개 ----
    streak_eligible = [
        ev for ev in evaluations
        if streak_qualifies(ev.get("no_spend_streak", 0), ev.get("nonzero_ratio", 0.0))
    ]
    if streak_eligible:
        # streak 내림차순 → nonzero_ratio 내림차순 → name asc
        streak_eligible.sort(
            key=lambda e: (-e["no_spend_streak"], -e["nonzero_ratio"], e["category_name"])
        )
        streak_winner = streak_eligible[0]
        streak_challenge = _build_streak_challenge(streak_winner, user_id, target_date)

        # 후보 비교 정보를 첫 챌린지 메타에 남겨 디버깅/발표에 활용
        challenges.append(streak_challenge)

    # ---- 6. 후보 카테고리 요약을 첫 챌린지 메타에 첨부 ----
    if challenges:
        challenges[0]["ai_metadata"]["evaluated_categories"] = [
            {
                "category_name": e["category_name"],
                "budget_pressure": round(e.get("budget_pressure", 0.0), 4),
                "no_spend_streak": e.get("no_spend_streak", 0),
                "model_used": e.get("model_used", "unknown"),
            }
            for e in pressure_sorted
        ]

    return challenges


# ------------------------------------------------------------
# 하위 호환: 단건이 필요한 경우 (선택적). 신규 코드는 get_today_challenges 사용 권장.
# ------------------------------------------------------------
def get_today_challenge(
    transactions_df: pd.DataFrame,
    user_profile: dict,
    category_settings_df: pd.DataFrame,
    target_date,
) -> Optional[dict]:
    """
    [DEPRECATED] 단일 챌린지만 반환하던 구버전 인터페이스.
    내부적으로 get_today_challenges()를 호출해 첫 번째(최고 압박도) 챌린지를 반환.
    신규 연동은 get_today_challenges()를 사용할 것.
    """
    results = get_today_challenges(
        transactions_df, user_profile, category_settings_df, target_date
    )
    return results[0] if results else None
