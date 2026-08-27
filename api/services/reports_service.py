from calendar import monthrange
from collections import defaultdict
from datetime import date


def get_month_date_range(target_date: date):
    first_day = target_date.replace(day=1)
    last_day = target_date.replace(
        day=monthrange(target_date.year, target_date.month)[1]
    )

    return first_day, last_day


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
