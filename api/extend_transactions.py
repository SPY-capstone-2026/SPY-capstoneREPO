"""
트랜잭션 증분 생성 스크립트
===========================
seed_all.py처럼 DB 전체를 초기화하지 않는다.
마지막으로 저장된 거래 날짜를 자동으로 찾아 보여주고, 그 다음날부터
(원하면 직접 다른 날짜도 입력 가능) 오늘까지의 거래내역만 새로 생성해서
Transaction 테이블에 추가한다. 유저/레벨/포인트/상점 구매내역 등은
전혀 건드리지 않는다.

실행:
    cd api
    source venv/bin/activate
    python extend_transactions.py

사전 조건:
    generate_seed.py의 generate_university_student_data() 함수가
    start_date / end_date 파라미터를 받을 수 있게 수정되어 있어야 함.
"""

from datetime import date, time, timedelta
from sqlmodel import Session, select
from models import engine, Transaction
from generate_seed import generate_university_student_data, USER_ID


def get_last_transaction_date(session: Session, user_id: str):
    return session.exec(
        select(Transaction.tx_date)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.tx_date.desc())
    ).first()


def main():
    with Session(engine) as session:
        last_date = get_last_transaction_date(session, USER_ID)

        if last_date:
            suggested_start = last_date + timedelta(days=1)
            print(f"마지막 거래 날짜: {last_date}")
            print(f"(엔터만 치면 {suggested_start}부터 생성합니다)")
        else:
            suggested_start = None
            print("기존 거래내역이 없습니다. 시작 날짜를 직접 입력해주세요.")

        start_input = input("시작 날짜 입력 (YYYY-MM-DD): ").strip()

        if start_input:
            start_date = date.fromisoformat(start_input)
        elif suggested_start:
            start_date = suggested_start
        else:
            print("시작 날짜가 필요합니다. 종료합니다.")
            return

        end_input = input(f"종료 날짜 입력 (YYYY-MM-DD, 엔터 시 오늘={date.today()}): ").strip()
        end_date = date.fromisoformat(end_input) if end_input else date.today()

        if start_date > end_date:
            print(f"시작 날짜({start_date})가 종료 날짜({end_date})보다 늦습니다. 종료합니다.")
            return

        print(f"{start_date} ~ {end_date} 구간 거래내역 생성 중...")

        df, _ = generate_university_student_data(
            user_id=USER_ID,
            start_date=start_date,
            end_date=end_date,
        )

        if df.empty:
            print("생성된 거래가 없습니다 (날짜 범위를 다시 확인해주세요).")
            return

        for _, row in df.iterrows():
            tx = Transaction(
                tx_id=row["tx_id"],
                user_id=row["user_id"],
                tx_date=date.fromisoformat(str(row["tx_date"])),
                tx_time=time.fromisoformat(str(row["tx_time"])),
                amount=int(row["amount"]),
                merchant_name=str(row["merchant_name"]),
                mydata_category=str(row["mydata_category"]),
                final_category=str(row["final_category"]),
                is_user_corrected=bool(row["is_user_corrected"]),
            )
            session.add(tx)

        session.commit()
        print(f"✅ {len(df)}건의 거래내역을 추가했습니다 ({start_date} ~ {end_date}).")
        print("   (유저/레벨/포인트/상점 구매내역은 그대로 유지됨)")


if __name__ == "__main__":
    main()
