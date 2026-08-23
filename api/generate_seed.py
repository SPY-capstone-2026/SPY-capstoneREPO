"""
대학생 소비 패턴 시드 데이터 생성기
====================================
오늘 날짜 기준 최근 6개월치 거래내역을 생성합니다.
(기존 generate_seed.py의 직장인 패턴을 대학생 패턴으로 새로 짠 버전)

반영한 특징:
- 카페: 거의 매일 방문 (등하교/스터디), 시험기간엔 카페인 수요로 방문 횟수 증가
- 식사: 하루 평균 2끼 (아침은 가끔, 시험기간엔 한 끼로 때우는 날도)
- 시험기간(중간/기말고사): 배달·편의점 간식 급증 + 스트레스성 충동구매(의류/화장품) 증가
- 교통비: 평일 위주 반영

실행:
    cd api
    source venv/bin/activate
    python generate_seed_student.py

결과: ai/seed_data/seed_transactions.csv 에 바로 저장됩니다.
(기존 스크립트는 파일명만 지정해서 실행 위치에 따라 엉뚱한 곳에 저장되는 문제가 있었어서,
 이번엔 api/ 폴더에서 실행한다는 전제로 경로를 명시했습니다.)

⚠️ 주의: 여기서 쓰는 USER_ID가 seed_all.py의 USERS_SEED에 등록된 user_id와
반드시 일치해야 합니다. 안 맞으면 seed_all.py 실행 시 FK 제약 위반 에러가 납니다.
지금은 기존 seed_all.py와 동일하게 "user-office-001"을 그대로 쓰고 있습니다.
페르소나를 대학생으로 바꾸고 싶다면 seed_all.py의 USERS_SEED/CATEGORY_SETTINGS_SEED도
같이 학생 프로필(income_type="STUDENT", 예산 축소 등)로 맞춰주는 걸 추천해요.
"""

import pandas as pd
import numpy as np
from datetime import date, timedelta
import uuid

USER_ID = "user-office-001"  # seed_all.py의 USERS_SEED user_id와 일치해야 함
MONTHS_BACK = 6
OUTPUT_PATH = "seed_transactions.csv"


def get_date_range(months_back=MONTHS_BACK):
    end_date = date.today()
    start_date = end_date - timedelta(days=months_back * 30)
    return start_date, end_date


def get_exam_periods(start_date, end_date):
    """전체 기간 중 중간고사/기말고사 구간을 비율로 자동 배치 (각 1주일)."""
    total_days = (end_date - start_date).days

    midterm_start = start_date + timedelta(days=int(total_days * 0.35))
    midterm_end = midterm_start + timedelta(days=6)

    final_start = start_date + timedelta(days=int(total_days * 0.80))
    final_end = final_start + timedelta(days=6)

    return [(midterm_start, midterm_end), (final_start, final_end)]


def is_in_exam_period(current_date, exam_periods):
    return any(start <= current_date <= end for start, end in exam_periods)


def make_tx(
    user_id,
    tx_date,
    hour,
    minute,
    amount,
    merchant,
    mydata_category,
    final_category,
    is_corrected=False,
):
    return {
        "tx_id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "tx_date": tx_date.strftime("%Y-%m-%d"),
        "tx_time": f"{hour:02d}:{minute:02d}:00",
        "amount": amount,
        "merchant_name": merchant,
        "mydata_category": mydata_category,
        "final_category": final_category,
        "is_user_corrected": is_corrected,
    }


