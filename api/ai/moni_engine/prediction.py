"""
prediction.py
=============

카테고리별 이번 달 월말 예상 지출 계산 + 예산 압박도 계산.

핵심 함수:
    predict_monthly_spend(daily_df, target_date)
        → 예측 결과 dict (model_used, predicted_monthly_spend, ...)
    calculate_budget_pressure(predicted_monthly_spend, budget_limit)
        → float

예측 정의
----------
predicted_monthly_spend
    = 이번 달 1일~target_date까지의 실제 소비 (month_to_date_actual)
    + target_date+1 ~ 이번 달 말일까지의 예측 소비 (predicted_remaining_spend)

모델 선택
----------
- nonzero_ratio >= 0.15 AND data_points >= 30  → Prophet
- 그 외 (sparse 카테고리, 데이터 부족)         → simple_average
"""

from __future__ import annotations

import warnings
from datetime import date, timedelta
from typing import Optional, Tuple

import numpy as np
import pandas as pd

from api.ai.moni_engine.preprocessing import _coerce_date


# Prophet의 로그/경고가 시끄러우므로 끈다
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)


# 모델 선택 기준
MIN_DATA_POINTS_FOR_PROPHET = 30
MIN_NONZERO_RATIO_FOR_PROPHET = 0.15


def get_current_month_window(target_date) -> Tuple[date, date]:
    """
    target_date가 속한 캘린더 월의 (month_start, month_end)을 반환.

    MVP 정책: 캘린더 월 기준 (1일~말일).
    payday 기반 월 계산은 후속 확장 사항.
    """
    target_date = _coerce_date(target_date)
    month_start = target_date.replace(day=1)
    # 다음 달 1일에서 하루 빼면 이번 달 말일
    if month_start.month == 12:
        next_month = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month = month_start.replace(month=month_start.month + 1)
    month_end = next_month - timedelta(days=1)
    return month_start, month_end


def _predict_with_prophet(daily_df: pd.DataFrame, periods: int) -> dict:
    """Prophet으로 향후 periods일 예측. 결과는 yhat sum 등 dict로 반환."""
    from prophet import Prophet  # 무거우므로 lazy import

    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=False,
        changepoint_prior_scale=0.08,
        seasonality_mode="additive",
    )
    # Prophet은 stdout으로 시끄러우므로 가능한 한 조용히
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model.fit(daily_df[["ds", "y"]])
        future = model.make_future_dataframe(periods=periods, freq="D")
        forecast = model.predict(future)

    future_part = forecast.tail(periods)
    # Prophet은 sparse data에서 음수 yhat을 뱉을 수 있음 → 0으로 clip
    yhat = np.clip(future_part["yhat"].values, 0, None)
    yhat_lower = np.clip(future_part["yhat_lower"].values, 0, None)
    yhat_upper = np.clip(future_part["yhat_upper"].values, 0, None)

    return {
        "predicted_remaining_spend": float(yhat.sum()),
        "forecast_lower": float(yhat_lower.sum()),
        "forecast_upper": float(yhat_upper.sum()),
    }


def _predict_with_simple_average(daily_df: pd.DataFrame, periods: int) -> dict:
    """
    Prophet이 적합하지 않은 sparse / 데이터 부족 카테고리용 단순 예측.

    전략: 최근 30일 (또는 가능한 만큼) 일평균을 잔여일수에 곱한다.
    음수가 나올 일이 없고 빠르다.
    """
    if daily_df.empty:
        return {
            "predicted_remaining_spend": 0.0,
            "forecast_lower": 0.0,
            "forecast_upper": 0.0,
        }

    recent_window = min(30, len(daily_df))
    daily_avg = float(daily_df["y"].tail(recent_window).mean())
    daily_std = float(daily_df["y"].tail(recent_window).std() or 0.0)

    predicted = daily_avg * periods
    lower = max(0.0, predicted - daily_std * np.sqrt(periods))
    upper = predicted + daily_std * np.sqrt(periods)

    return {
        "predicted_remaining_spend": predicted,
        "forecast_lower": lower,
        "forecast_upper": upper,
    }


