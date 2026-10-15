"""
대학생 소비 패턴 시드 데이터 생성기
====================================

설계 기준 (팀 확인 사항)
- 식비: 하루 합계 보통 15,000원 이하. 학식/김밥/분식 위주, 저녁은 자취방에서 해결하는 날도 있음.
        시험기간 야식이나 주말 약속이 있는 날만 가끔 20,000원까지.
- 카페: 하루 1잔이 기본(5,000원 이하, 저가 커피 위주), 가끔 2잔, 안 마시는 날도 있음.
        시험기간엔 밤 공부용 두 번째 잔이 늘어난다.
- 화장품/의류: 한 달에 0~2번. 시험기간 스트레스성 구매는 조금 늘어난다.
- 교통: 학기 중 평일 등하교 왕복 위주, 방학엔 줄어든다.

생성 방식
- 날짜마다 (user_id, 날짜)로 난수를 고정한다. 같은 날을 몇 번 생성해도 같은 내역이 나오므로
  "17시에 한 번, 23시에 한 번" 나눠 생성해도 같은 하루 계획에서 시간만 이어서 채워진다.
- 화장품/의류처럼 한 달 단위로 횟수를 정해야 하는 것은 (user_id, 연-월)로 월 계획을 먼저 뽑는다.
- 현재 시각(KST) 이후의 거래는 절대 만들지 않는다. (until 인자)

실행 (api/ 폴더에서):
    python generate_seed.py      # seed_transactions.csv 생성 (seed_all.py 가 읽는 파일)

⚠ seed_all.py 는 모든 유저를 지운다. 이미 운영 중인 DB의 거래만 바꾸려면 reseed_transactions.py 를 쓴다.
⚠ USER_ID 는 seed_all.py 의 USERS_SEED user_id 와 같아야 한다.
"""

import hashlib
from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd

from services.time_utils import kst_now_naive

USER_ID = "user-office-001"  # seed_all.py 의 USERS_SEED user_id 와 일치해야 함
MONTHS_BACK = 6
OUTPUT_PATH = "seed_transactions.csv"

# 생성 규칙을 바꾸면 이 값을 올린다. 같은 날짜라도 다른 내역이 나오게 된다.
SEED_VERSION = "v2"

# 식비 하루 상한 (팀 기준)
DAILY_FOOD_CAP = 15_000
DAILY_FOOD_CAP_SPECIAL = 20_000  # 시험기간 야식 / 주말 약속 날

# 학사 일정 (월, 일). 매년 같은 날짜로 본다.
EXAM_PERIODS_MD = [
    ((4, 20), (4, 26), "1학기 중간고사"),
    ((6, 8), (6, 14), "1학기 기말고사"),
    ((10, 19), (10, 25), "2학기 중간고사"),
    ((12, 7), (12, 13), "2학기 기말고사"),
]
SEMESTERS_MD = [((3, 2), (6, 19)), ((9, 1), (12, 18))]


# ----------------------------------------
# 달력
# ----------------------------------------
def _in_md_range(d: date, start_md, end_md) -> bool:
    return date(d.year, *start_md) <= d <= date(d.year, *end_md)


def exam_label(d: date) -> Optional[str]:
    for start_md, end_md, label in EXAM_PERIODS_MD:
        if _in_md_range(d, start_md, end_md):
            return label
    return None


def is_semester(d: date) -> bool:
    return any(_in_md_range(d, s, e) for s, e in SEMESTERS_MD)


def get_exam_periods(start_date: date, end_date: date) -> List[Tuple[date, date]]:
    """기간 안에 걸치는 시험기간 목록 (출력·확인용)."""
    result = []
    for year in range(start_date.year, end_date.year + 1):
        for start_md, end_md, _ in EXAM_PERIODS_MD:
            s, e = date(year, *start_md), date(year, *end_md)
            if e >= start_date and s <= end_date:
                result.append((s, e))
    return sorted(result)


def get_date_range(months_back: int = MONTHS_BACK) -> Tuple[date, date]:
    end_date = kst_now_naive().date()
    return end_date - timedelta(days=months_back * 30), end_date


# ----------------------------------------
# 난수 (날짜/월 단위로 고정)
# ----------------------------------------
def _rng(*parts) -> np.random.Generator:
    key = "|".join(str(p) for p in (SEED_VERSION, *parts))
    return np.random.default_rng(int(hashlib.sha256(key.encode()).hexdigest()[:16], 16))


