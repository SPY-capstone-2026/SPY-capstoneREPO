from datetime import date, datetime
from typing import Optional
from sqlmodel import Session, select
from models import BudgetChangeLog


def log_budget_change(
    session: Session,
    user_id: str,
    category_name: str,
    old_limit: int,
    new_limit: int,
) -> Optional[BudgetChangeLog]:
    """
    예산 변경 이력을 남긴다. old_limit과 new_limit이 같으면 (실질적 변경이 없으면)
    로그를 남기지 않고 None을 반환한다.
    """
    if old_limit == new_limit:
        return None

    log = BudgetChangeLog(
        user_id=user_id,
        category_name=category_name,
        old_limit=old_limit,
        new_limit=new_limit,
    )
    session.add(log)
    session.commit()
    session.refresh(log)

    return log


def get_budget_change_history(
    session: Session,
    user_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category_name: Optional[str] = None,
):
    """
    기간 내 예산 변경 이력 조회. 월간/주간 리포트에서
    '이번 달 카페 예산을 5만원 올렸어요' 같은 코멘트를 만들 때 사용.
    """
    query = select(BudgetChangeLog).where(BudgetChangeLog.user_id == user_id)

    if category_name:
        query = query.where(BudgetChangeLog.category_name == category_name)

    if start_date:
        query = query.where(BudgetChangeLog.changed_at >= datetime.combine(start_date, datetime.min.time()))

    if end_date:
        query = query.where(BudgetChangeLog.changed_at <= datetime.combine(end_date, datetime.max.time()))

    return session.exec(query.order_by(BudgetChangeLog.changed_at.desc())).all()
