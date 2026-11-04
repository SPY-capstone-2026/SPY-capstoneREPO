"""
거래내역 파일 가져오기(토스뱅크 형식 + 직접 만든 표) / 자동 카테고리 분류 / 수정값 재사용 / memo 테스트.
실행: cd api && python -m pytest test/test_transaction_import.py -q
"""
import io
import threading
from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlmodel import Session, SQLModel, select

from main import app
from auth import create_access_token
from models import engine, User, Transaction, UserCategorySetting, MerchantCategoryRule, GeneratedReport
from services.category_classifier import normalize_merchant, keyword_category, resolve_to_user_category

IS_POSTGRES = engine.url.get_backend_name().startswith("postgresql")
client = TestClient(app)
U = "me"
HEADER = ["거래 일시", "적요", "거래 유형", "거래 기관", "계좌번호", "거래 금액", "거래 후 잔액", "메모"]

# 사용자가 보내 준 실제 형식 그대로 (최신순, 위쪽 안내 문구 포함)
SAMPLE = [
    ["2026.10.29 14:57:48", "컴포즈커피(간편결제)_2_KICC", "체크카드결제", "", "", "-4,100", "218,205", ""],
    ["2026.10.29 13:53:20", "최희규", "출금", "카카오뱅크", "3333000000000", "-80,000", "222,305", ""],
    ["2026.10.29 12:45:04", "체크카드 복권 당첨 취소", "출금", "", "", "-4", "302,305", ""],
    ["2026.10.29 12:45:03", "카드 캐시백 취소", "출금", "", "", "-500", "302,309", ""],
    ["2026.10.29 12:45:03", "네이버페이", "체크카드결제", "", "", "10,000", "302,809", ""],
    ["2026.10.29 09:10:00", "네이버페이", "체크카드결제", "", "", "-10,000", "292,809", ""],
    ["2026.10.28 19:20:11", "GS25 역삼점", "체크카드결제", "", "", -5500, 302809, "야식"],
    ["2026.10.28 08:30:00", "티머니", "체크카드결제", "", "", -1550, 308309, ""],
    ["2026.10.27 10:00:00", "월급", "입금", "국민은행", "1234", "500,000", "309,859", ""],
    ["2026.10.27 09:00:00", "예금이자", "입금", "", "", "12", "-", ""],
    ["2026.10.26 21:00:00", "무신사", "체크카드결제", "", "", "-39,900", "309,847", ""],
    ["2026.10.26 12:00:00", "SKT 통신요금", "자동이체", "", "", "-33,000", "349,747", ""],
]


def toss_xlsx(rows, preamble=True) -> bytes:
    wb = Workbook()
    ws = wb.active
    if preamble:
        ws.append([None, "토스뱅크 거래내역"])
        ws.append([None, "성명", "윤수연"])
        ws.append([None, "계좌번호", "****-****-0378"])
        ws.append([None, "조회기간", "2025.10.29 - 2026.10.29"])
        ws.append([])
        ws.append([None, "※ 본 거래내역은 법적효력이 없는 참고용 문서입니다."])
        ws.append([])
    ws.append([None] + HEADER)
    for r in rows:
        ws.append([None] + [None if v == "" else v for v in r])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def fresh_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        s.add(User(user_id=U, email="me@x", password_hash="x"))
        s.add(User(user_id="other", email="o@x", password_hash="x"))
        for uid in (U, "other"):
            for cat in ("카페", "식비", "쇼핑", "교통"):  # 신규 가입자 기본 카테고리
                s.add(UserCategorySetting(user_id=uid, category_name=cat, budget_limit=100000))
        s.commit()
    yield


def H(uid=U):
    return {"Authorization": f"Bearer {create_access_token(uid)}"}


def preview(content=None, filename="토스뱅크_거래내역.xlsx", uid=U):
    content = content if content is not None else toss_xlsx(SAMPLE)
    return client.post("/transactions/import/preview", headers=H(uid),
                       files={"file": (filename, content, "application/octet-stream")})


def confirm_payload(prev, overrides=None):
    overrides = overrides or {}
    rows = []
    for r in prev["rows"]:
        include = overrides.get(r["row_no"], {}).get("include", r["include"])
        if not include:
            continue
        rows.append({
            "import_key": r["import_key"], "occurred_at": r["occurred_at"],
            "merchant_name": r["merchant_name"], "amount": r["amount"],
            "final_category": overrides.get(r["row_no"], {}).get("category", r["suggested_category"]),
            "memo": r["memo"], "tx_type": r["tx_type"],
        })
    cancel = [r["refunds_tx_id"] for r in prev["rows"] if r["refunds_tx_id"]]
    return {"source_format": prev["source_format"], "rows": rows, "cancel_tx_ids": cancel}