def predict_monthly_spend(
    daily_df: pd.DataFrame,
    target_date,
    month_to_date_actual: float,
) -> dict:
    """
    이번 달 월말 예상 지출을 계산한다.

    Parameters
    ----------
    daily_df : pd.DataFrame
        preprocessing.make_daily_series() 결과. columns: ds, y
        target_date의 전날까지 포함.
    target_date : date | str
        챌린지 생성 기준 날짜 (KST). 입력은 KST date.
    month_to_date_actual : float
        이번 달 1일~target_date까지 실제 소비액.
        (preprocessing.get_month_to_date_actual()으로 별도 계산)

    Returns
    -------
    dict
        {
            "predicted_monthly_spend": float,
            "month_to_date_actual": float,
            "predicted_remaining_spend": float,
            "forecast_lower": float,        # 월말 예상 지출의 하한
            "forecast_upper": float,        # 월말 예상 지출의 상한
            "model_used": "prophet" | "simple_average" | "no_data",
            "data_points_used": int,
            "nonzero_ratio": float,
            "month_start_date": "YYYY-MM-DD",
            "month_end_date": "YYYY-MM-DD",
            "days_remaining_in_month": int,
            "month_progress_ratio": float,  # 0.0 ~ 1.0
        }
    """
    target_date = _coerce_date(target_date)
    month_start, month_end = get_current_month_window(target_date)

    # target_date 다음 날부터 월말까지가 "잔여 예측 구간"
    days_remaining = (month_end - target_date).days
    if days_remaining < 0:
        days_remaining = 0

    total_days_in_month = (month_end - month_start).days + 1
    elapsed_days = (target_date - month_start).days + 1
    month_progress_ratio = elapsed_days / total_days_in_month

    data_points = len(daily_df)
    nonzero_ratio = float((daily_df["y"] > 0).mean()) if data_points > 0 else 0.0

    # ---- 모델 선택 ----
    if data_points == 0:
        model_used = "no_data"
        forecast = {"predicted_remaining_spend": 0.0,
                    "forecast_lower": 0.0,
                    "forecast_upper": 0.0}
    elif (data_points >= MIN_DATA_POINTS_FOR_PROPHET
          and nonzero_ratio >= MIN_NONZERO_RATIO_FOR_PROPHET
          and days_remaining > 0):
        try:
            forecast = _predict_with_prophet(daily_df, days_remaining)
            model_used = "prophet"
        except Exception:
            # Prophet이 예외를 뱉으면 simple_average로 안전 폴백
            forecast = _predict_with_simple_average(daily_df, days_remaining)
            model_used = "simple_average"
    else:
        forecast = _predict_with_simple_average(daily_df, days_remaining)
        model_used = "simple_average"

    predicted_remaining = forecast["predicted_remaining_spend"]
    predicted_monthly = month_to_date_actual + predicted_remaining

    return {
        "predicted_monthly_spend": float(predicted_monthly),
        "month_to_date_actual": float(month_to_date_actual),
        "predicted_remaining_spend": float(predicted_remaining),
        "forecast_lower": float(month_to_date_actual + forecast["forecast_lower"]),
        "forecast_upper": float(month_to_date_actual + forecast["forecast_upper"]),
        "model_used": model_used,
        "data_points_used": int(data_points),
        "nonzero_ratio": float(nonzero_ratio),
        "month_start_date": month_start.isoformat(),
        "month_end_date": month_end.isoformat(),
        "days_remaining_in_month": int(days_remaining),
        "month_progress_ratio": float(month_progress_ratio),
    }


def calculate_budget_pressure(
    predicted_monthly_spend: float, budget_limit: float
) -> float:
    """
    예산 압박도 = 예상 월 지출 / 월 예산.

    예: predicted=70000, budget=30000 → 2.333 (예산 233% 수준)
    """
    if budget_limit is None or budget_limit <= 0:
        return float("inf")
    return float(predicted_monthly_spend) / float(budget_limit)