def _tx_id(user_id: str, d: date, n: int) -> str:
    return hashlib.sha256(f"{SEED_VERSION}|{user_id}|{d}|{n}".encode()).hexdigest()[:12]


def _pick(rng, options):
    return options[int(rng.integers(len(options)))]


def _month_plan(user_id: str, year: int, month: int) -> dict:
    """그 달의 화장품/의류 구매일을 미리 정한다. {day: [category, ...]}"""
    rng = _rng(user_id, f"{year}-{month:02d}", "month")
    next_month = date(year + month // 12, month % 12 + 1, 1)
    days_in_month = (next_month - timedelta(days=1)).day
    plan: dict = {}

    # 화장품: 0회 25%, 1회 55%, 2회 20%  /  의류: 0회 45%, 1회 45%, 2회 10%
    n_cosmetic = int(rng.choice([0, 1, 2], p=[0.25, 0.55, 0.20]))
    n_clothing = int(rng.choice([0, 1, 2], p=[0.45, 0.45, 0.10]))

    # 시험기간 날짜는 가중치 2배 (스트레스성 구매)
    days = np.arange(1, days_in_month + 1)
    weights = np.array([2.0 if exam_label(date(year, month, int(x))) else 1.0 for x in days])
    weights /= weights.sum()

    for category, n in (("화장품", n_cosmetic), ("의류", n_clothing)):
        for day in rng.choice(days, size=n, replace=False, p=weights):
            plan.setdefault(int(day), []).append(category)
    return plan


# ----------------------------------------
# 하루 생성
# ----------------------------------------
def _row(user_id, d, n, hh, mm, amount, merchant, mydata, final, corrected=False):
    return {
        "tx_id": _tx_id(user_id, d, n),
        "user_id": user_id,
        "tx_date": d.isoformat(),
        "tx_time": f"{hh:02d}:{mm:02d}:00",
        "amount": int(amount),
        "merchant_name": merchant,
        "mydata_category": mydata,
        "final_category": final,
        "is_user_corrected": bool(corrected),
    }


def _food_option(rng, slot: str, exam: bool, semester: bool, weekend: bool):
    """(가게, 금액) 하나를 고른다."""
    if slot == "breakfast":
        return _pick(rng, ["편의점(CU)", "편의점(GS25)"]), int(_pick(rng, [2000, 2500, 3000, 3500]))
    if slot == "lunch":
        if semester and not weekend and rng.random() < 0.60:
            return "학생식당", int(_pick(rng, [5000, 5500, 6000]))
        if exam and rng.random() < 0.5:
            return _pick(rng, ["김밥천국", "편의점(CU)", "편의점(GS25)"]), int(_pick(rng, [4000, 4500, 5000, 5500]))
        return _pick(rng, ["김밥천국", "분식집", "국밥집", "돈까스집"]), int(_pick(rng, [5500, 6500, 7000, 8000, 9000]))
    # dinner
    if rng.random() < 0.35:
        return _pick(rng, ["편의점(CU)", "편의점(GS25)", "세븐일레븐"]), int(_pick(rng, [4500, 5000, 5500]))
    if semester and not weekend and rng.random() < 0.35:
        return "학생식당", int(_pick(rng, [5000, 5500, 6000]))
    return _pick(rng, ["분식집", "국밥집", "김밥천국", "돈까스집"]), int(_pick(rng, [6000, 7000, 8000, 9000]))


def generate_day(user_id: str, d: date, month_plan: Optional[dict] = None) -> List[dict]:
    rng = _rng(user_id, d.isoformat())
    exam = exam_label(d) is not None
    semester = is_semester(d)
    weekend = d.weekday() >= 5
    rows: List[dict] = []

    def add(hh, mm, amount, merchant, mydata, final, corrected=False):
        rows.append(_row(user_id, d, len(rows), hh, mm, amount, merchant, mydata, final, corrected))

    # ---------- 식비 ----------
    food = []  # (hh, mm, amount, merchant)
    special_day = False

    if rng.random() < 0.08:
        m, a = _food_option(rng, "breakfast", exam, semester, weekend)
        food.append((8, int(rng.integers(0, 50)), a, m))

    lunch_prob = 0.92 if semester else 0.75  # 방학엔 집에서 먹는 날이 늘어남
    if rng.random() < lunch_prob:
        m, a = _food_option(rng, "lunch", exam, semester, weekend)
        food.append((int(rng.integers(11, 14)), int(rng.integers(0, 60)), a, m))

    if weekend and rng.random() < 0.15:
        # 주말 친구 약속 (가끔): 저녁 한 끼가 크다
        special_day = True
        food.append((int(rng.integers(18, 20)), int(rng.integers(0, 60)),
                     int(_pick(rng, [12000, 13000, 14000, 15000])),
                     _pick(rng, ["치킨집", "삼겹살집", "마라탕"])))
    elif exam and rng.random() < 0.30:
        # 시험기간 저녁 배달
        special_day = True
        food.append((int(rng.integers(18, 21)), int(rng.integers(0, 60)),
                     int(_pick(rng, [11000, 12000, 13000, 14000])), _pick(rng, ["배달의민족", "요기요"])))
    elif rng.random() < 0.65:
        m, a = _food_option(rng, "dinner", exam, semester, weekend)
        food.append((int(rng.integers(18, 20)), int(rng.integers(0, 60)), a, m))

    if exam and rng.random() < 0.45:
        # 시험기간 야식 (새벽 공부)
        special_day = True
        if rng.random() < 0.25:
            food.append((23, int(rng.integers(0, 50)), int(_pick(rng, [9000, 10000, 11000])),
                         _pick(rng, ["배달의민족", "요기요"])))
        else:
            food.append((int(rng.integers(22, 24)), int(rng.integers(0, 60)),
                         int(_pick(rng, [3000, 4000, 5000, 6000])),
                         _pick(rng, ["CU편의점", "GS25", "세븐일레븐"])))
    elif rng.random() < 0.10:
        # 평소 간식 (가끔)
        food.append((int(rng.integers(15, 22)), int(rng.integers(0, 60)),
                     int(_pick(rng, [1500, 2000, 2500])), _pick(rng, ["CU편의점", "GS25", "세븐일레븐"])))

    cap = DAILY_FOOD_CAP_SPECIAL if special_day else DAILY_FOOD_CAP
    # 상한을 넘으면 비싼 항목부터 편의점(4,500원)으로 바꾸고, 그래도 넘으면 싼 것부터 뺀다
    food.sort(key=lambda f: -f[2])
    while food and sum(f[2] for f in food) > cap:
        hh, mm, amount, merchant = food[0]
        if amount > 4500:
            food[0] = (hh, mm, 4500, "편의점(CU)")
            food.sort(key=lambda f: -f[2])
        else:
            food.pop()  # 가장 싼 항목 제거

    for hh, mm, amount, merchant in food:
        add(hh, mm, amount, merchant, "식비", "식비")

    # ---------- 카페 (5,000원 이하) ----------
    if exam:
        cups = int(rng.choice([0, 1, 2], p=[0.05, 0.60, 0.35]))
    else:
        cups = int(rng.choice([0, 1, 2], p=[0.15, 0.77, 0.08]))

    for i in range(cups):
        if i == 0:
            hh = int(rng.integers(9, 16))
        else:
            hh = int(rng.integers(21, 24)) if exam else int(rng.integers(15, 18))
        r = rng.random()
        if r < 0.70:
            merchant, amount = _pick(rng, ["메가커피", "컴포즈커피", "빽다방"]), int(_pick(rng, [1500, 2000, 2500, 3000, 3500]))
            mydata, corrected = "카페", False
        elif r < 0.85:
            merchant, amount = "이디야", int(_pick(rng, [3200, 3500, 4000]))
            mydata, corrected = "카페", False
        elif r < 0.93:
            merchant, amount = "스타벅스", int(_pick(rng, [4500, 5000]))
            mydata, corrected = "카페", False
        else:
            # 편의점 커피: 마이데이터는 '식비'로 잡히는데 사용자가 '카페'로 고친 경우
            merchant, amount = _pick(rng, ["GS25", "CU편의점"]), int(_pick(rng, [1500, 2000, 2500]))
            mydata, corrected = "식비", True
        add(hh, int(rng.integers(0, 60)), amount, merchant, mydata, "카페", corrected)

    # ---------- 교통 (왕복) ----------
    if weekend:
        commute_prob = 0.25
    else:
        commute_prob = 0.70 if semester else 0.30
    if rng.random() < commute_prob:
        add(int(rng.integers(8, 10)), int(rng.integers(0, 60)), 1550, "지하철/버스", "교통", "교통")
        add(int(rng.integers(17, 20)), int(rng.integers(0, 60)), 1550, "지하철/버스", "교통", "교통")

    # ---------- 화장품 / 의류 (월 계획에 있는 날만) ----------
    if month_plan is None:
        month_plan = _month_plan(user_id, d.year, d.month)
    for category in month_plan.get(d.day, []):
        hh, mm = int(rng.integers(20, 24)), int(rng.integers(0, 60))
        if category == "화장품":
            if rng.random() < 0.35:
                # 다이소: 마이데이터는 '생활'로 잡혀 사용자가 '화장품'으로 고친 경우
                add(hh, mm, int(_pick(rng, [3000, 5000, 6000, 8000])), "다이소", "생활", "화장품", True)
            else:
                add(hh, mm, int(_pick(rng, [9900, 12000, 15800, 18000, 22000, 26000])), "올리브영", "쇼핑", "화장품")
        else:
            add(hh, mm, int(_pick(rng, [19900, 24900, 29900, 35000, 39900, 45000])),
                _pick(rng, ["무신사", "지그재그", "에이블리"]), "쇼핑", "의류")

    return rows


# ----------------------------------------
# 기간 생성 (기존 호출부와 호환)
# ----------------------------------------
COLUMNS = ["tx_id", "user_id", "tx_date", "tx_time", "amount", "merchant_name",
           "mydata_category", "final_category", "is_user_corrected"]


def generate_university_student_data(
    user_id: str = USER_ID,
    months_back: int = MONTHS_BACK,
    seed=None,  # 하위 호환용. 이제 날짜별로 고정된 난수를 쓰므로 사용하지 않는다.
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    after: Optional[datetime] = None,
    until: Optional[datetime] = None,
):
    """
    start_date~end_date 의 거래를 만든다.
    - until: 이 시각 이후 거래는 만들지 않는다. 기본값은 지금(KST).
    - after: 이 시각 이하 거래는 빼고 그 뒤만 돌려준다 (이어서 생성할 때).
    반환: (DataFrame, 시험기간 목록)
    """
    if start_date is None or end_date is None:
        start_date, end_date = get_date_range(months_back)
    if until is None:
        until = kst_now_naive()

    end_date = min(end_date, until.date())
    rows: List[dict] = []
    plans: dict = {}
    d = start_date
    while d <= end_date:
        key = (d.year, d.month)
        if key not in plans:
            plans[key] = _month_plan(user_id, d.year, d.month)
        rows.extend(generate_day(user_id, d, plans[key]))
        d += timedelta(days=1)

    df = pd.DataFrame(rows, columns=COLUMNS)
    if not df.empty:
        stamps = pd.to_datetime(df["tx_date"] + " " + df["tx_time"])
        keep = stamps <= pd.Timestamp(until)
        if after is not None:
            keep &= stamps > pd.Timestamp(after)
        df = (df[keep].assign(_ts=stamps[keep]).sort_values("_ts")
              .drop(columns="_ts").reset_index(drop=True))

    return df, get_exam_periods(start_date, end_date)


def summarize(df: pd.DataFrame) -> str:
    """카테고리별 월 합계와 하루 식비/카페 분포 (생성 결과 확인용)."""
    if df.empty:
        return "(거래 없음)"
    x = df.copy()
    x["ym"] = x["tx_date"].astype(str).str[:7]
    monthly = x.groupby(["ym", "final_category"])["amount"].sum().unstack(fill_value=0)
    daily_food = x[x["final_category"] == "식비"].groupby("tx_date")["amount"].sum()
    cafe = x[x["final_category"] == "카페"]
    cups = cafe.groupby("tx_date").size()
    return "\n".join([
        monthly.to_string(),
        "",
        f"식비 하루 평균 {daily_food.mean():,.0f}원 / 최대 {int(daily_food.max()):,}원 / "
        f"15,000원 초과 {int((daily_food > DAILY_FOOD_CAP).sum())}일",
        f"카페 2잔인 날 {int((cups >= 2).sum())}일 / 한 잔 최고가 {int(cafe['amount'].max()):,}원",
    ])


if __name__ == "__main__":
    df, exam_periods = generate_university_student_data()
    df.to_csv(OUTPUT_PATH, index=False)

    start_date, _ = get_date_range()
    print(f"transactions: {len(df)} rows ({start_date} ~ {kst_now_naive():%Y-%m-%d %H:%M} KST)")
    print(f"저장 위치: {OUTPUT_PATH}")
    print("--- 시험기간 ---")
    for s, e in exam_periods:
        print(f"  {exam_label(s)}: {s} ~ {e}")
    print(summarize(df))
