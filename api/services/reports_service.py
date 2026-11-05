from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta


def get_month_date_range(target_date: date):
    first_day = target_date.replace(day=1)
    last_day = target_date.replace(
        day=monthrange(target_date.year, target_date.month)[1]
    )

    return first_day, last_day


def get_week_date_range(target_date: date):
    """target_date가 속한 주의 월요일~일요일 범위."""
    week_start = target_date - timedelta(days=target_date.weekday())
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def calculate_change(current: int, previous: int):
    """이전 대비 변화량/변화율. previous가 0이면 퍼센트는 계산 불가하므로 None."""
    change_amount = current - previous

    if previous == 0:
        change_percent = None
    else:
        change_percent = round((change_amount / previous) * 100, 1)

    return change_amount, change_percent


def build_weekly_category_comparison(category_settings, this_week_transactions, last_week_transactions):
    """카테고리별 이번 주 소비 vs 지난주 소비 비교."""
    this_week_by_category = defaultdict(int)
    for transaction in this_week_transactions:
        this_week_by_category[transaction.final_category] += transaction.amount

    last_week_by_category = defaultdict(int)
    for transaction in last_week_transactions:
        last_week_by_category[transaction.final_category] += transaction.amount

    result = []

    for setting in category_settings:
        this_week_spend = this_week_by_category[setting.category_name]
        last_week_spend = last_week_by_category[setting.category_name]
        change_amount, change_percent = calculate_change(this_week_spend, last_week_spend)

        result.append({
            "category_name": setting.category_name,
            "budget_limit": setting.budget_limit,
            "this_week_spend": this_week_spend,
            "last_week_spend": last_week_spend,
            "change_amount": change_amount,
            "change_percent": change_percent,
        })

    result.sort(key=lambda item: item["this_week_spend"], reverse=True)
    return result


def build_category_overrun_info(category_settings, transactions, period_start: date, period_end: date):
    """
    카테고리별 일자별 누적 지출과, 예산을 처음 넘어선 날짜(overrun_date)를 계산.
    기간 내 한 번도 안 넘었으면 overrun_date는 None.
    """
    amount_by_category_date = defaultdict(lambda: defaultdict(int))

    for transaction in transactions:
        amount_by_category_date[transaction.final_category][transaction.tx_date] += transaction.amount

    result = []

    for setting in category_settings:
        cumulative = 0
        overrun_date = None
        daily_cumulative = []

        current = period_start
        while current <= period_end:
            cumulative += amount_by_category_date[setting.category_name].get(current, 0)
            daily_cumulative.append({
                "date": current.isoformat(),
                "cumulative_spend": cumulative,
            })

            if overrun_date is None and setting.budget_limit > 0 and cumulative > setting.budget_limit:
                overrun_date = current

            current += timedelta(days=1)

        result.append({
            "category_name": setting.category_name,
            "budget_limit": setting.budget_limit,
            "overrun_date": overrun_date.isoformat() if overrun_date else None,
            "daily_cumulative": daily_cumulative,
        })

    return result


def get_weekly_trend(transactions):
    labels = ["월", "화", "수", "목", "금", "토", "일"]
    amount_by_weekday = defaultdict(int)

    for transaction in transactions:
        amount_by_weekday[transaction.tx_date.weekday()] += transaction.amount

    return [
        {
            "label": labels[index],
            "amount": amount_by_weekday[index],
        }
        for index in range(7)
    ]


def calculate_projected_amount(actual_amount: int, today: date):
    days_in_month = monthrange(today.year, today.month)[1]

    if today.day <= 0:
        return actual_amount

    if actual_amount <= 0:
        return 0

    return round((actual_amount / today.day) * days_in_month)


