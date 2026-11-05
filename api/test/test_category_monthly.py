"""
월 × 카테고리 지출 합계 (GET /reports/category-monthly) + 월간 리포트의 category_history 전달 테스트.
실행: cd api && python -m pytest test/test_category_monthly.py -q
"""
from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, SQLModel

import routers.reports_router as reports_router
from main import app
from auth import create_access_token
from models import engine, User, Transaction, UserCategorySetting
from services.reports_service import shift_month, call_with_supported_kwargs

client = TestClient(app)
TODAY = date(2026, 11, 5)


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(reports_router, "kst_today", lambda: TODAY)
    with Session(engine) as s:
        for uid in ("me", "other"):
            s.add(User(user_id=uid, email=f"{uid}@x", password_hash="x"))
            for cat, limit in (("식비", 300000), ("카페", 80000)):
                s.add(UserCategorySetting(user_id=uid, category_name=cat, budget_limit=limit))
        s.commit()
    yield


def H(uid="me"):
    return {"Authorization": f"Bearer {create_access_token(uid)}"}


def tx(d, amount, category, uid="me"):
    with Session(engine) as s:
        s.add(Transaction(user_id=uid, tx_date=d, tx_time=time(12), amount=amount, merchant_name="x",
                          mydata_category="식비", final_category=category))
        s.commit()


def get(**params):
    return client.get("/reports/category-monthly", params=params, headers=H())


# ----------------------------------------
# 단위
# ----------------------------------------
@pytest.mark.parametrize("start,n,expected", [
    (date(2026, 11, 1), -5, date(2026, 6, 1)),
    (date(2026, 2, 1), -5, date(2025, 9, 1)),
    (date(2026, 12, 1), 1, date(2027, 1, 1)),
    (date(2026, 1, 1), 0, date(2026, 1, 1)),
])
def test_shift_month(start, n, expected):
    assert shift_month(start, n) == expected


def test_call_with_supported_kwargs():
    def old(a, b=None, c=None):
        return (a, b, c)

    def new(a, b=None, c=None, category_history=None):
        return (a, category_history)

    def anything(*args, **kwargs):
        return kwargs

    assert call_with_supported_kwargs(old, 1, 2, 3, category_history=[1], category_settings=[2]) == (1, 2, 3)
    assert call_with_supported_kwargs(new, 1, category_history=[1], category_settings=[2]) == (1, [1])
    assert call_with_supported_kwargs(anything, 1, category_history=[1]) == {"category_history": [1]}


# ----------------------------------------
# GET /reports/category-monthly
# ----------------------------------------
def test_default_six_months_including_current():
    tx(date(2026, 11, 1), 5000, "식비")
    tx(date(2026, 11, 3), 3000, "식비")
    tx(date(2026, 10, 31), 4000, "카페")      # 월 경계
    tx(date(2026, 6, 1), 7000, "식비")        # 범위 첫 달 첫날
    tx(date(2026, 5, 31), 9999, "식비")       # 범위 밖
    tx(date(2026, 10, 15), 1111, "식비", uid="other")
    r = get()
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["months"] == ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]
    assert data["rows"] == [
        {"category_name": "식비", "year_month": "2026-06", "total_spent": 7000},
        {"category_name": "카페", "year_month": "2026-10", "total_spent": 4000},
        {"category_name": "식비", "year_month": "2026-11", "total_spent": 8000},
    ]
    assert data["categories"] == ["식비", "카페"]
    assert [m["total_spent"] for m in data["monthly_totals"]] == [7000, 0, 0, 0, 4000, 8000]


def test_months_and_past_target_date():
    tx(date(2026, 3, 10), 1000, "카페")
    tx(date(2026, 4, 10), 2000, "카페")
    tx(date(2026, 5, 10), 3000, "카페")       # target 달 이후 → 제외
    data = get(months=2, target_date="2026-04-20").json()["data"]
    assert data["months"] == ["2026-03", "2026-04"]
    assert [r["total_spent"] for r in data["rows"]] == [1000, 2000]


