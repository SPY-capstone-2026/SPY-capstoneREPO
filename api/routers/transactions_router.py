from datetime import date, datetime, time
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select

from models import engine, User, Transaction
from auth import get_current_user_id
from schemas import TransactionCreateRequest, TransactionUpdateRequest
from serializers import serialize_transaction
from services.report_cache_service import invalidate_reports_containing_date

router = APIRouter()


@router.get("/transactions")
def get_transactions_api(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        transactions = session.exec(
            select(Transaction).where(Transaction.user_id == user_id)
        ).all()

        sorted_transactions = sorted(
            transactions,
            key=lambda item: (item.tx_date, item.tx_time),
            reverse=True,
        )

        return {
            "status": "success",
            "count": len(sorted_transactions),
            "data": [
                serialize_transaction(transaction)
                for transaction in sorted_transactions
            ],
        }


@router.post("/transactions")
def create_transaction_api(
    req: TransactionCreateRequest,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        transaction = Transaction(
            user_id=user_id,
            tx_date=req.tx_date,
            tx_time=req.tx_time or datetime.now().time().replace(microsecond=0),
            amount=req.amount,
            merchant_name=req.merchant_name,
            mydata_category=req.mydata_category,
            final_category=req.final_category,
            is_user_corrected=req.is_user_corrected,
        )

        session.add(transaction)
        session.commit()
        session.refresh(transaction)

        # 이 거래 날짜가 포함된 캐싱된 리포트가 있으면 무효화 (다음 조회 시 재계산)
        invalidate_reports_containing_date(session, user_id, transaction.tx_date)

        return {
            "status": "success",
            "data": serialize_transaction(transaction),
        }


@router.patch("/transactions/{tx_id}")
def update_transaction_api(
    tx_id: str,
    req: TransactionUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        transaction = session.get(Transaction, tx_id)

        if not transaction:
            raise HTTPException(status_code=404, detail="지출 내역을 찾을 수 없습니다")

        if transaction.user_id != user_id:
            raise HTTPException(status_code=403, detail="수정 권한이 없습니다")

        original_tx_date = transaction.tx_date  # 날짜가 바뀔 경우 이전 날짜도 무효화하기 위해 미리 저장

        if req.tx_date is not None:
            try:
                if isinstance(req.tx_date, date):
                    transaction.tx_date = req.tx_date
                else:
                    transaction.tx_date = date.fromisoformat(str(req.tx_date))
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="날짜 형식은 YYYY-MM-DD여야 합니다",
                )

        if req.tx_time is not None:
            try:
                if isinstance(req.tx_time, time):
                    transaction.tx_time = req.tx_time
                else:
                    transaction.tx_time = time.fromisoformat(str(req.tx_time))
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="시간 형식은 HH:MM이어야 합니다",
                )

        if req.amount is not None:
            transaction.amount = req.amount

        if req.merchant_name is not None:
            transaction.merchant_name = req.merchant_name

        if req.mydata_category is not None:
            transaction.mydata_category = req.mydata_category

        if req.final_category is not None:
            transaction.final_category = req.final_category

        if req.is_user_corrected is not None:
            transaction.is_user_corrected = req.is_user_corrected

        session.add(transaction)
        session.commit()
        session.refresh(transaction)

        # 날짜가 바뀐 경우 이전 날짜, 새 날짜 둘 다 캐시 무효화
        invalidate_reports_containing_date(session, user_id, original_tx_date)
        if transaction.tx_date != original_tx_date:
            invalidate_reports_containing_date(session, user_id, transaction.tx_date)

        return {
            "status": "success",
            "data": serialize_transaction(transaction),
        }


@router.delete("/transactions/{tx_id}")
def delete_transaction_api(
    tx_id: str,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        transaction = session.get(Transaction, tx_id)

        if not transaction:
            raise HTTPException(status_code=404, detail="지출 내역을 찾을 수 없습니다")

        if transaction.user_id != user_id:
            raise HTTPException(status_code=403, detail="삭제 권한이 없습니다")

        tx_date = transaction.tx_date  # 삭제 전에 날짜 확보 (무효화에 필요)

        session.delete(transaction)
        session.commit()

        # 이 거래가 있던 날짜가 포함된 캐싱된 리포트가 있으면 무효화
        invalidate_reports_containing_date(session, user_id, tx_date)

        return {
            "status": "success",
            "deleted_id": tx_id,
        }