def build_evaluated_categories(category_settings, monthly_transactions, today: date):
    actual_by_category = defaultdict(int)

    for transaction in monthly_transactions:
        actual_by_category[transaction.final_category] += transaction.amount

    evaluated = []

    for setting in category_settings:
        actual_spend = actual_by_category[setting.category_name]
        predicted_monthly_spend = calculate_projected_amount(actual_spend, today)

        if setting.budget_limit > 0:
            budget_pressure = predicted_monthly_spend / setting.budget_limit
        else:
            budget_pressure = 0

        evaluated.append(
            {
                "category_name": setting.category_name,
                "budget_limit": setting.budget_limit,
                "actual_spend": actual_spend,
                "predicted_monthly_spend": predicted_monthly_spend,
                "budget_pressure": budget_pressure,
                "rank": None,
            }
        )

    evaluated.sort(
        key=lambda item: item["budget_pressure"],
        reverse=True,
    )

    for index, item in enumerate(evaluated, start=1):
        item["rank"] = index

    return evaluated


def build_weekly_breakdown(transactions, period_start: date, period_end: date):
    """
    월 안에서 월요일 시작 기준 주차별(1주차/2주차...) 소비 합계.
    get_weekly_trend(요일별 패턴)와는 다른 개념 - 이건 시간 흐름에 따른 주차별 추이.
    월 경계를 넘어가는 주는 그 달에 속한 날짜만 집계한다 (예: 1일이 화요일이면
    1주차는 화~일 5일치만 포함).
    """
    amount_by_date = defaultdict(int)
    for transaction in transactions:
        amount_by_date[transaction.tx_date] += transaction.amount

    amount_by_week_start = defaultdict(int)
    current = period_start
    while current <= period_end:
        week_start = current - timedelta(days=current.weekday())
        amount_by_week_start[week_start] += amount_by_date.get(current, 0)
        current += timedelta(days=1)

    sorted_weeks = sorted(amount_by_week_start.items())

    result = []
    for index, (week_start, amount) in enumerate(sorted_weeks, start=1):
        week_end = week_start + timedelta(days=6)
        result.append({
            "week_label": f"{index}주차",
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "amount": amount,
        })

    return result


# ----------------------------------------
# 월 × 카테고리 지출 합계 (예측 없이 거래 테이블에서 바로 집계)
# ----------------------------------------
def shift_month(first_day: date, months: int) -> date:
    """그 달 1일에서 months 개월 이동한 달의 1일 (음수면 과거)."""
    index = first_day.year * 12 + (first_day.month - 1) + months
    return date(index // 12, index % 12 + 1, 1)


def get_category_monthly_totals(session, user_id: str, start: date, end: date):
    """
    start~end(포함) 거래를 카테고리·월별로 한 번의 쿼리로 합산한다.
    반환: [{"category_name": "식비", "year_month": "2026-09", "total_spent": 152000}, ...]
          year_month → category_name 순 정렬. 지출이 없는 (월, 카테고리)는 넣지 않는다.
    """
    from sqlalchemy import extract, func
    from sqlmodel import select
    from models import Transaction

    year = extract("year", Transaction.tx_date)
    month = extract("month", Transaction.tx_date)
    rows = session.exec(
        select(Transaction.final_category, year, month, func.sum(Transaction.amount))
        .where(Transaction.user_id == user_id)
        .where(Transaction.tx_date >= start)
        .where(Transaction.tx_date <= end)
        .group_by(Transaction.final_category, year, month)
    ).all()

    result = [
        {
            "category_name": category,
            "year_month": f"{int(y):04d}-{int(m):02d}",
            "total_spent": int(total or 0),
        }
        for category, y, m, total in rows
    ]
    result.sort(key=lambda r: (r["year_month"], r["category_name"]))
    return result


def call_with_supported_kwargs(fn, *args, **optional_kwargs):
    """
    fn 이 받는 키워드 인자만 골라서 넘긴다.
    AI 쪽 함수에 새 인자(category_history 등)가 아직 없어도 리포트가 깨지지 않게 하기 위함.
    """
    import inspect
    try:
        params = inspect.signature(fn).parameters
    except (TypeError, ValueError):
        return fn(*args)
    if any(p.kind is inspect.Parameter.VAR_KEYWORD for p in params.values()):
        return fn(*args, **optional_kwargs)
    return fn(*args, **{k: v for k, v in optional_kwargs.items() if k in params})
