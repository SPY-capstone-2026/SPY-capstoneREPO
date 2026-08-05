"""
preprocessing.py
================

Transactions 테이블 형태의 입력을 Prophet이 쓸 수 있는 일 단위 시계열로 변환.

핵심 함수:
    make_daily_series(transactions_df, user_id, category_name, target_date, ...)
        → 특정 사용자의 특정 카테고리에 대한 (ds, y) DataFrame 반환
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

import pandas as pd


# Transactions 테이블에서 AI 엔진이 실제로 사용하는 컬럼
REQUIRED_COLUMNS = ["user_id", "tx_date", "amount", "final_category"]


def _coerce_date(value) -> date:
    """문자열/Timestamp/date 무엇이 들어와도 date 객체로 정규화."""
    if isinstance(value, date) and not isinstance(value, pd.Timestamp):
        return value
    return pd.to_datetime(value).date()


def make_daily_series(
    transactions_df: pd.DataFrame,
    user_id: str,
    category_name: str,
    target_date,
    valid_data_start_date=None,
    lookback_days: int = 365,
) -> pd.DataFrame:
    """
    특정 사용자의 특정 카테고리에 대한 일 단위 소비 시계열을 만든다.

    Parameters
    ----------
    transactions_df : pd.DataFrame
        Transactions 테이블에서 가져온 거래 내역.
        최소 컬럼: user_id, tx_date, amount, final_category
    user_id : str
        대상 사용자 ID.
    category_name : str
        대상 카테고리. `final_category` 기준으로 필터링한다.
        (mydata_category가 아니라 final_category를 쓰는 이유는 사용자 보정이 반영되기 때문)
    target_date : date | str
        챌린지 생성 기준 날짜 (KST 기준). 시계열은 이 날짜의 전날까지 포함.
    valid_data_start_date : date | str | None
        이 날짜 이전 거래는 사용하지 않는다. (Users.valid_data_start_date에서 옴)
    lookback_days : int
        target_date로부터 거슬러 올라가는 최대 일수. 180(prophet) -> 365(LSTM)으로 변경

    Returns
    -------
    pd.DataFrame
        columns: ds (datetime), y (float)
        - ds는 일 단위로 빠짐없이 채워짐 (소비 없는 날은 y=0)
        - target_date 당일은 포함하지 않음 (당일은 아직 진행 중이므로)
    """
    # ---- 1. 입력 검증 ----
    missing = [c for c in REQUIRED_COLUMNS if c not in transactions_df.columns]
    if missing:
        raise ValueError(f"transactions_df missing columns: {missing}")

    target_date = _coerce_date(target_date)

    # ---- 2. 사용자 + 카테고리 필터 ----
    df = transactions_df.copy()
    df["tx_date"] = pd.to_datetime(df["tx_date"]).dt.date

    df = df[
        (df["user_id"] == user_id)
        & (df["final_category"] == category_name)
        & (df["tx_date"] < target_date)  # 당일 제외
    ]

    # ---- 3. valid_data_start_date 컷오프 ----
    if valid_data_start_date is not None and not pd.isna(valid_data_start_date):
        valid_start = _coerce_date(valid_data_start_date)
        df = df[df["tx_date"] >= valid_start]

    # ---- 4. lookback 윈도우 컷오프 ----
    earliest = target_date - timedelta(days=lookback_days)
    df = df[df["tx_date"] >= earliest]

    # ---- 5. 일 단위 집계 ----
    if df.empty:
        # 빈 시계열을 반환할 때도 컬럼 스키마는 유지
        return pd.DataFrame({"ds": pd.Series(dtype="datetime64[ns]"),
                             "y": pd.Series(dtype="float64")})

    daily = (
        df.groupby("tx_date", as_index=False)["amount"]
        .sum()
        .rename(columns={"tx_date": "ds", "amount": "y"})
    )

    # ---- 6. 빠진 날짜를 0으로 채움 ----
    start_date = daily["ds"].min()
    end_date = target_date - timedelta(days=1)
    full_range = pd.DataFrame({"ds": pd.date_range(start_date, end_date, freq="D")})
    full_range["ds"] = full_range["ds"].dt.date

    daily = full_range.merge(daily, on="ds", how="left").fillna({"y": 0.0})
    daily["ds"] = pd.to_datetime(daily["ds"])
    daily["y"] = daily["y"].astype(float)

    return daily.reset_index(drop=True)


def get_month_to_date_actual(
    transactions_df: pd.DataFrame,
    user_id: str,
    category_name: str,
    target_date,
) -> float:
    """
    target_date가 속한 캘린더 월의 1일부터 target_date(포함)까지
    실제 소비액 합계를 반환.
    """
    if not all(c in transactions_df.columns for c in REQUIRED_COLUMNS):
        missing = [c for c in REQUIRED_COLUMNS if c not in transactions_df.columns]
        raise ValueError(f"transactions_df missing columns: {missing}")

    target_date = _coerce_date(target_date)
    month_start = target_date.replace(day=1)

    df = transactions_df.copy()
    df["tx_date"] = pd.to_datetime(df["tx_date"]).dt.date

    mtd = df[
        (df["user_id"] == user_id)
        & (df["final_category"] == category_name)
        & (df["tx_date"] >= month_start)
        & (df["tx_date"] <= target_date)
    ]

    return float(mtd["amount"].sum())


def compute_no_spend_streak(daily_df: pd.DataFrame, target_date) -> int:
    """
    target_date 직전(전날)부터 거슬러 올라가며 연속 무지출 일수를 센다.

    Parameters
    ----------
    daily_df : pd.DataFrame
        make_daily_series() 결과. columns: ds, y
        (target_date 당일은 포함되지 않으므로 ds의 최댓값 = target_date 전날)
    target_date : date | str
        기준 날짜.

    Returns
    -------
    int
        연속 무지출 일수. 예: 어제와 그제 모두 0원이면 2.
        daily_df가 비어있으면 0.

    Note
    ----
    "어제까지 며칠 연속 안 썼는가"를 센다. 오늘(target_date)은 아직 진행 중이라 제외.
    """
    if daily_df.empty:
        return 0

    target_date = _coerce_date(target_date)
    # ds 오름차순 정렬 후 뒤에서부터 0인지 확인
    df = daily_df.sort_values("ds").reset_index(drop=True)

    # target_date 전날까지만 고려 (make_daily_series가 이미 당일 제외하지만 방어적으로)
    df = df[pd.to_datetime(df["ds"]).dt.date < target_date]
    if df.empty:
        return 0

    streak = 0
    for y in reversed(df["y"].tolist()):
        if y == 0:
            streak += 1
        else:
            break
    return streak


def has_category_correction(
    transactions_df: pd.DataFrame,
    user_id: str,
    category_name: str,
) -> bool:
    """
    해당 카테고리에 사용자 카테고리 보정 이력이 있는지 여부.
    (ai_metadata.category_correction_applied 필드에 사용)
    """
    if "is_user_corrected" not in transactions_df.columns:
        return False

    df = transactions_df[
        (transactions_df["user_id"] == user_id)
        & (transactions_df["final_category"] == category_name)
    ]
    if df.empty:
        return False
    return bool(df["is_user_corrected"].fillna(False).any())

def get_transaction_count(transactions_df, user_id, category_name, target_date, valid_data_start_date=None, lookback_days=365):
    """
    lookback 기간 내 해당 카테고리의 원본 거래 건수(row 수).
    일별 합산 전 실제 거래 횟수를 센다 (하루 여러 번도 각각 카운트).
    """
    target_date = _coerce_date(target_date)
    start_date = target_date - timedelta(days=lookback_days)

    df = transactions_df[
        (transactions_df["user_id"] == user_id)
        & (transactions_df["final_category"] == category_name)
        & (pd.to_datetime(transactions_df["tx_date"]).dt.date >= start_date)
        & (pd.to_datetime(transactions_df["tx_date"]).dt.date < target_date)
    ]

    # valid_data_start_date 컷오프 추가
    if valid_data_start_date is not None and not pd.isna(valid_data_start_date):
        valid_start = _coerce_date(valid_data_start_date)
        df = df[df["tx_date"] >= valid_start]

    return len(df)