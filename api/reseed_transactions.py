"""
테스트 계정의 '생성된' 거래내역만 새 패턴(generate_seed.py v2)으로 교체한다.
seed_all.py 와 달리 유저/레벨/포인트/상점/친구/챌린지/예산은 건드리지 않는다.

    python reseed_transactions.py                    # 미리보기만 (DB 변경 없음)
    python reseed_transactions.py --apply            # 백업 CSV 저장 → 교체
    python reseed_transactions.py --restore backups/tx_backup_....csv   # 백업으로 되돌리기

옵션
    --user USER_ID            기본: generate_seed.USER_ID (user-office-001)
    --start YYYY-MM-DD        새로 만들 시작일. 기본: 지금 남아 있는 생성 거래의 첫 날짜
    --regenerate-today        오늘(KST)의 미체크(PENDING) 챌린지를 지워서, 앱에서 다시 열면
                              새 거래 기준으로 챌린지를 다시 만들게 한다. (체크한 챌린지는 안 건드림)

규칙
- '생성된 거래' = mydata_category 가 "직접 입력" 이 아닌 거래. (API/앱에서 직접 넣은 거래는 남긴다)
- 교체는 한 트랜잭션: 중간에 실패하면 아무것도 바뀌지 않는다.
- 끝난 기간 리포트 캐시(generatedreport)는 이 유저 것만 지운다. (다음 조회 때 새로 계산)
- 이미 정산이 끝난 챌린지(SUCCESS/FAILED)는 재검증하지 않는다. (팀 정책)
"""
import argparse
import os
from datetime import date, datetime, time, timedelta
from typing import Optional

import pandas as pd
from sqlmodel import Session, select, delete

from models import engine, Transaction, GeneratedReport, DailyChallenge
from generate_seed import USER_ID, COLUMNS, generate_university_student_data, summarize
from services.time_utils import kst_now_naive

MANUAL_CATEGORY = "직접 입력"  # schemas.TransactionCreateRequest 의 기본값
BACKUP_DIR = "backups"


def _generated_filter(user_id: str):
    return (Transaction.user_id == user_id) & (Transaction.mydata_category != MANUAL_CATEGORY)


def load_user_transactions(session: Session, user_id: str) -> pd.DataFrame:
    rows = session.exec(select(Transaction).where(Transaction.user_id == user_id)).all()
    return pd.DataFrame(
        [{
            "tx_id": t.tx_id, "user_id": t.user_id, "tx_date": t.tx_date.isoformat(),
            "tx_time": t.tx_time.strftime("%H:%M:%S"), "amount": t.amount,
            "merchant_name": t.merchant_name, "mydata_category": t.mydata_category,
            "final_category": t.final_category, "is_user_corrected": bool(t.is_user_corrected),
        } for t in rows],
        columns=COLUMNS,
    )


def rows_to_transactions(df: pd.DataFrame):
    for _, row in df.iterrows():
        yield Transaction(
            tx_id=str(row["tx_id"]),
            user_id=str(row["user_id"]),
            tx_date=date.fromisoformat(str(row["tx_date"])),
            tx_time=time.fromisoformat(str(row["tx_time"])),
            amount=int(row["amount"]),
            merchant_name=str(row["merchant_name"]),
            mydata_category=str(row["mydata_category"]),
            final_category=str(row["final_category"]),
            is_user_corrected=str(row["is_user_corrected"]).lower() == "true",
        )


def save_backup(df: pd.DataFrame, user_id: str, backup_dir: str = BACKUP_DIR) -> str:
    os.makedirs(backup_dir, exist_ok=True)
    path = os.path.join(backup_dir, f"tx_backup_{user_id}_{kst_now_naive():%Y%m%d_%H%M%S}.csv")
    df.to_csv(path, index=False)
    return path


def plan_reseed(session: Session, user_id: str, start: Optional[date] = None,
                until: Optional[datetime] = None) -> dict:
    current = load_user_transactions(session, user_id)
    generated = current[current["mydata_category"] != MANUAL_CATEGORY]
    manual = current[current["mydata_category"] == MANUAL_CATEGORY]

    until = until or kst_now_naive()
    if start is None:
        start = (date.fromisoformat(generated["tx_date"].min()) if not generated.empty
                 else until.date() - timedelta(days=180))

    new_df, _ = generate_university_student_data(
        user_id=user_id, start_date=start, end_date=until.date(), until=until)
    return {"current": current, "generated": generated, "manual": manual,
            "new": new_df, "start": start, "until": until}