def by_summary(prev, summary):
    return [r for r in prev["rows"] if r["summary"] == summary]


def txs(uid=U):
    with Session(engine) as s:
        return s.exec(select(Transaction).where(Transaction.user_id == uid)).all()


# ----------------------------------------
# 정리/분류 단위
# ----------------------------------------
@pytest.mark.parametrize("raw,expected", [
    ("컴포즈커피(간편결제)_2_KICC", "컴포즈커피"),
    ("GS25 역삼점", "GS25 역삼점"),
    ("스타벅스코리아_NICE", "스타벅스코리아"),
    ("  메가커피   강남점 ", "메가커피 강남점"),
    ("(주)무신사", "무신사"),
])
def test_normalize_merchant(raw, expected):
    assert normalize_merchant(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("컴포즈커피(간편결제)_2_KICC", "카페"), ("GS25 역삼점", "식비"), ("CU 홍대점", "식비"),
    ("티머니", "교통"), ("무신사", "의류"), ("올리브영 강남", "화장품"),
    ("네이버페이", None), ("카카오페이 스타벅스", None),   # 결제 대행은 분류하지 않음
    ("큐브라운지", None), ("CURRY HOUSE", None),           # 'cu' 오탐 방지
    ("최희규", None),
])
def test_keyword_category(raw, expected):
    assert keyword_category(raw) == expected


def test_resolve_to_user_category_fallback():
    assert resolve_to_user_category("의류", ["카페", "쇼핑"]) == "쇼핑"
    assert resolve_to_user_category("의류", ["의류", "쇼핑"]) == "의류"
    assert resolve_to_user_category("화장품", ["카페", "식비"]) is None
    assert resolve_to_user_category(None, ["카페"]) is None


# ----------------------------------------
# 미리보기
# ----------------------------------------
def test_preview_parses_sample_and_kinds():
    r = preview()
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["source_format"] == "TOSS"
    kinds = {r["summary"]: r["kind"] for r in data["rows"]}
    assert kinds["컴포즈커피(간편결제)_2_KICC"] == "EXPENSE"
    assert kinds["최희규"] == "TRANSFER"
    assert kinds["체크카드 복권 당첨 취소"] == "BENEFIT_REVERSAL"
    assert kinds["카드 캐시백 취소"] == "BENEFIT_REVERSAL"
    assert kinds["월급"] == "INCOME" and kinds["예금이자"] == "INCOME"
    assert kinds["SKT 통신요금"] == "OTHER_OUT"
    assert data["summary"]["total_rows"] == len(SAMPLE)
    assert data["categories"] == ["카페", "식비", "쇼핑", "교통"]

    compose = by_summary(data, "컴포즈커피(간편결제)_2_KICC")[0]
    assert compose["merchant_name"] == "컴포즈커피" and compose["amount"] == 4100
    assert compose["suggested_category"] == "카페" and compose["suggestion_source"] == "KEYWORD"
    assert compose["include"] and compose["importable"]
    assert compose["occurred_at"] == "2026-10-29T14:57:48"

    gs = by_summary(data, "GS25 역삼점")[0]
    assert gs["memo"] == "야식" and gs["amount"] == 5500  # 숫자 셀도 읽음

    # 무신사 → 의류 키워드 → 이 유저는 '쇼핑'만 있으므로 쇼핑
    assert by_summary(data, "무신사")[0]["suggested_category"] == "쇼핑"


def test_preview_defaults_exclude_non_spending():
    data = preview().json()["data"]
    included = {r["summary"] for r in data["rows"] if r["include"]}
    assert included == {"컴포즈커피(간편결제)_2_KICC", "GS25 역삼점", "티머니", "무신사"}
    for r in data["rows"]:
        if r["kind"] in ("INCOME", "REFUND", "BENEFIT_REVERSAL"):
            assert r["importable"] is False
    assert by_summary(data, "최희규")[0]["importable"] is True       # 사용자가 켤 수 있음
    assert by_summary(data, "SKT 통신요금")[0]["importable"] is True


