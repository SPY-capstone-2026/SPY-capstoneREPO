"""
엔진 통합 테스트.

seed 데이터(BE 직장인 패턴)로 get_today_challenges()를 호출하고 결과를 점검한다.
streak 기능은 직장인 데이터에서 자연 발생이 적으므로 별도 구성 시나리오로 검증한다.
"""

import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd

from moni_engine.engine import get_today_challenges
from moni_engine.preprocessing import (
    make_daily_series,
    get_month_to_date_actual,
    compute_no_spend_streak,
)
from moni_engine.prediction import predict_monthly_spend, calculate_budget_pressure
from moni_engine.challenge import (
    generate_challenge,
    generate_streak_challenge,
    streak_qualifies,
)


SEED_DIR = Path(__file__).parent.parent / "seed_data"
TARGET = date(2025, 11, 15)  # 데이터 범위(2025-01 ~ 2025-12) 안의 날짜


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
    for cat in ["카페", "식비", "의류", "화장품"]:
        daily = make_daily_series(tx_df, "user-office-001", cat, TARGET)
        nonzero = (daily["y"] > 0).sum()
        ratio = nonzero / max(len(daily), 1) * 100
        print(f"  {cat:5s}: {len(daily):3d} days, nonzero={nonzero:3d} "
              f"({ratio:5.1f}%), y_mean={daily['y'].mean():7.0f}")
    print()


def test_streak_computation():
    print("=" * 60)
    print("TEST 2: compute_no_spend_streak")
    print("=" * 60)
    # 구성 시나리오: 마지막 3일 연속 무지출인 시계열
    daily = pd.DataFrame({
        "ds": pd.to_datetime(["2025-11-10", "2025-11-11", "2025-11-12",
                              "2025-11-13", "2025-11-14"]),
        "y": [5000.0, 3000.0, 0.0, 0.0, 0.0],
    })
    streak = compute_no_spend_streak(daily, date(2025, 11, 15))
    print(f"  마지막 3일 무지출 시계열 → streak = {streak} (기대값 3)")
    assert streak == 3, f"streak 계산 오류: {streak}"

    # 마지막 날 소비 있으면 streak 0
    daily2 = daily.copy()
    daily2.loc[daily2.index[-1], "y"] = 4000.0
    streak2 = compute_no_spend_streak(daily2, date(2025, 11, 15))
    print(f"  마지막 날 소비 있음 → streak = {streak2} (기대값 0)")
    assert streak2 == 0
    print()


def test_prediction():
    print("=" * 60)
    print("TEST 3: predict_monthly_spend (모델 자동 선택)")
    print("=" * 60)
    tx_df, _, _ = load_seed_data()
    for cat in ["카페", "식비", "의류", "화장품"]:
        daily = make_daily_series(tx_df, "user-office-001", cat, TARGET)
        mtd = get_month_to_date_actual(tx_df, "user-office-001", cat, TARGET)
        forecast = predict_monthly_spend(daily, TARGET, mtd)
        print(f"  {cat:5s}: model={forecast['model_used']:14s} "
              f"monthly_pred={forecast['predicted_monthly_spend']:>9,.0f}")
    print()


def test_challenge_tiers():
    print("=" * 60)
    print("TEST 4: generate_challenge (압박도 4구간)")
    print("=" * 60)
    for p in [0.5, 0.95, 1.3, 2.1]:
        c = generate_challenge("카페", 100000, 100000 * p, p, 0.45)
        print(f"  pressure={p:.2f} → [{c['difficulty']:11s}] ({c['challenge_type']:10s}) "
              f"XP{c['xp_reward']:>3} | {c['challenge_text']}")
    print()


def test_streak_challenge():
    print("=" * 60)
    print("TEST 5: generate_streak_challenge + 자격 판정")
    print("=" * 60)
    # 자격 판정
    print(f"  streak=3, nonzero=0.7 → 자격 {streak_qualifies(3, 0.7)} (기대 True)")
    print(f"  streak=1, nonzero=0.7 → 자격 {streak_qualifies(1, 0.7)} (기대 False, streak 짧음)")
    print(f"  streak=5, nonzero=0.1 → 자격 {streak_qualifies(5, 0.1)} (기대 False, 평소 안 씀)")
    assert streak_qualifies(3, 0.7)
    assert not streak_qualifies(1, 0.7)
    assert not streak_qualifies(5, 0.1)
    print()
    for s in [2, 4, 7]:
        c = generate_streak_challenge("카페", s)
        print(f"  streak={s}일 → XP{c['xp_reward']} | {c['challenge_text']}")
    print()