def apply_reseed(session: Session, user_id: str, plan: dict, regenerate_today: bool = False) -> dict:
    """한 트랜잭션으로 교체. 호출 전에 백업을 저장해 둘 것."""
    session.expunge_all()  # 미리보기 때 읽은 객체와 같은 tx_id 를 다시 넣어도 충돌하지 않게
    deleted = session.execute(delete(Transaction).where(_generated_filter(user_id))).rowcount
    for tx in rows_to_transactions(plan["new"]):
        session.add(tx)
    reports = session.execute(delete(GeneratedReport).where(GeneratedReport.user_id == user_id)).rowcount
    challenges = 0
    if regenerate_today:
        challenges = session.execute(
            delete(DailyChallenge)
            .where(DailyChallenge.user_id == user_id)
            .where(DailyChallenge.challenge_date == plan["until"].date())
            .where(DailyChallenge.status == "PENDING")
        ).rowcount
    session.commit()
    return {"deleted": deleted, "inserted": len(plan["new"]),
            "reports_cleared": reports, "challenges_cleared": challenges}


def restore_backup(session: Session, user_id: str, path: str) -> dict:
    """백업 CSV 상태로 이 유저의 거래 전체를 되돌린다 (한 트랜잭션)."""
    df = pd.read_csv(path, dtype={"tx_id": str})
    if not df.empty and set(df["user_id"].astype(str)) != {user_id}:
        raise SystemExit(f"백업 파일의 user_id 가 {user_id} 가 아닙니다. 중단합니다.")
    session.expunge_all()
    deleted = session.execute(delete(Transaction).where(Transaction.user_id == user_id)).rowcount
    for tx in rows_to_transactions(df):
        session.add(tx)
    session.execute(delete(GeneratedReport).where(GeneratedReport.user_id == user_id))
    session.commit()
    return {"deleted": deleted, "restored": len(df)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", default=USER_ID)
    parser.add_argument("--start", type=date.fromisoformat)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--restore")
    parser.add_argument("--regenerate-today", action="store_true")
    args = parser.parse_args()
    engine.echo = False

    with Session(engine) as session:
        if args.restore:
            print(f"[복원] {args.restore} → user {args.user} 의 거래 전체를 이 파일 내용으로 바꿉니다.")
            if input("진행할까요? (yes 입력): ").strip() != "yes":
                return print("취소했습니다.")
            print("✅", restore_backup(session, args.user, args.restore))
            return

        plan = plan_reseed(session, args.user, args.start)
        print(f"대상 유저: {args.user}")
        print(f"지금 거래: 전체 {len(plan['current'])}건 = 생성 {len(plan['generated'])}건 "
              f"+ 직접 입력 {len(plan['manual'])}건(유지)")
        if not plan["generated"].empty:
            print(f"  생성 거래 기간: {plan['generated']['tx_date'].min()} ~ {plan['generated']['tx_date'].max()}")
        print(f"새로 만들 거래: {len(plan['new'])}건 ({plan['start']} ~ {plan['until']:%Y-%m-%d %H:%M} KST)")
        print("\n--- 지금 (생성 거래) ---\n" + summarize(plan["generated"]))
        print("\n--- 교체 후 ---\n" + summarize(plan["new"]))

        if not args.apply:
            print("\n미리보기만 했습니다. 실제로 바꾸려면 --apply 를 붙여 다시 실행하세요.")
            return

        backup = save_backup(plan["current"], args.user)
        print(f"\n백업 저장: {backup}  (되돌리기: python reseed_transactions.py --restore {backup})")
        if input("운영 DB에 적용합니다. 진행할까요? (yes 입력): ").strip() != "yes":
            return print("취소했습니다. (DB 변경 없음)")
        print("✅", apply_reseed(session, args.user, plan, args.regenerate_today))


if __name__ == "__main__":
    main()
