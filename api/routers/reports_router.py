from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select

from models import engine, User, Transaction
from auth import get_current_user_id
from services.common_service import ensure_default_category_settings
from services.reports_service import (
    get_month_date_range,
    get_weekly_trend,
    calculate_projected_amount,
    build_evaluated_categories,
)

router = APIRouter()


@router.get("/reports/monthly")
def get_monthly_report_api(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        today = date.today()
        first_day, last_day = get_month_date_range(today)

        category_settings = ensure_default_category_settings(session, user_id)

        monthly_transactions = session.exec(
            select(Transaction)
            .where(Transaction.user_id == user_id)
            .where(Transaction.tx_date >= first_day)
            .where(Transaction.tx_date <= last_day)
        ).all()

        total_spend = sum(transaction.amount for transaction in monthly_transactions)

        total_budget = sum(category.budget_limit for category in category_settings)

        predicted_monthly_spend = calculate_projected_amount(total_spend, today)

        if total_budget > 0:
            budget_pressure = predicted_monthly_spend / total_budget
        else:
            budget_pressure = 0

        evaluated_categories = build_evaluated_categories(
            category_settings=category_settings,
            monthly_transactions=monthly_transactions,
            today=today,
        )

        weekly_trend = get_weekly_trend(monthly_transactions)

        return {
            "status": "success",
            "data": {
                "month": today.strftime("%Y-%m"),
                "monthly_summary": {
                    "total_spend": total_spend,
                    "budget_limit": total_budget,
                    "predicted_monthly_spend": predicted_monthly_spend,
                    "budget_pressure": budget_pressure,
                    "transaction_count": len(monthly_transactions),
                },
                "weekly_trend": weekly_trend,
                "evaluated_categories": evaluated_categories,
            },
        }