def test_full_engine_seed():
    print("=" * 60)
    print("TEST 6: get_today_challenges (seed 데이터, end-to-end)")
    print("=" * 60)
    tx_df, users_df, cat_df = load_seed_data()
    user_profile = users_df.iloc[0].to_dict()
    results = get_today_challenges(tx_df, user_profile, cat_df, TARGET)

    print(f"  생성된 챌린지 수: {len(results)}")
    for c in results:
        origin = c["ai_metadata"].get("challenge_origin")
        print(f"  [{origin:8s}] {c['category_name']:5s} | {c['challenge_type']:8s} | "
              f"{c['difficulty']:11s} | XP{c['xp_reward']:>3}")
        print(f"           {c['challenge_text']}")
    assert 1 <= len(results) <= 4
    # 첫 챌린지에 evaluated_categories가 붙어있어야 함
    assert "evaluated_categories" in results[0]["ai_metadata"]
    print()


def test_full_engine_with_streak():
    print("=" * 60)
    print("TEST 7: get_today_challenges (streak 발동 시나리오)")
    print("=" * 60)
    # 카페를 평소 매일 쓰다가 최근 4일 끊은 사용자를 구성
    rows = []
    base = pd.Timestamp("2025-10-01")
    for i in range(45):
        d = base + pd.Timedelta(days=i)
        ds = d.strftime("%Y-%m-%d")
        # 마지막 4일(11/11~11/14)은 카페 소비 0
        if d < pd.Timestamp("2025-11-11"):
            rows.append({"tx_id": f"c{i}", "user_id": "u1", "tx_date": ds,
                         "tx_time": "08:30:00", "amount": 4000, "merchant_name": "메가커피",
                         "mydata_category": "카페", "final_category": "카페",
                         "is_user_corrected": False})
        # 식비는 매일
        rows.append({"tx_id": f"f{i}", "user_id": "u1", "tx_date": ds,
                     "tx_time": "12:30:00", "amount": 10000, "merchant_name": "구내식당",
                     "mydata_category": "식비", "final_category": "식비",
                     "is_user_corrected": False})
    tx_df = pd.DataFrame(rows)

    cat_df = pd.DataFrame([
        {"id": 1, "user_id": "u1", "category_name": "카페",
         "budget_limit": 100000, "is_daily_challenge": True, "alert_threshold": 0.8},
        {"id": 2, "user_id": "u1", "category_name": "식비",
         "budget_limit": 400000, "is_daily_challenge": True, "alert_threshold": 0.9},
    ])
    user_profile = {"user_id": "u1", "valid_data_start_date": None}

    results = get_today_challenges(tx_df, user_profile, cat_df, date(2025, 11, 15))
    print(f"  생성된 챌린지 수: {len(results)}")
    streak_found = False
    for c in results:
        origin = c["ai_metadata"].get("challenge_origin")
        print(f"  [{origin:8s}] {c['category_name']:5s} | {c['challenge_type']:8s} | XP{c['xp_reward']:>3}")
        print(f"           {c['challenge_text']}")
        if origin == "streak":
            streak_found = True
            assert c["category_name"] == "카페"
            assert c["ai_metadata"]["no_spend_streak"] >= 2
    print(f"\n  streak 보너스 발동 여부: {streak_found} (기대 True)")
    assert streak_found, "streak 챌린지가 발동하지 않음"
    print()


def test_edge_cases():
    print("=" * 60)
    print("TEST 8: 엣지 케이스 (빈 리스트 반환)")
    print("=" * 60)
    tx_df, users_df, cat_df = load_seed_data()
    user_profile = users_df.iloc[0].to_dict()

    empty_cat = cat_df.copy()
    empty_cat["is_daily_challenge"] = False
    r1 = get_today_challenges(tx_df, user_profile, empty_cat, TARGET)
    print(f"  is_daily_challenge=True 없음 → {r1} (기대 [])")
    assert r1 == []

    empty_tx = tx_df.iloc[:0].copy()
    r2 = get_today_challenges(empty_tx, user_profile, cat_df, TARGET)
    print(f"  거래 0건 (신규 사용자)        → {r2} (기대 [])")
    assert r2 == []

    other = {**user_profile, "user_id": "user-999"}
    r3 = get_today_challenges(tx_df, other, cat_df, TARGET)
    print(f"  다른 user_id                  → {r3} (기대 [])")
    assert r3 == []
    print()


if __name__ == "__main__":
    test_preprocessing()
    test_streak_computation()
    test_prediction()
    test_challenge_tiers()
    test_streak_challenge()
    test_full_engine_seed()
    test_full_engine_with_streak()
    test_edge_cases()
    print("✅ 모든 테스트 통과")