def test_refund_pairs_with_payment_in_same_file():
    data = preview().json()["data"]
    pay = [r for r in by_summary(data, "네이버페이") if r["kind"] == "EXPENSE"][0]
    refund = [r for r in by_summary(data, "네이버페이") if r["kind"] == "REFUND"][0]
    assert pay["refunded_by_row"] == refund["row_no"] and refund["refunds_row"] == pay["row_no"]
    assert pay["include"] is False and pay["importable"] is False


def test_refund_not_paired_with_later_payment():
    rows = [
        ["2026.10.29 12:00:00", "스타벅스", "체크카드결제", "", "", "-4,500", "1", ""],   # 환불보다 나중 결제
        ["2026.10.29 11:00:00", "스타벅스", "체크카드결제", "", "", "4,500", "2", ""],    # 환불
    ]
    data = preview(toss_xlsx(rows)).json()["data"]
    pay = [r for r in data["rows"] if r["kind"] == "EXPENSE"][0]
    assert pay["include"] is True and pay["refunded_by_row"] is None


def test_preview_does_not_write_db():
    preview()
    assert txs() == []


@pytest.mark.parametrize("content,filename,detail", [
    (b"hello", "a.pdf", ".xlsx 또는 .csv"),
    (b"not an excel", "a.xlsx", "엑셀 파일을 열 수 없습니다"),
    (None, "a.xlsx", "형식을 알 수 없습니다"),
])
def test_preview_rejects_bad_files(content, filename, detail):
    if content is None:
        wb = Workbook(); wb.active.append(["날짜", "금액", "비고"]); buf = io.BytesIO(); wb.save(buf); content = buf.getvalue()
    r = preview(content, filename)
    assert r.status_code == 400 and detail in r.json()["detail"]


def test_preview_csv_same_format_cp949():
    lines = ["토스뱅크 거래내역", "", ",".join(HEADER),
             '2026.10.29 14:57:48,스타벅스,체크카드결제,,,"-4,500","1,000",']
    r = preview("\n".join(lines).encode("cp949"), "toss.csv")
    assert r.status_code == 200
    assert r.json()["data"]["rows"][0]["suggested_category"] == "카페"


def test_preview_bad_row_marked_invalid_not_whole_file():
    rows = [["어제", "스타벅스", "체크카드결제", "", "", "-4500", "1", ""],
            ["2026.10.29 10:00:00", "스타벅스", "체크카드결제", "", "", "-4500", "2", ""]]
    r = preview(toss_xlsx(rows))
    assert r.status_code == 200
    bad, good = r.json()["data"]["rows"]
    assert bad["row_no"] == 9 and bad["kind"] == "INVALID" and bad["error"] and not bad["importable"]
    assert good["kind"] == "EXPENSE" and good["include"]
    assert r.json()["data"]["summary"]["invalid"] == 1


# ----------------------------------------
# 등록
# ----------------------------------------
def test_confirm_inserts_only_expenses_and_never_income():
    prev = preview().json()["data"]
    r = client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    assert r.status_code == 200, r.text
    assert r.json()["data"]["inserted"] == 4
    rows = {t.merchant_name: t for t in txs()}
    assert set(rows) == {"컴포즈커피", "GS25 역삼점", "티머니", "무신사"}
    assert all(t.amount > 0 for t in rows.values())
    assert rows["컴포즈커피"].tx_date == date(2026, 10, 29) and rows["컴포즈커피"].tx_time == time(14, 57, 48)
    assert rows["컴포즈커피"].mydata_category == "토스뱅크:체크카드결제"
    assert rows["GS25 역삼점"].memo == "야식"
    assert rows["무신사"].final_category == "쇼핑" and rows["무신사"].is_user_corrected is False
    assert all(t.import_key for t in rows.values())


def test_reupload_same_file_creates_no_duplicates():
    prev = preview().json()["data"]
    client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    again = preview().json()["data"]
    assert again["summary"]["duplicate"] == 4
    assert again["summary"]["included"] == 0
    # 미리보기를 무시하고 같은 행을 다시 보내도 건너뛴다
    r = client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    assert r.json()["data"] == {**r.json()["data"], "inserted": 0, "skipped_duplicate": 4}
    assert len(txs()) == 4


def test_overlapping_period_upload_adds_only_new_rows():
    client.post("/transactions/import/confirm", json=confirm_payload(preview(toss_xlsx(SAMPLE[6:])).json()["data"]), headers=H())
    n_before = len(txs())
    prev = preview().json()["data"]
    client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    assert len(txs()) == n_before + 1  # 컴포즈커피만 새로


