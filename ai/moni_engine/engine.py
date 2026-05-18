"""
engine.py
=========

백엔드가 호출하는 단일 진입점.

핵심 함수:
    get_today_challenge(transactions_df, user_profile, category_settings_df, target_date)
        → Daily_Challenges 테이블에 저장 가능한 JSON dict (혹은 None)

흐름
----
1. category_settings_df에서 is_daily_challenge=True 카테고리만 추린다.
2. 각 카테고리에 대해:
   a. daily series 생성 (preprocessing.make_daily_series)
   b. month_to_date_actual 계산
   c. 월말 예상 지출 예측 (prediction.predict_monthly_spend)
   d. 예산 압박도 계산
3. 후보 중 압박도가 가장 높은 카테고리 하나를 선택.
   tie-breaking: pressure desc → budget_limit asc → category_name 알파벳순
4. 챌린지 생성 (challenge.generate_challenge)
5. Daily_Challenges 테이블 컬럼 + ai_metadata JSON으로 묶어 반환.

반환 규약
---------
- 정상: dict (Daily_Challenges INSERT용)
- 챌린지 가능 카테고리 없음 / 데이터 없음: None
"""

from __future__ import annotations

from datetime import date
from typing import Optional

import pandas as pd

from moni_engine.preprocessing import (
    _coerce_date,
    make_daily_series,
    get_month_to_date_actual,
    has_category_correction,
)
from moni_engine.prediction import (
    predict_monthly_spend,
    calculate_budget_pressure,
)
from moni_engine.challenge import generate_challenge


SCHEMA_VERSION = "1.0"


def _evaluate_category(
    transactions_df: pd.DataFrame,
    user_id: str,
    category_name: str,
    budget_limit: float,
    target_date: date,
    valid_data_start_date=None,
) -> dict:
    """한 카테고리에 대해 daily series + 예측 + 압박도까지 계산."""
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
    forecast = predict_monthly_spend(
        daily_df=daily_df,
        target_date=target_date,
        month_to_date_actual=mtd_actual,
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

    return {
        "category_name": category_name,
        "budget_limit": float(budget_limit),
        "budget_pressure": float(pressure),
        "category_correction_applied": correction,
        **forecast,
    }


def get_today_challenge(
    transactions_df: pd.DataFrame,
    user_profile: dict,
    category_settings_df: pd.DataFrame,
    target_date,
) -> Optional[dict]:
    """
    오늘의 챌린지를 생성한다.

    Parameters
    ----------
    transactions_df : pd.DataFrame
        Transactions 테이블 결과. 컬럼:
            user_id, tx_date, tx_time, amount, merchant_name,
            mydata_category, final_category, is_user_corrected
        (AI 엔진은 user_id, tx_date, amount, final_category, is_user_corrected만 사용)
    user_profile : dict
        Users 테이블에서 가져온 단일 행. 키:
            user_id, spend_profile, payday, valid_data_start_date 등
    category_settings_df : pd.DataFrame
        User_Category_Settings 테이블 결과. 컬럼:
            user_id, category_name, budget_limit, is_daily_challenge, alert_threshold
    target_date : date | str
        챌린지 생성 기준 날짜 (KST 기준 date 권장).

    Returns
    -------
    dict | None
        Daily_Challenges INSERT용 dict.
        is_daily_challenge=True 카테고리가 하나도 없거나, 모든 카테고리에
        거래 데이터가 전혀 없으면 None을 반환한다.
    """
    user_id = user_profile["user_id"]
    target_date = _coerce_date(target_date)
    valid_data_start_date = user_profile.get("valid_data_start_date")
    # CSV 등에서 NaN/None 모두 안전하게 처리
    if valid_data_start_date is None or pd.isna(valid_data_start_date):
        valid_data_start_date = None

    # ---- 1. is_daily_challenge=True 카테고리만 추출 ----
    candidates = category_settings_df[
        (category_settings_df["user_id"] == user_id)
        & (category_settings_df["is_daily_challenge"] == True)  # noqa: E712
    ]
    if candidates.empty:
        return None

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
            # 한 카테고리가 실패해도 다른 카테고리는 계속 평가
            ev = {
                "category_name": row["category_name"],
                "budget_limit": float(row["budget_limit"]),
                "budget_pressure": 0.0,
                "predicted_monthly_spend": 0.0,
                "model_used": "error",
                "error_msg": str(e),
            }
        evaluations.append(ev)

    # ---- 3. 평가 결과가 모두 no_data면 None ----
    has_any_data = any(
        ev.get("model_used") not in (None, "no_data", "error")
        or ev.get("month_to_date_actual", 0) > 0
        for ev in evaluations
    )
    if not has_any_data:
        return None

    # ---- 4. tie-breaking: pressure desc → budget_limit asc → name asc ----
    evaluations.sort(
        key=lambda e: (
            -e["budget_pressure"],
            e["budget_limit"],
            e["category_name"],
        )
    )
    winner = evaluations[0]

    # ---- 5. 챌린지 생성 ----
    challenge = generate_challenge(
        category_name=winner["category_name"],
        budget_limit=winner["budget_limit"],
        predicted_monthly_spend=winner["predicted_monthly_spend"],
        budget_pressure=winner["budget_pressure"],
        month_progress_ratio=winner.get("month_progress_ratio"),
    )

    # ---- 6. Daily_Challenges 컬럼 + ai_metadata로 묶기 ----
    return {
        # Daily_Challenges 직접 컬럼
        "user_id": user_id,
        "category_name": winner["category_name"],
        "challenge_date": target_date.isoformat(),
        "challenge_type": challenge["challenge_type"],
        "challenge_text": challenge["challenge_text"],
        "difficulty": challenge["difficulty"],
        "status": "PENDING",
        "xp_reward": challenge["xp_reward"],

        # JSON 컬럼 (ai_metadata)
        "ai_metadata": {
            "schema_version": SCHEMA_VERSION,
            "budget_limit": winner["budget_limit"],
            "predicted_monthly_spend": winner["predicted_monthly_spend"],
            "month_to_date_actual": winner["month_to_date_actual"],
            "predicted_remaining_spend": winner["predicted_remaining_spend"],
            "forecast_lower": winner["forecast_lower"],
            "forecast_upper": winner["forecast_upper"],
            "budget_pressure": round(winner["budget_pressure"], 4),
            "model_used": winner["model_used"],
            "data_points_used": winner["data_points_used"],
            "nonzero_ratio": round(winner["nonzero_ratio"], 4),
            "month_start_date": winner["month_start_date"],
            "month_end_date": winner["month_end_date"],
            "days_remaining_in_month": winner["days_remaining_in_month"],
            "month_progress_ratio": round(winner["month_progress_ratio"], 4),
            "category_correction_applied": winner["category_correction_applied"],
            "reason": challenge["reason"],
            "evaluated_categories": [
                {
                    "category_name": e["category_name"],
                    "budget_pressure": round(e["budget_pressure"], 4),
                    "model_used": e.get("model_used", "unknown"),
                }
                for e in evaluations
            ],
        },
    }
