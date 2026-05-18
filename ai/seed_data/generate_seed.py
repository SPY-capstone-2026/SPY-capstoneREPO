"""
seed 데이터 생성기.

은행 API로 받아올 과거 거래 내역을 흉내내는 더미데이터.
백엔드가 별도로 더미데이터를 만들기 전까지 AI 엔진 단독 테스트용으로 사용.
"""

from datetime import date, timedelta
import random

import numpy as np
import pandas as pd


def generate_seed_transactions(
    user_id: str = "user-111",
    end_date: date = date(2026, 5, 14),
    days: int = 365,
    seed: int = 42,
) -> pd.DataFrame:
    """
    카페, 식비, 쇼핑, 교통 4개 카테고리에 대한 거래 내역 생성.

    - 카페: 70% 확률로 매일 발생, 평균 5,500원, 최근 들어 증가 추세 (overspend)
    - 식비: 거의 매일 발생, 평균 8,500원
    - 쇼핑: 약 5% 확률로 발생 (sparse), 평균 35,000원
    - 교통: 평일 매일, 평균 2,800원
    - 일부 카페 거래는 mydata_category가 '식비'로 분류됐다가 final_category에서 '카페'로 보정됨
    """
    rng = np.random.RandomState(seed)
    random.seed(seed)

    start_date = end_date - timedelta(days=days)
    dates = pd.date_range(start_date, end_date - timedelta(days=1), freq="D")

    rows = []
    tx_counter = 1

    def add_tx(d, amount, merchant, mydata_cat, final_cat, corrected=False, tx_time="12:00:00"):
        nonlocal tx_counter
        rows.append({
            "tx_id": f"tx-{tx_counter:06d}",
            "user_id": user_id,
            "tx_date": d.date(),
            "tx_time": tx_time,
            "amount": int(amount),
            "merchant_name": merchant,
            "mydata_category": mydata_cat,
            "final_category": final_cat,
            "is_user_corrected": corrected,
        })
        tx_counter += 1

    for i, d in enumerate(dates):
        is_weekend = d.weekday() >= 5
        days_from_end = (dates[-1] - d).days

        # ---- 카페: 70% 확률로 발생 ----
        if rng.rand() < 0.70:
            base = 5500
            # 최근으로 갈수록 점진적 증가 (overspend 추세)
            trend = max(0, (365 - days_from_end) * 4)
            weekend_boost = 1500 if is_weekend else 0
            noise = rng.normal(0, 1000)
            amount = max(2000, base + trend + weekend_boost + noise)

            # 일부 거래는 마이데이터에서 식비로 잘못 분류 → 사용자 보정
            if rng.rand() < 0.15:
                add_tx(d, amount, "스타벅스", "식비", "카페", corrected=True,
                       tx_time=f"{rng.randint(8, 20):02d}:30:00")
            else:
                add_tx(d, amount, "이디야커피", "카페", "카페",
                       tx_time=f"{rng.randint(8, 20):02d}:15:00")

        # ---- 식비: 95% 확률로 발생, 하루 1~2건 ----
        if rng.rand() < 0.95:
            n_meals = 1 + (1 if rng.rand() < 0.4 else 0)
            for _ in range(n_meals):
                amount = max(4000, rng.normal(8500, 2500))
                add_tx(d, amount, "한솥도시락", "식비", "식비",
                       tx_time=f"{rng.randint(11, 21):02d}:00:00")

        # ---- 쇼핑: 5% 확률 (sparse) ----
        if rng.rand() < 0.05:
            amount = max(10000, rng.normal(35000, 15000))
            add_tx(d, amount, "무신사", "쇼핑", "쇼핑",
                   tx_time=f"{rng.randint(18, 23):02d}:00:00")

        # ---- 교통: 평일 매일 ----
        if not is_weekend and rng.rand() < 0.92:
            amount = max(1250, rng.normal(2800, 600))
            add_tx(d, amount, "T머니", "교통", "교통",
                   tx_time=f"{rng.randint(7, 9):02d}:30:00")

    return pd.DataFrame(rows)


def generate_seed_users(user_id: str = "user-111") -> pd.DataFrame:
    return pd.DataFrame([{
        "user_id": user_id,
        "email": "test@moni.app",
        "password_hash": "$dummy$",
        "income_type": "ALLOWANCE",
        "payday": 25,
        "spend_profile": "IMPULSIVE",
        "valid_data_start_date": None,
        "total_xp": 0,
        "current_level": 1,
        "created_at": "2025-11-14T00:00:00",
    }])


def generate_seed_category_settings(user_id: str = "user-111") -> pd.DataFrame:
    return pd.DataFrame([
        {"id": 1, "user_id": user_id, "category_name": "카페",
         "budget_limit": 30000, "is_daily_challenge": True, "alert_threshold": 0.8},
        {"id": 2, "user_id": user_id, "category_name": "식비",
         "budget_limit": 350000, "is_daily_challenge": True, "alert_threshold": 0.9},
        {"id": 3, "user_id": user_id, "category_name": "쇼핑",
         "budget_limit": 150000, "is_daily_challenge": True, "alert_threshold": 0.8},
        {"id": 4, "user_id": user_id, "category_name": "교통",
         "budget_limit": 80000, "is_daily_challenge": False, "alert_threshold": 1.0},
    ])


if __name__ == "__main__":
    tx_df = generate_seed_transactions()
    users_df = generate_seed_users()
    cat_df = generate_seed_category_settings()

    tx_df.to_csv("seed_transactions.csv", index=False)
    users_df.to_csv("seed_users.csv", index=False)
    cat_df.to_csv("seed_category_settings.csv", index=False)

    print(f"transactions: {len(tx_df)} rows")
    print(f"users:        {len(users_df)} rows")
    print(f"settings:     {len(cat_df)} rows")
    print()
    print("--- transactions head ---")
    print(tx_df.head())
    print()
    print("--- category counts ---")
    print(tx_df["final_category"].value_counts())