def test_transfer_included_by_user_with_category():
    prev = preview().json()["data"]
    row = by_summary(prev, "최희규")[0]["row_no"]
    payload = confirm_payload(prev, {row: {"include": True, "category": "식비"}})
    assert client.post("/transactions/import/confirm", json=payload, headers=H()).status_code == 200
    t = [t for t in txs() if t.merchant_name == "최희규"][0]
    assert t.final_category == "식비" and t.amount == 80000 and t.is_user_corrected is True


def test_confirm_requires_valid_category():
    prev = preview().json()["data"]
    row = by_summary(prev, "최희규")[0]["row_no"]
    payload = confirm_payload(prev, {row: {"include": True, "category": None}})
    r = client.post("/transactions/import/confirm", json=payload, headers=H())
    assert r.status_code == 400 and "최희규" in r.json()["detail"] and "카테고리" in r.json()["detail"]
    payload = confirm_payload(prev, {row: {"include": True, "category": "없는카테고리"}})
    r = client.post("/transactions/import/confirm", json=payload, headers=H())
    assert r.status_code == 400 and "최희규" in r.json()["detail"]
    assert txs() == []  # 하나라도 잘못되면 아무것도 저장 안 함


def test_confirm_rejects_non_positive_amount():
    prev = preview().json()["data"]
    payload = confirm_payload(prev)
    payload["rows"][0]["amount"] = -100
    assert client.post("/transactions/import/confirm", json=payload, headers=H()).status_code == 400
    assert txs() == []


def test_refund_in_later_file_cancels_previously_imported_payment():
    first = [["2026.10.20 12:00:00", "에이블리", "체크카드결제", "", "", "-29,900", "100", ""]]
    client.post("/transactions/import/confirm",
                json=confirm_payload(preview(toss_xlsx(first)).json()["data"]), headers=H())
    assert len(txs()) == 1
    later = [["2026.10.25 09:00:00", "에이블리", "체크카드결제", "", "", "29,900", "200", ""]]
    prev = preview(toss_xlsx(later)).json()["data"]
    refund = prev["rows"][0]
    assert refund["kind"] == "REFUND" and refund["refunds_tx_id"] == txs()[0].tx_id
    r = client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    assert r.json()["data"]["cancelled"] == 1 and txs() == []


def test_refund_with_payment_in_both_files_cancels_db_row():
    """결제를 먼저 가져왔고, 다음 파일에 결제(중복)와 환불이 같이 있는 경우."""
    pay = ["2026.10.20 12:00:00", "에이블리", "체크카드결제", "", "", "-29,900", "100", ""]
    client.post("/transactions/import/confirm",
                json=confirm_payload(preview(toss_xlsx([pay])).json()["data"]), headers=H())
    refund = ["2026.10.25 09:00:00", "에이블리", "체크카드결제", "", "", "29,900", "200", ""]
    prev = preview(toss_xlsx([refund, pay])).json()["data"]
    assert [r for r in prev["rows"] if r["kind"] == "REFUND"][0]["refunds_tx_id"] == txs()[0].tx_id
    client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    assert txs() == []


def test_cancel_ignores_manual_and_other_users_transactions():
    with Session(engine) as s:
        s.add(Transaction(tx_id="manual", user_id=U, tx_date=date(2026, 10, 1), tx_time=time(9), amount=100,
                          merchant_name="x", mydata_category="직접 입력", final_category="식비"))
        s.add(Transaction(tx_id="theirs", user_id="other", tx_date=date(2026, 10, 1), tx_time=time(9), amount=100,
                          merchant_name="x", mydata_category="토스뱅크:체크카드결제", final_category="식비",
                          import_key="k"))
        s.commit()
    r = client.post("/transactions/import/confirm", json={"source_format": "TOSS", "rows": [], "cancel_tx_ids": ["manual", "theirs"]},
                    headers=H())
    assert r.json()["data"]["cancelled"] == 0
    assert len(txs()) == 1 and len(txs("other")) == 1


def test_confirm_invalidates_only_overlapping_report_cache():
    with Session(engine) as s:
        for start, end in ((date(2026, 10, 26), date(2026, 11, 1)), (date(2026, 9, 1), date(2026, 9, 7)),
                           (date(2026, 11, 2), date(2026, 11, 8))):
            s.add(GeneratedReport(user_id=U, report_type="WEEKLY", period_start=start, period_end=end, report_data={}))
        s.commit()
    prev = preview().json()["data"]
    client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    with Session(engine) as s:
        left = s.exec(select(GeneratedReport)).all()
    assert sorted(r.period_start for r in left) == [date(2026, 9, 1), date(2026, 11, 2)]


