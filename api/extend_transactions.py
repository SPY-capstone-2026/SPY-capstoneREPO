"""
거래내역 이어서 생성 (DB 전체 초기화 없음)
==========================================
마지막으로 생성된 거래의 '날짜+시각' 다음부터 '지금(KST)'까지만 추가한다.
17시에 실행하면 17시까지, 23시에 다시 실행하면 17시~23시 사이 것만 이어서 들어간다.
같은 날의 하루 계획은 날짜별로 고정돼 있어서, 나눠 실행해도 한 번에 실행한 것과 결과가 같다.

    python extend_transactions.py              # 미리보기 후 yes 입력 시 추가
    python extend_transactions.py --yes        # 확인 없이 추가

- 유저/레벨/포인트/상점/친구/챌린지는 건드리지 않는다.
- '직접 입력'(앱/API로 넣은) 거래는 기준 시각 계산에서 제외한다.
- 추가된 날짜가 포함된 끝난 기간 리포트 캐시는 지운다.
"""
import argparse
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import Session, select

from models import engine, Transaction
from generate_seed import USER_ID, generate_university_student_data, summarize
from reseed_transactions import MANUAL_CATEGORY, rows_to_transactions
from services.report_cache_service import invalidate_reports_containing_date
from services.time_utils import kst_now_naive


def get_last_generated_at(session: Session, user_id: str) -> Optional[datetime]:
    row = session.exec(
        select(Transaction.tx_date, Transaction.tx_time)
        .where(Transaction.user_id == user_id)
        .where(Transaction.mydata_category != MANUAL_CATEGORY)
        .where(Transaction.import_key.is_(None))  # 은행 파일에서 가져온 거래는 기준에서 제외
        .order_by(Transaction.tx_date.desc(), Transaction.tx_time.desc())
    ).first()
    return datetime.combine(row[0], row[1]) if row else None


def plan_extend(session: Session, user_id: str, until: Optional[datetime] = None):
    until = until or kst_now_naive()
    last = get_last_generated_at(session, user_id)
    if last is None:
        raise SystemExit("생성된 거래가 없습니다. 먼저 reseed_transactions.py 또는 seed_all.py 를 쓰세요.")
    if last >= until:
        return last, until, None

    df, _ = generate_university_student_data(
        user_id=user_id, start_date=last.date(), end_date=until.date(), after=last, until=until)

    # 혹시 이미 들어간 tx_id 가 있으면 건너뛴다 (재실행 안전)
    if not df.empty:
        existing = set(session.exec(
            select(Transaction.tx_id).where(Transaction.tx_id.in_(df["tx_id"].tolist()))
        ).all())
        df = df[~df["tx_id"].isin(existing)].reset_index(drop=True)
    return last, until, df


def apply_extend(session: Session, user_id: str, df) -> int:
    for tx in rows_to_transactions(df):
        session.add(tx)
    session.commit()
    for d in sorted(set(df["tx_date"])):
        invalidate_reports_containing_date(session, user_id, datetime.fromisoformat(d).date())
    return len(df)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", default=USER_ID)
    parser.add_argument("--yes", action="store_true")
    args = parser.parse_args()
    engine.echo = False

    with Session(engine) as session:
        last, until, df = plan_extend(session, args.user)
        print(f"마지막 생성 거래: {last:%Y-%m-%d %H:%M}  →  지금: {until:%Y-%m-%d %H:%M} (KST)")
        if df is None or df.empty:
            return print("추가할 거래가 없습니다.")

        print(f"추가할 거래 {len(df)}건")
        print(df[["tx_date", "tx_time", "amount", "merchant_name", "final_category"]].to_string(index=False))
        if not args.yes and input("운영 DB에 추가할까요? (yes 입력): ").strip() != "yes":
            return print("취소했습니다. (DB 변경 없음)")
        print(f"✅ {apply_extend(session, args.user, df)}건 추가했습니다.")


if __name__ == "__main__":
    main()
