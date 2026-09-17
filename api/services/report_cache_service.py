from datetime import date
from typing import Callable
from sqlmodel import Session, select
from models import GeneratedReport


def is_period_finalized(period_end: date) -> bool:
    """이 기간이 이미 끝났는지 여부. 끝났으면 캐싱 대상, 진행 중이면 라이브 계산 대상."""
    return period_end < date.today()


def get_or_generate_report(
    session: Session,
    user_id: str,
    report_type: str,  # "WEEKLY" | "MONTHLY"
    period_start: date,
    period_end: date,
    generator_fn: Callable[[], dict],
) -> dict:
    """
    리포트를 조회한다.

    - 아직 진행 중인 기간(이번 주/이번 달)이면 캐시를 아예 확인하지 않고 항상
      generator_fn()을 호출해 라이브로 계산한다. (데이터가 계속 바뀌는 기간이므로)
    - 이미 끝난 기간이면 캐시(GeneratedReport)를 먼저 확인하고, 있으면 그대로 반환한다.
      없으면 그때 한 번 계산해서 저장(lazy caching)하고 반환한다.

    generator_fn은 인자 없이 호출 가능한 함수여야 하며, 리포트 데이터(dict)를 반환해야 한다.
    (호출부에서 필요한 값들을 클로저로 미리 캡처해서 넘기면 됨)
    """
    if not is_period_finalized(period_end):
        return generator_fn()

    cached = session.exec(
        select(GeneratedReport)
        .where(GeneratedReport.user_id == user_id)
        .where(GeneratedReport.report_type == report_type)
        .where(GeneratedReport.period_start == period_start)
        .where(GeneratedReport.period_end == period_end)
    ).first()

    if cached:
        return cached.report_data

    report_data = generator_fn()

    session.add(GeneratedReport(
        user_id=user_id,
        report_type=report_type,
        period_start=period_start,
        period_end=period_end,
        report_data=report_data,
    ))
    session.commit()

    return report_data


def invalidate_reports_containing_date(session: Session, user_id: str, target_date: date) -> int:
    """
    특정 날짜가 포함된 캐싱된 리포트를 전부 무효화(삭제)한다.
    거래내역을 소급 생성/수정/삭제할 때 호출해서, 다음 조회 시 자동으로 재계산되게 한다.
    """
    affected = session.exec(
        select(GeneratedReport)
        .where(GeneratedReport.user_id == user_id)
        .where(GeneratedReport.period_start <= target_date)
        .where(GeneratedReport.period_end >= target_date)
    ).all()

    for report in affected:
        session.delete(report)

    if affected:
        session.commit()

    return len(affected)