def test_import_other_user_isolated():
    prev = preview().json()["data"]
    client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    # 다른 유저가 같은 파일을 올리면 중복이 아니다 (import_key 에 user_id 포함)
    other = preview(uid="other").json()["data"]
    assert other["summary"]["duplicate"] == 0


# ----------------------------------------
# 수정값 저장 / 재사용
# ----------------------------------------
def test_user_correction_is_reused_in_next_import():
    prev = preview().json()["data"]
    gs = by_summary(prev, "GS25 역삼점")[0]["row_no"]
    client.post("/transactions/import/confirm",
                json=confirm_payload(prev, {gs: {"category": "카페"}}), headers=H())
    t = [t for t in txs() if t.merchant_name == "GS25 역삼점"][0]
    assert t.final_category == "카페" and t.is_user_corrected is True

    nxt = [["2026.10.30 08:00:00", "GS25 역삼점", "체크카드결제", "", "", "-2,000", "1", ""]]
    row = preview(toss_xlsx(nxt)).json()["data"]["rows"][0]
    assert row["suggested_category"] == "카페" and row["suggestion_source"] == "USER_RULE"
    # 다른 지점은 별개 거래처라 키워드 추천
    other_branch = [["2026.10.30 08:00:00", "GS25 강남점", "체크카드결제", "", "", "-2,000", "1", ""]]
    assert preview(toss_xlsx(other_branch)).json()["data"]["rows"][0]["suggested_category"] == "식비"


def test_patch_category_marks_corrected_and_learns():
    r = client.post("/transactions", json={"tx_date": "2026-10-29", "amount": 3000, "merchant_name": "메가커피"},
                    headers=H())
    assert r.status_code == 200
    created = r.json()["data"]
    assert created["final_category"] == "카페" and created["is_user_corrected"] is False
    r = client.patch(f"/transactions/{created['tx_id']}", json={"final_category": "식비"}, headers=H())
    assert r.json()["data"]["is_user_corrected"] is True
    sug = client.post("/transactions/classify", json={"merchant_names": ["메가커피"]}, headers=H()).json()["data"][0]
    assert sug["suggested_category"] == "식비" and sug["source"] == "USER_RULE"
    # 다른 유저에게는 영향 없음
    sug = client.post("/transactions/classify", json={"merchant_names": ["메가커피"]}, headers=H("other")).json()["data"][0]
    assert sug["suggested_category"] == "카페" and sug["source"] == "KEYWORD"


def test_patch_same_category_does_not_mark_corrected():
    tx = client.post("/transactions", json={"tx_date": "2026-10-29", "amount": 3000, "merchant_name": "메가커피"},
                     headers=H()).json()["data"]
    r = client.patch(f"/transactions/{tx['tx_id']}", json={"final_category": "카페"}, headers=H())
    assert r.json()["data"]["is_user_corrected"] is False
    with Session(engine) as s:
        assert s.exec(select(MerchantCategoryRule)).all() == []


def test_create_with_explicit_category_learns_choice():
    client.post("/transactions", json={"tx_date": "2026-10-29", "amount": 7000, "merchant_name": "동네밥집",
                                       "final_category": "식비"}, headers=H())
    sug = client.post("/transactions/classify", json={"merchant_names": ["동네밥집"]}, headers=H()).json()["data"][0]
    assert sug["suggested_category"] == "식비" and sug["source"] == "USER_RULE"


def test_rule_category_removed_later_falls_back_to_keyword():
    client.post("/transactions", json={"tx_date": "2026-10-29", "amount": 3000, "merchant_name": "메가커피",
                                       "final_category": "쇼핑"}, headers=H())
    with Session(engine) as s:
        s.delete(s.exec(select(UserCategorySetting).where(UserCategorySetting.user_id == U,
                                                          UserCategorySetting.category_name == "쇼핑")).one())
        s.commit()
    sug = client.post("/transactions/classify", json={"merchant_names": ["메가커피"]}, headers=H()).json()["data"][0]
    assert sug["suggested_category"] == "카페" and sug["source"] == "KEYWORD"


# ----------------------------------------
# 직접 입력 CRUD
# ----------------------------------------
def test_create_without_category_unclassifiable_400():
    r = client.post("/transactions", json={"tx_date": "2026-10-29", "amount": 3000, "merchant_name": "최희규"},
                    headers=H())
    assert r.status_code == 400 and "카테고리" in r.json()["detail"]


