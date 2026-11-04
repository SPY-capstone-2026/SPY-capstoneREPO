"""
GET /challenges/history 테스트.
실행: cd api && python -m pytest test/test_challenge_history.py -q
"""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, select

import routers.challenges_router as challenges_router
from main import app
from auth import create_access_token
from models import engine, User, DailyChallenge

client = TestClient(app)
TODAY = date(2026, 10, 15)


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(challenges_router, "kst_today", lambda: TODAY)
    # 이 테스트는 조회만 본다. 보정 정산이 상태를 바꾸지 않게 막는다.
    monkeypatch.setattr(challenges_router, "verify_pending_challenges_safely", lambda uid: None)
    with Session(engine) as s:
        s.add(User(user_id="me", email="me@x", password_hash="x"))
        s.add(User(user_id="other", email="o@x", password_hash="x"))
        s.commit()
    yield


def H(uid="me"):
    return {"Authorization": f"Bearer {create_access_token(uid)}"}


def add(d, status, category="식비", xp=10, user="me", **extra):
    with Session(engine) as s:
        c = DailyChallenge(user_id=user, category_name=category, challenge_date=d,
                           challenge_type="LIMIT", challenge_text=f"{category} {d} {status}",
                           difficulty="EASY", status=status, xp_reward=xp, **extra)
        s.add(c)
        s.commit()
        return c.challenge_id


def get(**params):
    r = client.get("/challenges/history", params=params, headers=H())
    return r


def test_default_range_is_last_30_days_excluding_today():
    add(TODAY, "PENDING")
    add(TODAY - timedelta(days=1), "SUCCESS")
    add(TODAY - timedelta(days=30), "SUCCESS")
    add(TODAY - timedelta(days=31), "SUCCESS")  # 범위 밖
    r = get()
    body = r.json()
    assert r.status_code == 200
    assert body["start_date"] == "2026-09-15" and body["end_date"] == "2026-10-14"
    assert [d["date"] for d in body["data"]] == ["2026-10-14", "2026-09-15"]


def test_grouped_by_date_desc_with_summary_and_full_challenge():
    d1, d2 = date(2026, 10, 13), date(2026, 10, 14)
    add(d1, "SUCCESS", xp=20, reward_snapshot={"leveled_up": True},
        verification_result={"spent": 3000, "limit": 4000, "passed": True},
        ai_metadata={"daily_limit": 4000})
    add(d1, "FAILED", category="카페")
    add(d2, "VERIFYING")
    add(d2, "PENDING", category="카페")
    data = get().json()["data"]
    assert [d["date"] for d in data] == ["2026-10-14", "2026-10-13"]

    day13 = data[1]
    assert day13["summary"] == {"total": 2, "success": 1, "failed": 1, "missed": 0,
                                "verifying": 0, "xp_earned": 20}
    ok = next(c for c in day13["challenges"] if c["result"] == "SUCCESS")
    # 챌린지가 통째로 남아 있다 (문구, 한도, 정산 결과, 보상 스냅샷)
    assert ok["challenge_text"].startswith("식비") and ok["ai_metadata"]["daily_limit"] == 4000
    assert ok["verification_result"]["spent"] == 3000 and ok["reward_snapshot"]["leveled_up"] is True

    day14 = data[0]
    assert sorted(c["result"] for c in day14["challenges"]) == ["MISSED", "VERIFYING"]
    missed = next(c for c in day14["challenges"] if c["result"] == "MISSED")
    assert missed["status"] == "PENDING"  # DB 상태는 그대로


def test_today_pending_is_pending_not_missed():
    add(TODAY, "PENDING")
    data = get(start_date="2026-10-15", end_date="2026-10-15").json()["data"]
    assert data[0]["challenges"][0]["result"] == "PENDING"


def test_result_filter_and_category_filter():
    d = date(2026, 10, 10)
    add(d, "SUCCESS")
    add(d, "FAILED")
    add(d, "PENDING")
    add(date(2026, 10, 11), "FAILED", category="카페")
    body = get(result="success").json()
    assert body["count"] == 1 and body["data"][0]["challenges"][0]["result"] == "SUCCESS"
    body = get(result="FAILED,MISSED").json()
    assert sorted(c["result"] for day in body["data"] for c in day["challenges"]) == ["FAILED", "FAILED", "MISSED"]
    body = get(category_name="카페").json()
    assert body["count"] == 1 and body["data"][0]["date"] == "2026-10-11"
    # 필터 후 비는 날짜는 빠진다
    assert [d["date"] for d in get(result="SUCCESS").json()["data"]] == ["2026-10-10"]


def test_other_users_challenges_not_included():
    add(date(2026, 10, 10), "SUCCESS", user="other")
    assert get().json()["count"] == 0


@pytest.mark.parametrize("params,detail", [
    ({"start_date": "2026-10-10", "end_date": "2026-10-01"}, "늦습니다"),
    ({"end_date": "2026-10-16"}, "미래"),
    ({"start_date": "2026-01-01", "end_date": "2026-10-14"}, "최대"),
    ({"result": "DONE"}, "result"),
])
def test_validation(params, detail):
    r = get(**params)
    assert r.status_code == 400 and detail in r.json()["detail"]


def test_requires_auth():
    assert client.get("/challenges/history").status_code == 401


def test_runs_catch_up_verification_first(monkeypatch):
    called = []
    monkeypatch.setattr(challenges_router, "verify_pending_challenges_safely", lambda uid: called.append(uid))
    get()
    assert called == ["me"]


def test_history_does_not_modify_rows():
    cid = add(date(2026, 10, 10), "PENDING")
    get()
    with Session(engine) as s:
        assert s.get(DailyChallenge, cid).status == "PENDING"
        assert len(s.exec(select(DailyChallenge)).all()) == 1
