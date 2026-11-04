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
- data_points >= 90 AND (nonzero_ratio >= 0.2 or tx_count>=50) → LSTM
- 그 외 (sparse 카테고리, 데이터 부족)         → simple_average
"""

from __future__ import annotations

import warnings
from datetime import date, timedelta
from typing import Optional, Tuple

import numpy as np
import pandas as pd

from moni_engine.preprocessing import _coerce_date


# Prophet의 로그/경고가 시끄러우므로 끈다
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)


# 모델 선택 기준
MIN_DATA_POINTS_FOR_LSTM = 90       # 30 → 90
MIN_NONZERO_RATIO_FOR_LSTM = 0.2    # 0.15 → 0.2
MIN_TX_COUNT_FOR_LSTM = 50          # 신규: 총거래횟수 OR 조건


# ARIMA 차수. (p, d, q) = (자기회귀, 차분, 이동평균)
ARIMA_ORDER = (7, 0, 1)
ARIMA_FALLBACK_ORDER = (1, 0, 0)    # 적합 실패 시 단순 차수로 재시도

# 예측 상한 가드 — 평균 성능 개선용이 아니라 '재앙 방지' 보험.
ARIMA_GUARD_MULTIPLE = 20.0

MIN_POINTS_FOR_ARIMA = 40           # 그 미만이면 단순평균



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

"""
def _predict_with_lstm(daily_df: pd.DataFrame, periods: int) -> dict:
    LSTM으로 향후 periods일 예측. 매번 새로 학습.
    import os
    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
    import tensorflow as tf
    tf.get_logger().setLevel("ERROR")
    tf.random.set_seed(42)   # 재현성 (팀 결정 필요 - 아래 설명)
    np.random.seed(42)

    y = daily_df["y"].values.astype(float)
    if len(y) < 40:
        # 안전 폴백
        return _predict_with_simple_average(daily_df, periods)

    y_max = y.max() if y.max() > 0 else 1.0
    y_norm = y / y_max

    window = 14
    X, Y = [], []
    for i in range(len(y_norm) - window):
        X.append(y_norm[i:i+window])
        Y.append(y_norm[i+window])
    X = np.array(X).reshape(-1, window, 1)
    Y = np.array(Y)

    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(32, input_shape=(window, 1)),
        tf.keras.layers.Dense(1),
    ])
    model.compile(optimizer="adam", loss="mse")
    model.fit(X, Y, epochs=30, batch_size=16, verbose=0)

    # 재귀적으로 periods일 예측
    seq = list(y_norm[-window:])
    preds = []
    for _ in range(periods):
        x = np.array(seq[-window:]).reshape(1, window, 1)
        p = max(0.0, model.predict(x, verbose=0)[0][0])
        preds.append(p)
        seq.append(p)
    preds = np.array(preds) * y_max

    return {
        "predicted_remaining_spend": float(preds.sum()),
        "forecast_lower": float(preds.sum() * 0.8),   # LSTM은 구간추정이 없어 근사
        "forecast_upper": float(preds.sum() * 1.2),
        "predicted_today": float(preds[0]),           # 챌린지 한도용 (신규)
    }
"""

def _predict_with_arima(daily_df: pd.DataFrame, periods: int) -> dict:
    """
    ARIMA로 향후 periods일 예측.

    LSTM 대비 차이
    --------------
    - 결정적이다. 시드가 필요 없고 같은 입력이면 항상 같은 결과.
    - 학습이 약 0.2초 (LSTM 약 6초).
    - forecast_lower/upper가 ±20% 임의 근사가 아니라 모델이 낸 실제 구간.
    """
    from statsmodels.tsa.arima.model import ARIMA

    y = daily_df["y"].values.astype(float)
    if len(y) < MIN_POINTS_FOR_ARIMA:
        return _predict_with_simple_average(daily_df, periods)

    # 희소한 시계열에서는 수렴·초기값 경고가 정상적으로 발생한다.
    # 수렴에 실패해도 단순 차수로 재시도하므로 결과에는 영향이 없다.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            fit = ARIMA(y, order=ARIMA_ORDER).fit()
        except Exception:
            try:
                fit = ARIMA(y, order=ARIMA_FALLBACK_ORDER).fit()
            except Exception:
                return _predict_with_simple_average(daily_df, periods)

        fc = fit.get_forecast(steps=periods)
        mean = np.asarray(fc.predicted_mean, dtype=float)
        preds = np.clip(mean, 0, None)
        ci = np.asarray(fc.conf_int(alpha=0.2), dtype=float)   # 80% 구간

    total = float(preds.sum())

    # ---- 상한 가드 ----
    # 최근 30일 평균으로 본 '그럴듯한 상한'을 넘으면 믿지 않는다.
    # 최근 30일 평균으로 본 '그럴듯한 상한'을 넘으면 믿지 않는다.
    # 과대예측만 막는다. 과소예측은 이 방식으로 걸러낼 수 없다.
    recent = float(daily_df["y"].tail(min(30, len(daily_df))).mean())
    cap = recent * periods * ARIMA_GUARD_MULTIPLE
    if not np.isfinite(total) or total > cap:
        return _predict_with_simple_average(daily_df, periods)

    # ---- 신뢰구간 ----
    # 구간은 '합계' 기준으로 계산한다. 하루치 하한은 음수가 나오는 게
    # 정상이라(지출은 0 이상) 날마다 0으로 자르고 더하면 하한이 전부
    # 0으로 뭉개진다. 날짜별 오차를 독립으로 보고 분산을 합친다.
    z = 1.2816                                   # 80% 양측
    sd_daily = (ci[:, 1] - mean) / z
    sd_total = float(np.sqrt(np.sum(sd_daily ** 2)))

    return {
        "predicted_remaining_spend": total,
        "forecast_lower": max(0.0, total - z * sd_total),
        "forecast_upper": total + z * sd_total,
        "predicted_today": float(preds[0]),
    }



"""
def _predict_with_prophet(daily_df: pd.DataFrame, periods: int) -> dict:
    # Prophet으로 향후 periods일 예측. 결과는 yhat sum 등 dict로 반환.
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
"""

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
            "predicted_today": 0.0
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
        "predicted_today": daily_avg,
    }


def predict_monthly_spend(
    daily_df: pd.DataFrame,
    target_date,
    month_to_date_actual: float,
    tx_count: int = 0,
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
    elif (data_points >= MIN_DATA_POINTS_FOR_LSTM
      and (nonzero_ratio >= MIN_NONZERO_RATIO_FOR_LSTM
           or tx_count >= MIN_TX_COUNT_FOR_LSTM)   # OR 조건 추가
      and days_remaining > 0):
        try:
            forecast = _predict_with_arima(daily_df, days_remaining)
            model_used = "arima"
        except Exception:
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
        "tx_count_used": int(tx_count),        # 신규
        "predicted_today": forecast.get("predicted_today", 0.0),  # 신규
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