def test_create_with_unknown_category_400():
    r = client.post("/transactions", json={"tx_date": "2026-10-29", "amount": 3000, "merchant_name": "x",
                                           "final_category": "여행"}, headers=H())
    assert r.status_code == 400


def test_memo_create_update_clear_and_limit():
    tx = client.post("/transactions", json={"tx_date": "2026-10-29", "amount": 3000, "merchant_name": "스타벅스",
                                            "memo": "  시험공부  "}, headers=H()).json()["data"]
    assert tx["memo"] == "시험공부" and tx["is_imported"] is False
    r = client.patch(f"/transactions/{tx['tx_id']}", json={"memo": "수정"}, headers=H())
    assert r.json()["data"]["memo"] == "수정"
    r = client.patch(f"/transactions/{tx['tx_id']}", json={"amount": 3500}, headers=H())
    assert r.json()["data"]["memo"] == "수정"            # 안 보내면 유지
    r = client.patch(f"/transactions/{tx['tx_id']}", json={"memo": ""}, headers=H())
    assert r.json()["data"]["memo"] is None              # 빈 문자열이면 삭제
    r = client.patch(f"/transactions/{tx['tx_id']}", json={"memo": "가" * 201}, headers=H())
    assert r.status_code == 400
    listed = client.get("/transactions", headers=H()).json()["data"][0]
    assert "memo" in listed and "is_imported" in listed


def test_classify_api_validation():
    r = client.post("/transactions/classify", json={"merchant_names": [f"m{i}" for i in range(501)]}, headers=H())
    assert r.status_code == 400
    r = client.post("/transactions/classify", json={"merchant_names": ["컴포즈커피(간편결제)_2_KICC", "", "x"]},
                    headers=H())
    data = r.json()["data"]
    assert [d["merchant_name"] for d in data] == ["컴포즈커피(간편결제)_2_KICC", "x"]
    assert data[0]["normalized_name"] == "컴포즈커피" and data[1]["source"] == "NONE"


def test_endpoints_require_auth():
    assert client.post("/transactions/classify", json={"merchant_names": []}).status_code == 401
    assert client.post("/transactions/import/confirm", json={"source_format": "TOSS", "rows": []}).status_code == 401
    assert client.post("/transactions/import/preview",
                       files={"file": ("a.xlsx", b"x", "application/octet-stream")}).status_code == 401


# ----------------------------------------
# 시드 스크립트가 가져온 거래를 건드리지 않음
# ----------------------------------------
def test_reseed_and_extend_ignore_imported_rows(tmp_path):
    import reseed_transactions as rs
    import extend_transactions as ex
    from datetime import datetime
    prev = preview().json()["data"]
    client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    with Session(engine) as s:
        s.add(Transaction(tx_id="gen1", user_id=U, tx_date=date(2026, 10, 1), tx_time=time(9), amount=100,
                          merchant_name="학생식당", mydata_category="식비", final_category="식비"))
        s.commit()
        assert ex.get_last_generated_at(s, U) == datetime(2026, 10, 1, 9, 0)
        plan = rs.plan_reseed(s, U, until=datetime(2026, 10, 2, 12, 0))
        assert len(plan["generated"]) == 1 and len(plan["manual"]) == 4
        backup = rs.save_backup(plan["current"], U, backup_dir=str(tmp_path))
        rs.apply_reseed(s, U, plan)
    imported = [t for t in txs() if t.import_key]
    assert len(imported) == 4 and "gen1" not in {t.tx_id for t in txs()}
    with Session(engine) as s:
        rs.restore_backup(s, U, backup)
    restored = {t.tx_id: t for t in txs()}
    assert "gen1" in restored
    assert sorted(t.memo or "" for t in restored.values() if t.import_key) == ["", "", "", "야식"]
    assert len([t for t in restored.values() if t.import_key]) == 4


# ----------------------------------------
# 동시성 (Postgres)
# ----------------------------------------
@pytest.mark.skipif(not IS_POSTGRES, reason="동시성은 Postgres 에서만 검증")
def test_concurrent_confirm_same_file_no_duplicates():
    prev = preview().json()["data"]
    payload = confirm_payload(prev)
    for _ in range(5):
        with Session(engine) as s:
            for t in s.exec(select(Transaction)).all():
                s.delete(t)
            s.commit()
        barrier = threading.Barrier(3)
        codes = []

        def go():
            barrier.wait()
            codes.append(client.post("/transactions/import/confirm", json=payload, headers=H()).status_code)

        ts = [threading.Thread(target=go) for _ in range(3)]
        [t.start() for t in ts]
        [t.join() for t in ts]
        assert all(c in (200, 409) for c in codes), codes
        assert len(txs()) == 4


