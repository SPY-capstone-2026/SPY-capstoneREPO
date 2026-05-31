"""
seed 데이터 생성기 (BE 직장인 패턴 기반).

BE 팀원이 작성한 generate_office_worker_data를 그대로 사용하고,
AI 엔진 테스트에 필요한 users / category_settings 시드를 추가로 생성한다.

final_category 값: 카페, 식비, 의류, 화장품, 가전
user_id: user-office-001
기간: 2025-01-01 ~ 2025-12-31 (365일)
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import uuid


# ============================================================
# BE 팀원이 작성한 더미데이터 생성 코드 (원본 그대로)
# ============================================================
def generate_office_worker_data(user_id, start_date, days):
    np.random.seed(42)  # 재현성을 위한 시드 고정
    dates = [start_date + timedelta(days=i) for i in range(days)]
    data = []

    for date in dates:
        weekday = date.weekday()  # 0:월 ~ 6:일
        is_weekend = weekday >= 5
        is_payday_season = date.day in [25, 26, 27]

        # 1. 평일 패턴 (월~금)
        if not is_weekend:
            # [아침] 출근길 커피 (85% 확률)
            if np.random.rand() < 0.85:
                amount = np.random.choice([2000, 3000, 4500])
                merchant = np.random.choice(['메가커피', '빽다방', '스타벅스'])
                hour = np.random.randint(8, 9)
                minute = np.random.randint(10, 50)

                is_corrected = np.random.rand() < 0.3
                mydata_cat = '식비' if is_corrected else '카페'

                data.append({
                    'tx_id': str(uuid.uuid4())[:8], 'user_id': user_id,
                    'tx_date': date.strftime('%Y-%m-%d'), 'tx_time': f"{hour:02d}:{minute:02d}:00",
                    'amount': amount, 'merchant_name': merchant,
                    'mydata_category': mydata_cat, 'final_category': '카페', 'is_user_corrected': is_corrected
                })

            # [점심] 직장인 점심식사 (100% 확률)
            amount = int(np.random.normal(10000, 2000))
            amount = max(7000, round(amount, -2))
            merchant = np.random.choice(['구내식당', '순대국밥', '김치찌개', '돈까스클럽', '샐러디'])
            minute = np.random.randint(15, 45)

            data.append({
                'tx_id': str(uuid.uuid4())[:8], 'user_id': user_id,
                'tx_date': date.strftime('%Y-%m-%d'), 'tx_time': f"12:{minute:02d}:00",
                'amount': amount, 'merchant_name': merchant,
                'mydata_category': '식비', 'final_category': '식비', 'is_user_corrected': False
            })

            # [저녁] 야근 또는 소소한 저녁 (40% 확률)
            if np.random.rand() < 0.4:
                data.append({
                    'tx_id': str(uuid.uuid4())[:8], 'user_id': user_id,
                    'tx_date': date.strftime('%Y-%m-%d'), 'tx_time': f"19:{np.random.randint(0,50):02d}:00",
                    'amount': np.random.choice([5000, 15000, 25000]),
                    'merchant_name': np.random.choice(['CU편의점', '배달의민족', 'GS25']),
                    'mydata_category': '식비', 'final_category': '식비', 'is_user_corrected': False
                })

        # 2. 주말 패턴 (토~일)
        else:
            # [오후] 늦은 브런치 & 디저트 카페 (100% 확률, 금액 큼)
            amount = int(np.random.normal(15000, 5000))
            amount = max(8000, round(amount, -2))
            hour = np.random.randint(13, 16)

            data.append({
                'tx_id': str(uuid.uuid4())[:8], 'user_id': user_id,
                'tx_date': date.strftime('%Y-%m-%d'), 'tx_time': f"{hour:02d}:{np.random.randint(0,50):02d}:00",
                'amount': amount, 'merchant_name': np.random.choice(['감성카페', '스타벅스', '투썸플레이스']),
                'mydata_category': '식비', 'final_category': '카페', 'is_user_corrected': True
            })

            # [저녁] 맛집 또는 배달 폭발 (80% 확률)
            if np.random.rand() < 0.8:
                amount = int(np.random.normal(40000, 15000))
                amount = max(20000, round(amount, -2))

                data.append({
                    'tx_id': str(uuid.uuid4())[:8], 'user_id': user_id,
                    'tx_date': date.strftime('%Y-%m-%d'), 'tx_time': f"18:{np.random.randint(0,50):02d}:00",
                    'amount': amount, 'merchant_name': np.random.choice(['삼겹살집', '배달의민족', '초밥집']),
                    'mydata_category': '식비', 'final_category': '식비', 'is_user_corrected': False
                })

        # 3. 월급날 지름신 패턴 (쇼핑/가전)
        if is_payday_season and np.random.rand() < 0.6:
            amount = int(np.random.normal(150000, 50000))
            amount = max(50000, round(amount, -3))

            data.append({
                'tx_id': str(uuid.uuid4())[:8], 'user_id': user_id,
                'tx_date': date.strftime('%Y-%m-%d'), 'tx_time': f"21:{np.random.randint(0,50):02d}:00",
                'amount': amount, 'merchant_name': np.random.choice(['무신사', '올리브영', '지그재그', '애플스토어']),
                'mydata_category': '쇼핑', 'final_category': np.random.choice(['의류', '화장품', '가전']),
                'is_user_corrected': False
            })

    df = pd.DataFrame(data)
    df['datetime'] = pd.to_datetime(df['tx_date'] + ' ' + df['tx_time'])
    df = df.sort_values('datetime').drop(columns=['datetime']).reset_index(drop=True)
    return df


# ============================================================
# AI 엔진 테스트용 users / category_settings 시드 (AI 담당 작성)
# ============================================================
USER_ID = "user-office-001"


def generate_seed_users(user_id=USER_ID):
    return pd.DataFrame([{
        "user_id": user_id,
        "email": "office@moni.app",
        "password_hash": "$dummy$",
        "income_type": "SALARY",
        "payday": 25,
        "spend_profile": "STEADY",
        "valid_data_start_date": None,
        "total_xp": 0,
        "current_level": 1,
        "created_at": "2024-12-01T00:00:00",
    }])


def generate_seed_category_settings(user_id=USER_ID):
    # budget_limit은 실제 소비 분포 기준으로 압박도가 다양하게 나오도록 설정 (팀 확정 시 교체)
    return pd.DataFrame([
        {"id": 1, "user_id": user_id, "category_name": "카페",
         "budget_limit": 100000, "is_daily_challenge": True, "alert_threshold": 0.8},
        {"id": 2, "user_id": user_id, "category_name": "식비",
         "budget_limit": 400000, "is_daily_challenge": True, "alert_threshold": 0.9},
        {"id": 3, "user_id": user_id, "category_name": "의류",
         "budget_limit": 80000, "is_daily_challenge": True, "alert_threshold": 0.8},
        {"id": 4, "user_id": user_id, "category_name": "화장품",
         "budget_limit": 50000, "is_daily_challenge": True, "alert_threshold": 0.8},
        {"id": 5, "user_id": user_id, "category_name": "가전",
         "budget_limit": 100000, "is_daily_challenge": False, "alert_threshold": 1.0},
    ])


if __name__ == "__main__":
    start_date = datetime.strptime('2025-01-01', '%Y-%m-%d')
    tx_df = generate_office_worker_data(USER_ID, start_date, 365)
    users_df = generate_seed_users()
    cat_df = generate_seed_category_settings()

    tx_df.to_csv("seed_transactions.csv", index=False)
    users_df.to_csv("seed_users.csv", index=False)
    cat_df.to_csv("seed_category_settings.csv", index=False)

    print(f"transactions: {len(tx_df)} rows (기간 2025-01-01 ~ 2025-12-31)")
    print(f"users:        {len(users_df)} rows")
    print(f"settings:     {len(cat_df)} rows")
    print()
    print("--- 카테고리별 거래 건수 ---")
    print(tx_df["final_category"].value_counts())
    print()
    print("--- 카테고리별 월평균 소비 (대략) ---")
    tx_df["tx_date"] = pd.to_datetime(tx_df["tx_date"])
    tx_df["ym"] = tx_df["tx_date"].dt.to_period("M")
    monthly = tx_df.groupby(["final_category", "ym"])["amount"].sum().groupby("final_category").mean()
    for cat, val in monthly.items():
        print(f"  {cat:6s}: {val:,.0f}원/월")
