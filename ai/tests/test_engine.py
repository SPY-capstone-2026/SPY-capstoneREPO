"""
엔진 통합 테스트.

seed 데이터를 읽어와서 get_today_challenge()를 호출하고 결과를 점검한다.
"""

import json
import sys
from datetime import date
from pathlib import Path

# 모듈 경로 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd

from moni_engine.engine import get_today_challenge
from moni_engine.preprocessing import make_daily_series, get_month_to_date_actual
from moni_engine.prediction import predict_monthly_spend, calculate_budget_pressure
from moni_engine.challenge import generate_challenge


SEED_DIR = Path(__file__).parent.parent / "seed_data"


def load_seed_data():
    tx_df = pd.read_csv(SEED_DIR / "seed_transactions.csv")
    users_df = pd.read_csv(SEED_DIR / "seed_users.csv")
    cat_df = pd.read_csv(SEED_DIR / "seed_category_settings.csv")
    return tx_df, users_df, cat_df


def test_preprocessing():
    print("=" * 60)
    print("TEST 1: preprocessing.make_daily_series")
    print("=" * 60)
    tx_df, _, _ = load_seed_data()
    target = date(2026, 5, 14)

    for cat in ["카페", "식비", "쇼핑"]:
        daily = make_daily_series(
            transactions_df=tx_df,
            user_id="user-111",
            category_name=cat,
            target_date=target,
        )
        nonzero = (daily["y"] > 0).sum()
        print(f"  {cat:6s}: {len(daily)} days, nonzero={nonzero} "
              f"({nonzero/max(len(daily),1)*100:.1f}%), "
              f"y_mean={daily['y'].mean():.0f}, y_max={daily['y'].max():.0f}")
    print()


def test_mtd_actual():
    print("=" * 60)
    print("TEST 2: month_to_date_actual (5/1 ~ 5/14)")
    print("=" * 60)
    tx_df, _, _ = load_seed_data()
    target = date(2026, 5, 14)

    for cat in ["카페", "식비", "쇼핑"]:
        mtd = get_month_to_date_actual(tx_df, "user-111", cat, target)
        print(f"  {cat:6s}: {mtd:,.0f}원")
    print()


def test_prediction():
    print("=" * 60)
    print("TEST 3: predict_monthly_spend")
    print("=" * 60)
    tx_df, _, _ = load_seed_data()
    target = date(2026, 5, 14)

    for cat in ["카페", "식비", "쇼핑"]:
        daily = make_daily_series(tx_df, "user-111", cat, target)
        mtd = get_month_to_date_actual(tx_df, "user-111", cat, target)
        forecast = predict_monthly_spend(daily, target, mtd)
        print(f"  {cat:6s}: model={forecast['model_used']:14s} "
              f"monthly_pred={forecast['predicted_monthly_spend']:>10,.0f} "
              f"(mtd={forecast['month_to_date_actual']:>8,.0f} + "
              f"remain={forecast['predicted_remaining_spend']:>8,.0f})")
    print()


def test_challenge_generation():
    print("=" * 60)
    print("TEST 4: generate_challenge (pressure 4구간 모두)")
    print("=" * 60)
    pressures = [0.5, 0.95, 1.3, 2.1]
    for p in pressures:
        c = generate_challenge(
            category_name="카페",
            budget_limit=30000,
            predicted_monthly_spend=30000 * p,
            budget_pressure=p,
            month_progress_ratio=0.45,
        )
        print(f"  pressure={p:.2f} → [{c['difficulty']:11s}] "
              f"({c['challenge_type']:10s}) {c['challenge_text']}")
        print(f"           xp={c['xp_reward']}, reason={c['reason']}")
        print()


def test_full_engine():
    print("=" * 60)
    print("TEST 5: get_today_challenge (end-to-end)")
    print("=" * 60)
    tx_df, users_df, cat_df = load_seed_data()
    user_profile = users_df.iloc[0].to_dict()
    target = date(2026, 5, 14)

    result = get_today_challenge(
        transactions_df=tx_df,
        user_profile=user_profile,
        category_settings_df=cat_df,
        target_date=target,
    )

    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    print()


def test_edge_cases():
    print("=" * 60)
    print("TEST 6: 엣지 케이스")
    print("=" * 60)
    tx_df, users_df, cat_df = load_seed_data()
    user_profile = users_df.iloc[0].to_dict()
    target = date(2026, 5, 14)

    # 6-1. is_daily_challenge=True 카테고리 없음
    empty_cat = cat_df.copy()
    empty_cat["is_daily_challenge"] = False
    result = get_today_challenge(tx_df, user_profile, empty_cat, target)
    print(f"  is_daily_challenge=True 카테고리 없음 → {result}")

    # 6-2. transactions 비어 있음 (신규 사용자)
    empty_tx = tx_df.iloc[:0].copy()
    result = get_today_challenge(empty_tx, user_profile, cat_df, target)
    print(f"  거래 내역 0건 (신규 사용자)        → {result}")

    # 6-3. 다른 user_id (해당 사용자 거래 0건)
    other_user = {**user_profile, "user_id": "user-999"}
    result = get_today_challenge(tx_df, other_user, cat_df, target)
    print(f"  다른 user_id (cat_df도 매치 안됨)  → {result}")
    print()


if __name__ == "__main__":
    test_preprocessing()
    test_mtd_actual()
    test_prediction()
    test_challenge_generation()
    test_full_engine()
    test_edge_cases()
    print("✅ 모든 테스트 통과")