@pytest.mark.skipif(not IS_POSTGRES, reason="동시성은 Postgres 에서만 검증")
def test_concurrent_first_rule_creation():
    for i in range(5):
        with Session(engine) as s:
            for r in s.exec(select(MerchantCategoryRule)).all():
                s.delete(r)
            s.commit()
        barrier = threading.Barrier(3)
        codes = []

        def go(cat):
            barrier.wait()
            codes.append(client.post("/transactions", json={"tx_date": "2026-10-29", "amount": 1000,
                                                            "merchant_name": f"새가게{i}", "final_category": cat},
                                     headers=H()).status_code)

        ts = [threading.Thread(target=go, args=(c,)) for c in ("식비", "카페", "쇼핑")]
        [t.start() for t in ts]
        [t.join() for t in ts]
        assert codes == [200, 200, 200], codes
        with Session(engine) as s:
            assert len(s.exec(select(MerchantCategoryRule)).all()) == 1


# ----------------------------------------
# 직접 만든 표 (기존 프론트 CSV 형식: 날짜, 금액, 결제처 + 선택 카테고리·시간·메모)
# ----------------------------------------
def csv_bytes(lines, encoding="utf-8-sig"):
    return "\n".join(lines).encode(encoding)


GENERIC = [
    "날짜,금액,결제처,카테고리,시간,메모",
    "2026-10-29,4500,스타벅스,카페,09:10,",
    '2026-10-29,"12,000",동네밥집,식비,,점심',
    "2026-10-28,3000,메가커피,,,",                 # 카테고리 비움 → 추천
    "2026-10-28,30000,올리브영,화장품,,",          # 이 유저에게 없는 카테고리 → 추천으로 + 경고
    "2026-10-27,1500,최희규,,,",                   # 추천 없음
]


def test_generic_csv_detected_and_categories():
    r = preview(csv_bytes(GENERIC), "내소비.csv")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["source_format"] == "GENERIC"
    rows = {row["merchant_name"]: row for row in data["rows"]}
    assert all(row["kind"] == "EXPENSE" for row in rows.values())
    assert rows["스타벅스"]["suggested_category"] == "카페" and rows["스타벅스"]["suggestion_source"] == "FILE"
    assert rows["스타벅스"]["occurred_at"] == "2026-10-29T09:10:00"
    assert rows["동네밥집"]["amount"] == 12000 and rows["동네밥집"]["memo"] == "점심"
    assert rows["동네밥집"]["occurred_at"] == "2026-10-29T12:00:00"           # 시간 없으면 12:00
    assert rows["메가커피"]["suggested_category"] == "카페" and rows["메가커피"]["suggestion_source"] == "KEYWORD"
    assert rows["올리브영"]["suggested_category"] == "쇼핑" and "화장품" in rows["올리브영"]["warning"]
    assert rows["최희규"]["suggested_category"] is None and rows["최희규"]["include"] is True
    assert data["summary"]["included"] == 5


def test_generic_confirm_and_reupload_no_duplicates():
    prev = preview(csv_bytes(GENERIC), "a.csv").json()["data"]
    prev["rows"] = [r for r in prev["rows"] if r["suggested_category"]]
    r = client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    assert r.status_code == 200 and r.json()["data"]["inserted"] == 4
    t = {t.merchant_name: t for t in txs()}
    assert t["스타벅스"].mydata_category == "파일 업로드" and t["스타벅스"].import_key
    again = preview(csv_bytes(GENERIC), "a.csv").json()["data"]
    assert again["summary"]["duplicate"] == 4
    assert client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H()).json()["data"]["inserted"] == 0
    assert len(txs()) == 4


def test_generic_file_category_differs_from_keyword_is_learned():
    lines = ["날짜,금액,결제처,카테고리", "2026-10-29,3000,메가커피,식비"]
    prev = preview(csv_bytes(lines), "a.csv").json()["data"]
    assert prev["rows"][0]["suggested_category"] == "식비"
    client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    assert txs()[0].is_user_corrected is True
    sug = client.post("/transactions/classify", json={"merchant_names": ["메가커피"]}, headers=H()).json()["data"][0]
    assert sug["suggested_category"] == "식비" and sug["source"] == "USER_RULE"


