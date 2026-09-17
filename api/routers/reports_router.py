from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select

from models import engine, User, Transaction
from auth import get_current_user_id
from services.common_service import ensure_default_category_settings
from services.reports_service import (
    get_month_date_range,
    get_week_date_range,
    get_weekly_trend,
    calculate_projected_amount,
    build_evaluated_categories,
    build_weekly_category_comparison,
    build_category_overrun_info,
)
from services.report_cache_service import get_or_generate_report
from services.challenge_stats_service import get_total_xp_earned

router = APIRouter()


@router.get("/reports/weekly")
def get_weekly_report_api(
    target_date: Optional[date] = None,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        ref_date = target_date or date.today()
        week_start, week_end = get_week_date_range(ref_date)
        last_week_start, last_week_end = get_week_date_range(week_start - timedelta(days=1))

        def build_report():
            category_settings = ensure_default_category_settings(session, user_id)

            this_week_transactions = session.exec(
                select(Transaction)
                .where(Transaction.user_id == user_id)
                .where(Transaction.tx_date >= week_start)
                .where(Transaction.tx_date <= week_end)
            ).all()

            last_week_transactions = session.exec(
                select(Transaction)
                .where(Transaction.user_id == user_id)
                .where(Transaction.tx_date >= last_week_start)
                .where(Transaction.tx_date <= last_week_end)
            ).all()

            this_week_total = sum(t.amount for t in this_week_transactions)
            last_week_total = sum(t.amount for t in last_week_transactions)
            change_amount = this_week_total - last_week_total
            change_percent = (
                round((change_amount / last_week_total) * 100, 1)
                if last_week_total > 0
                else None
            )

            category_comparison = build_weekly_category_comparison(
                category_settings=category_settings,
                this_week_transactions=this_week_transactions,
                last_week_transactions=last_week_transactions,
            )

            daily_trend = get_weekly_trend(this_week_transactions)

            xp_earned_this_week = get_total_xp_earned(session, user_id, week_start, week_end)

            return {
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "weekly_summary": {
                    "total_spend": this_week_total,
                    "last_week_total_spend": last_week_total,
                    "change_amount": change_amount,
                    "change_percent": change_percent,
                    "transaction_count": len(this_week_transactions),
                    "xp_earned": xp_earned_this_week,
                },
                "daily_trend": daily_trend,
                "category_comparison": category_comparison,
            }

        # 요청한 주가 이미 끝났으면 캐시 우선 조회, 진행 중인 주(이번 주)면 항상 라이브 계산
        report_data = get_or_generate_report(
            session=session,
            user_id=user_id,
            report_type="WEEKLY",
            period_start=week_start,
            period_end=week_end,
            generator_fn=build_report,
        )

        return {
            "status": "success",
            "data": report_data,
        }


@router.get("/reports/monthly")
def get_monthly_report_api(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        today = date.today()
        first_day, last_day = get_month_date_range(today)

        def build_report():
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

            xp_earned_this_month = get_total_xp_earned(session, user_id, first_day, last_day)

            category_overrun = build_category_overrun_info(
                category_settings=category_settings,
                transactions=monthly_transactions,
                period_start=first_day,
                period_end=last_day,
            )

            return {
                "month": first_day.strftime("%Y-%m"),
                "monthly_summary": {
                    "total_spend": total_spend,
                    "budget_limit": total_budget,
                    "predicted_monthly_spend": predicted_monthly_spend,
                    "budget_pressure": budget_pressure,
                    "transaction_count": len(monthly_transactions),
                    "xp_earned": xp_earned_this_month,
                },
                "weekly_trend": weekly_trend,
                "evaluated_categories": evaluated_categories,
                "category_overrun": category_overrun,
            }

        # 이번 달(진행 중)이면 항상 라이브 계산, 지난달(끝난 기간)이면 캐시 우선 조회
        report_data = get_or_generate_report(
            session=session,
            user_id=user_id,
            report_type="MONTHLY",
            period_start=first_day,
            period_end=last_day,
            generator_fn=build_report,
        )

        return {
            "status": "success",
            "data": report_data,
        }
