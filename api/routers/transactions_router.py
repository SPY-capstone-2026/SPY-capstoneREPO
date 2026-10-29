from datetime import date, datetime, time
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from sqlmodel import Session, select

from models import engine, User, Transaction
from auth import get_current_user_id
from schemas import (
    TransactionCreateRequest,
    TransactionUpdateRequest,
    CategorySuggestRequest,
    ImportConfirmRequest,
)
from serializers import serialize_transaction
from services.report_cache_service import invalidate_reports_containing_date
from services.category_classifier import (
    classify_merchants,
    normalize_merchant,
    remember_user_choice,
    validate_user_category,
)
from services.transaction_import_service import parse_file, build_preview, confirm_import
from services.time_utils import kst_now_naive

MEMO_MAX_LENGTH = 200


def _clean_memo(memo):
    if memo is None:
        return None
    memo = memo.strip()
    if len(memo) > MEMO_MAX_LENGTH:
        raise HTTPException(status_code=400, detail=f"메모는 {MEMO_MAX_LENGTH}자까지 입력할 수 있습니다")
    return memo or None

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

        # 카테고리를 비워 보내면 거래처명으로 자동 분류 (내 수정 기록 → 키워드)
        final_category = req.final_category
        if not final_category:
            final_category, _ = classify_merchants(session, user_id, [req.merchant_name])[req.merchant_name]
            if not final_category:
                raise HTTPException(
                    status_code=400,
                    detail="카테고리를 자동으로 정하지 못했습니다. 카테고리를 선택해 주세요",
                )
        else:
            validate_user_category(session, user_id, final_category)
            # 사용자가 직접 고른 카테고리는 다음 추천에 재사용
            remember_user_choice(session, user_id, req.merchant_name, final_category)

        transaction = Transaction(
            user_id=user_id,
            tx_date=req.tx_date,
            tx_time=req.tx_time or kst_now_naive().time().replace(microsecond=0),
            amount=req.amount,
            merchant_name=req.merchant_name,
            mydata_category=req.mydata_category,
            final_category=final_category,
            is_user_corrected=req.is_user_corrected if req.final_category else False,
            memo=_clean_memo(req.memo),
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

        if req.final_category is not None and req.final_category != transaction.final_category:
            validate_user_category(session, user_id, req.final_category)
            transaction.final_category = req.final_category
            transaction.is_user_corrected = True
            # 고친 값을 기억해서 같은 거래처의 다음 추천에 쓴다
            remember_user_choice(session, user_id, transaction.merchant_name, req.final_category)

        if req.is_user_corrected is not None:
            transaction.is_user_corrected = req.is_user_corrected

        if req.memo is not None:
            transaction.memo = _clean_memo(req.memo)

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


# [카테고리 추천] 거래처 이름으로 추천 카테고리 (직접 입력 화면, 가져오기 미리보기에서 사용)
@router.post("/transactions/classify")
def classify_transactions_api(
    req: CategorySuggestRequest,
    user_id: str = Depends(get_current_user_id),
):
    names = [n for n in dict.fromkeys(req.merchant_names) if n and n.strip()]
    if len(names) > 500:
        raise HTTPException(status_code=400, detail="한 번에 500개까지 추천받을 수 있습니다")

    with Session(engine) as session:
        result = classify_merchants(session, user_id, names)
        return {
            "status": "success",
            "data": [
                {
                    "merchant_name": name,
                    "normalized_name": normalize_merchant(name),
                    "suggested_category": result[name][0],
                    "source": result[name][1],
                }
                for name in names
            ],
        }


# [가져오기 1] 거래내역 파일 미리보기 (.xlsx/.csv, 토스뱅크 형식 또는 날짜·금액·결제처 표) — DB 변경 없음
@router.post("/transactions/import/preview")
async def preview_import_api(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    content = await file.read()
    source_format, rows = parse_file(content, file.filename or "")
    with Session(engine) as session:
        return {"status": "success", "data": build_preview(session, user_id, source_format, rows)}


# [가져오기 2] 미리보기에서 확정한 행 등록 (한 트랜잭션, 이미 있는 거래는 건너뜀)
@router.post("/transactions/import/confirm")
def confirm_import_api(
    req: ImportConfirmRequest,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        result = confirm_import(
            session,
            user_id,
            req.source_format,
            [row.model_dump() for row in req.rows],
            req.cancel_tx_ids,
        )
        return {"status": "success", "data": result}