def test_generic_identical_rows_are_separate_transactions():
    lines = ["날짜,금액,결제처", "2026-10-29,2000,메가커피", "2026-10-29,2000,메가커피"]
    prev = preview(csv_bytes(lines), "a.csv").json()["data"]
    keys = [r["import_key"] for r in prev["rows"]]
    assert len(set(keys)) == 2
    client.post("/transactions/import/confirm", json=confirm_payload(prev), headers=H())
    assert len(txs()) == 2
    # 같은 파일을 다시 올려도 2건 그대로
    client.post("/transactions/import/confirm",
                json=confirm_payload(preview(csv_bytes(lines), "a.csv").json()["data"]), headers=H())
    assert len(txs()) == 2


def test_generic_invalid_rows_listed_with_reason():
    lines = ["날짜,금액,결제처", "10/29,2000,메가커피", "2026-10-29,이천원,메가커피",
             "2026-10-29,0,메가커피", "2026-10-29,2000,", "2026-13-01,2000,메가커피", "2026-10-29,2000,메가커피"]
    data = preview(csv_bytes(lines), "a.csv").json()["data"]
    errors = {r["row_no"]: r["error"] for r in data["rows"] if r["kind"] == "INVALID"}
    assert set(errors) == {2, 3, 4, 5, 6}
    assert "날짜" in errors[2] and "금액" in errors[3] and "0원" in errors[4] and "결제처" in errors[5]
    assert data["summary"]["invalid"] == 5 and data["summary"]["included"] == 1


def test_generic_header_aliases_xlsx_and_date_formats():
    wb = Workbook(); ws = wb.active
    ws.append(["내 소비 기록"])                       # 머리글 위에 제목 줄
    ws.append(["거래일", "가맹점", "거래금액", "분류"])
    from datetime import datetime as dt
    ws.append([dt(2026, 10, 29, 14, 30), "스타벅스", 4500, "카페"])   # 엑셀 날짜 셀 (시간 포함)
    ws.append(["2026.10.28", "GS25", "₩3,000", None])
    ws.append(["2026/10/27", "티머니", "1550원", None])
    buf = io.BytesIO(); wb.save(buf)
    data = preview(buf.getvalue(), "내소비.xlsx").json()["data"]
    assert data["source_format"] == "GENERIC"
    rows = data["rows"]
    assert [r["occurred_at"] for r in rows] == ["2026-10-29T14:30:00", "2026-10-28T12:00:00", "2026-10-27T12:00:00"]
    assert [r["amount"] for r in rows] == [4500, 3000, 1550]
    assert [r["suggested_category"] for r in rows] == ["카페", "식비", "교통"]


def test_generic_negative_majority_means_spending():
    lines = ["날짜,금액,결제처", "2026-10-29,-4500,스타벅스", "2026-10-29,-3000,GS25", "2026-10-29,50000,용돈"]
    rows = {r["merchant_name"]: r for r in preview(csv_bytes(lines), "a.csv").json()["data"]["rows"]}
    assert rows["스타벅스"]["kind"] == "EXPENSE" and rows["스타벅스"]["amount"] == 4500
    assert rows["용돈"]["kind"] == "INCOME" and rows["용돈"]["importable"] is False


def test_generic_cp949_and_header_with_spaces():
    lines = ["날 짜,금 액,결제처", "2026-10-29,4500,스타벅스"]
    data = preview(csv_bytes(lines, "cp949"), "a.csv").json()["data"]
    assert data["source_format"] == "GENERIC" and data["rows"][0]["suggested_category"] == "카페"


def test_old_frontend_csv_format_still_accepted():
    """지금 프론트 CsvImportCard 가 요구하던 열 이름 그대로."""
    lines = ["날짜,금액,결제처,카테고리,시간", "2026-10-29,4500,스타벅스,카페,09:10:30"]
    row = preview(csv_bytes(lines), "a.csv").json()["data"]["rows"][0]
    assert row["occurred_at"] == "2026-10-29T09:10:30" and row["include"]


def test_toss_csv_is_toss_not_generic():
    lines = ["토스뱅크 거래내역", "", ",".join(HEADER),
             '2026.10.29 14:57:48,스타벅스,체크카드결제,,,"-4,500","1,000",']
    assert preview(csv_bytes(lines), "toss.csv").json()["data"]["source_format"] == "TOSS"


def test_confirm_rejects_unknown_source_format():
    r = client.post("/transactions/import/confirm", json={"source_format": "KB", "rows": []}, headers=H())
    assert r.status_code == 400