def generate_university_student_data(user_id=USER_ID, months_back=MONTHS_BACK, seed=42):
    np.random.seed(seed)
    start_date, end_date = get_date_range(months_back)
    exam_periods = get_exam_periods(start_date, end_date)

    days = (end_date - start_date).days + 1
    data = []

    for i in range(days):
        current = start_date + timedelta(days=i)
        weekday = current.weekday()
        is_weekend = weekday >= 5
        exam_time = is_in_exam_period(current, exam_periods)

        # ---------- 카페: 거의 매일, 시험기간엔 추가 방문 가능 ----------
        cafe_visits = 1 if np.random.rand() < 0.92 else 0
        if exam_time and np.random.rand() < 0.35:
            cafe_visits += 1  # 밤샘/스터디용 추가 방문

        for _ in range(cafe_visits):
            hour = (
                np.random.choice([9, 11, 14, 22])
                if exam_time
                else np.random.choice([9, 11, 14])
            )
            amount = int(np.random.choice([2000, 2500, 3000, 4000, 4500]))
            merchant = np.random.choice(
                ["메가커피", "컴포즈커피", "스타벅스", "빽다방", "이디야"]
            )
            data.append(
                make_tx(
                    user_id,
                    current,
                    int(hour),
                    int(np.random.randint(0, 59)),
                    amount,
                    merchant,
                    "카페",
                    "카페",
                    is_corrected=np.random.rand() < 0.2,
                )
            )

        # ---------- 식사: 하루 평균 2끼 ----------
        meal_slots = ["lunch", "dinner"]
        if np.random.rand() < 0.15:
            meal_slots = ["breakfast"] + meal_slots
        if exam_time and np.random.rand() < 0.25:
            meal_slots = ["lunch"]  # 시험기간엔 한 끼로 때우는 날도

        for slot in meal_slots:
            if slot == "breakfast":
                hour, minute = 8, int(np.random.randint(0, 40))
                amount = int(np.random.choice([2500, 3500, 4000]))
                merchant = np.random.choice(["편의점(CU)", "편의점(GS25)", "학생식당"])
            elif slot == "lunch":
                hour, minute = 12, int(np.random.randint(0, 50))
                if exam_time and np.random.rand() < 0.4:
                    amount = int(np.random.choice([4500, 5000, 6000]))
                    merchant = np.random.choice(["편의점(CU)", "학생식당", "김밥천국"])
                else:
                    amount = int(np.random.choice([7000, 8000, 9000, 10000]))
                    merchant = np.random.choice(
                        ["학생식당", "국밥집", "돈까스집", "샐러드가게"]
                    )
            else:  # dinner
                hour, minute = 19, int(np.random.randint(0, 50))
                if exam_time and np.random.rand() < 0.5:
                    amount = int(np.random.normal(15000, 4000))
                    amount = max(9000, round(amount, -2))
                    merchant = np.random.choice(["배달의민족", "요기요"])
                else:
                    amount = int(np.random.choice([8000, 9000, 11000, 13000]))
                    merchant = np.random.choice(
                        ["학생식당", "분식집", "치킨집", "삼겹살집"]
                    )

            data.append(
                make_tx(
                    user_id,
                    current,
                    hour,
                    minute,
                    amount,
                    merchant,
                    "식비",
                    "식비",
                    is_corrected=False,
                )
            )

        # ---------- 편의점 간식/음료 (시험기간엔 급증) ----------
        snack_prob = 0.15 if not exam_time else 0.55
        if np.random.rand() < snack_prob:
            amount = int(np.random.choice([1500, 2000, 3000, 4500]))
            data.append(
                make_tx(
                    user_id,
                    current,
                    int(np.random.randint(21, 24)),
                    int(np.random.randint(0, 59)),
                    amount,
                    np.random.choice(["CU편의점", "GS25", "세븐일레븐"]),
                    "식비",
                    "식비",
                    is_corrected=False,
                )
            )

        # ---------- 교통비 (평일 위주) ----------
        if not is_weekend and np.random.rand() < 0.85:
            amount = int(np.random.choice([1500, 1550, 3000]))
            data.append(
                make_tx(
                    user_id,
                    current,
                    8,
                    int(np.random.randint(0, 30)),
                    amount,
                    "지하철/버스",
                    "교통",
                    "교통",
                    is_corrected=False,
                )
            )

        # ---------- 충동 소비: 의류/화장품 (시험기간엔 스트레스성으로 급증) ----------
        impulse_prob = 0.04 if not exam_time else 0.18
        if np.random.rand() < impulse_prob:
            category = np.random.choice(["의류", "화장품"])
            amount = int(np.random.normal(45000, 20000))
            amount = max(15000, round(amount, -3))
            merchant = {
                "의류": np.random.choice(["무신사", "지그재그", "에이블리"]),
                "화장품": np.random.choice(["올리브영", "다이소"]),
            }[category]
            data.append(
                make_tx(
                    user_id,
                    current,
                    int(np.random.randint(20, 24)),
                    int(np.random.randint(0, 59)),
                    amount,
                    merchant,
                    "쇼핑",
                    category,
                    is_corrected=False,
                )
            )

    df = pd.DataFrame(data)
    df["datetime"] = pd.to_datetime(df["tx_date"] + " " + df["tx_time"])
    df = df.sort_values("datetime").drop(columns=["datetime"]).reset_index(drop=True)
    return df, exam_periods


if __name__ == "__main__":
    df, exam_periods = generate_university_student_data()

    df.to_csv(OUTPUT_PATH, index=False)

    start_date, end_date = get_date_range()
    print(f"transactions: {len(df)} rows (기간 {start_date} ~ {end_date})")
    print(f"저장 위치: {OUTPUT_PATH}")
    print()
    print("--- 시험기간 자동 배치 결과 ---")
    for idx, (s, e) in enumerate(exam_periods, start=1):
        label = "중간고사" if idx == 1 else "기말고사"
        print(f"  {label}: {s} ~ {e}")
    print()
    print("--- 카테고리별 거래 건수 ---")
    print(df["final_category"].value_counts())
    print()
    print("--- 카테고리별 월평균 소비 (대략) ---")
    df["tx_date"] = pd.to_datetime(df["tx_date"])
    df["ym"] = df["tx_date"].dt.to_period("M")
    monthly = (
        df.groupby(["final_category", "ym"])["amount"]
        .sum()
        .groupby("final_category")
        .mean()
    )
    for cat, val in monthly.items():
        print(f"  {cat:6s}: {val:,.0f}원/월")