def test_includes_categories_not_in_settings():
    """예산 설정에 없는(삭제된) 카테고리 거래도 합계에 들어간다 — 월 합계가 실제 지출과 맞도록."""
    tx(date(2026, 11, 2), 12000, "의류")
    data = get(months=1).json()["data"]
    assert data["rows"] == [{"category_name": "의류", "year_month": "2026-11", "total_spent": 12000}]


@pytest.mark.parametrize("params,detail", [
    ({"months": 0}, "months"), ({"months": 13}, "months"), ({"target_date": "2026-12-01"}, "미래"),
])
def test_validation(params, detail):
    r = get(**params)
    assert r.status_code == 400 and detail in r.json()["detail"]


def test_requires_auth():
    assert client.get("/reports/category-monthly").status_code == 401


def test_single_query_on_transaction_table():
    for m in range(6, 12):
        tx(date(2026, m, 5), 1000, "식비")
        tx(date(2026, m, 6), 1000, "카페")
    statements = []

    def count(conn, cursor, statement, *args):
        if "FROM transaction" in statement or 'FROM "transaction"' in statement:
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", count)
    try:
        assert get().status_code == 200
    finally:
        event.remove(engine, "before_cursor_execute", count)
    assert len(statements) == 1 and "GROUP BY" in statements[0].upper()


# ----------------------------------------
# 월간 리포트 → AI 총평 함수로 category_history 전달
# ----------------------------------------
def test_monthly_report_passes_history_when_ai_supports(monkeypatch):
    captured = {}

    def new_style(monthly_report, challenge_stats=None, budget_history=None,
                  category_history=None, category_settings=None):
        captured["history"] = category_history
        captured["settings"] = category_settings
        return {"comment": "ok", "comment_source": "test"}

    monkeypatch.setattr(reports_router, "generate_monthly_comment", new_style)
    tx(date(2026, 4, 30), 9999, "식비")       # 범위 밖 (11월 리포트 → 6~11월)
    tx(date(2026, 6, 3), 7000, "식비")
    tx(date(2026, 9, 3), 2000, "카페")
    # 리포트는 서버 날짜(date.today) 기준이므로 target_date 로 고정
    r = client.get("/reports/monthly", params={"target_date": "2026-11-01"}, headers=H())
    if r.status_code == 400:  # 실행 환경 날짜가 2026-11 이전이면 미래 월이라 막힘 → 과거 달로 확인
        pytest.skip("실행 날짜가 2026-11 이전")
    assert r.status_code == 200 and r.json()["data"]["comment"] == "ok"
    assert captured["history"] == [
        {"category_name": "식비", "year_month": "2026-06", "total_spent": 7000},
        {"category_name": "카페", "year_month": "2026-09", "total_spent": 2000},
    ]
    assert {c["category_name"] for c in captured["settings"]} == {"식비", "카페"}
    assert all("budget_limit" in c and "actual_spend" in c for c in captured["settings"])


def test_monthly_report_past_month_history_has_no_future(monkeypatch):
    captured = {}

    def new_style(monthly_report, challenge_stats=None, budget_history=None, category_history=None, **_):
        captured["history"] = category_history
        return {"comment": "ok", "comment_source": "test"}

    monkeypatch.setattr(reports_router, "generate_monthly_comment", new_style)
    tx(date(2026, 3, 3), 1000, "식비")
    tx(date(2026, 5, 3), 5000, "식비")        # 4월 리포트 기준 미래 → 제외
    r = client.get("/reports/monthly", params={"target_date": "2026-04-15"}, headers=H())
    assert r.status_code == 200
    assert captured["history"] == [{"category_name": "식비", "year_month": "2026-03", "total_spent": 1000}]


def test_monthly_report_still_works_with_old_ai_signature(monkeypatch):
    def old_style(monthly_report, challenge_stats=None, budget_history=None):
        return {"comment": "old", "comment_source": "test"}

    monkeypatch.setattr(reports_router, "generate_monthly_comment", old_style)
    tx(date(2026, 4, 3), 1000, "식비")
    r = client.get("/reports/monthly", params={"target_date": "2026-04-15"}, headers=H())
    assert r.status_code == 200 and r.json()["data"]["comment"] == "old"
