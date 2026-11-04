"""
회원가입 닉네임 + 친구 랭킹 테스트.
실행: cd api && python -m pytest test/test_signup_nickname_ranking.py -q
"""
import threading
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, select

import routers.social_router as social_router
from main import app
from auth import create_access_token
from models import engine, User, Friendship, DailyChallenge, ShopItem, UserInventory, UserCategorySetting
from services.social_service import ranking_range, make_pair_key

IS_POSTGRES = engine.url.get_backend_name().startswith("postgresql")
client = TestClient(app)
TODAY = date(2026, 10, 28)  # 수요일. 이번 주 = 10/26~11/1, 이번 달 = 10/1~10/31


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(social_router, "kst_today", lambda: TODAY)
    yield


def H(uid):
    return {"Authorization": f"Bearer {create_access_token(uid)}"}


def signup(email, nickname=None, **extra):
    body = {"email": email, "password": "pw1234", **extra}
    if nickname is not None:
        body["nickname"] = nickname
    return client.post("/signup", json=body)


# ----------------------------------------
# 회원가입 닉네임
# ----------------------------------------
def test_signup_with_nickname_shows_in_me():
    r = signup("a@x.com", "  모니짱 ")
    assert r.status_code == 200
    uid = r.json()["user_id"]
    me = client.get("/me", headers=H(uid)).json()
    assert me["nickname"] == "모니짱"
    # 가입 직후 바로 검색된다
    other = signup("b@x.com", "비비").json()["user_id"]
    assert client.get("/users/search", params={"nickname": "모니짱"}, headers=H(other)).status_code == 200


@pytest.mark.parametrize("value", [None, "", "   "])
def test_signup_without_nickname_still_works(value):
    r = signup("a@x.com", value)
    assert r.status_code == 200
    assert client.get("/me", headers=H(r.json()["user_id"])).json()["nickname"] is None


def test_signup_duplicate_nickname_409_and_no_user_created():
    assert signup("a@x.com", "중복이").status_code == 200
    r = signup("b@x.com", "중복이")
    assert r.status_code == 409
    with Session(engine) as s:
        assert s.exec(select(User).where(User.email == "b@x.com")).first() is None


@pytest.mark.parametrize("bad", ["a", "가" * 13, "모니 짱", "moni!"])
def test_signup_invalid_nickname_400_and_no_user_created(bad):
    assert signup("a@x.com", bad).status_code == 400
    with Session(engine) as s:
        assert s.exec(select(User)).all() == []


def test_signup_creates_default_categories_with_nickname():
    uid = signup("a@x.com", "카테고리").json()["user_id"]
    with Session(engine) as s:
        assert len(s.exec(select(UserCategorySetting).where(UserCategorySetting.user_id == uid)).all()) > 0


def test_existing_signup_body_unchanged():
    """프론트가 아직 nickname 을 안 보내도 가입이 그대로 된다."""
    r = client.post("/signup", json={"email": "a@x.com", "password": "pw", "income_type": "STUDENT",
                                     "payday": 25, "spend_profile": "IMPULSIVE"})
    assert r.status_code == 200 and r.json()["status"] == "success"


@pytest.mark.skipif(not IS_POSTGRES, reason="동시성은 Postgres 에서만 검증")
def test_concurrent_signup_same_nickname_one_wins():
    for i in range(10):
        SQLModel.metadata.drop_all(engine)
        SQLModel.metadata.create_all(engine)
        barrier = threading.Barrier(2)
        codes = []

        def go(n):
            barrier.wait()
            codes.append(signup(f"u{n}@x.com", "같은이름").status_code)

        ts = [threading.Thread(target=go, args=(n,)) for n in (1, 2)]
        [t.start() for t in ts]
        [t.join() for t in ts]
        assert sorted(codes) == [200, 409], codes


# ----------------------------------------
# 친구 랭킹
# ----------------------------------------
def make_user(uid, nickname, level=1):
    with Session(engine) as s:
        s.add(User(user_id=uid, email=f"{uid}@x", password_hash="x", nickname=nickname,
                   current_level=level, current_points=999, income_type="STUDENT"))
        s.commit()


def befriend(a, b, status="ACCEPTED"):
    with Session(engine) as s:
        s.add(Friendship(requester_id=a, addressee_id=b, pair_key=make_pair_key(a, b), status=status))
        s.commit()


def challenge(uid, d, status="SUCCESS", category="식비"):
    with Session(engine) as s:
        s.add(DailyChallenge(user_id=uid, category_name=category, challenge_date=d,
                             challenge_type="LIMIT", challenge_text="t", difficulty="EASY",
                             status=status, xp_reward=10))
        s.commit()


def ranking(uid="me", **params):
    return client.get("/friends/ranking", params=params, headers=H(uid))


@pytest.fixture
def group():
    make_user("me", "나야", level=3)
    make_user("f1", "친구하나", level=5)
    make_user("f2", "친구둘", level=1)
    make_user("pending", "대기중")
    make_user("stranger", "남남")
    befriend("me", "f1")
    befriend("f2", "me")                      # 상대가 먼저 보낸 요청도 친구
    befriend("me", "pending", status="PENDING")
    # 이번 주(10/26~): me 2, f1 3, f2 0  /  지난주: f2 5
    for d in (date(2026, 10, 26), date(2026, 10, 27)):
        challenge("me", d)
    for d in (date(2026, 10, 26), date(2026, 10, 27), date(2026, 10, 28)):
        challenge("f1", d)
    for i in range(5):
        challenge("f2", date(2026, 10, 19 + i))
    challenge("stranger", date(2026, 10, 27))
    for _ in range(3):
        challenge("pending", date(2026, 10, 27))
    return "me"


def test_ranking_week_default(group):
    r = ranking()
    body = r.json()
    assert r.status_code == 200
    assert body["period"] == "week" and body["start_date"] == "2026-10-26" and body["end_date"] == "2026-11-01"
    assert [(e["user"]["user_id"], e["completed_count"], e["rank"]) for e in body["data"]] == [
        ("f1", 3, 1), ("me", 2, 2), ("f2", 0, 3)]
    assert [e["is_me"] for e in body["data"]] == [False, True, False]


def test_ranking_month_and_all(group):
    month = ranking(period="month").json()
    assert month["start_date"] == "2026-10-01" and month["end_date"] == "2026-10-31"
    assert [e["user"]["user_id"] for e in month["data"]] == ["f2", "f1", "me"]
    alltime = ranking(period="all").json()
    assert alltime["start_date"] is None and alltime["end_date"] is None
    assert [e["completed_count"] for e in alltime["data"]] == [5, 3, 2]


def test_only_success_counts(group):
    for status in ("FAILED", "VERIFYING", "PENDING"):
        challenge("f2", date(2026, 10, 27), status=status)
    f2 = next(e for e in ranking().json()["data"] if e["user"]["user_id"] == "f2")
    assert f2["completed_count"] == 0


def test_excludes_strangers_and_pending_requests(group):
    ids = {e["user"]["user_id"] for e in ranking().json()["data"]}
    assert ids == {"me", "f1", "f2"}


def test_ties_share_rank_and_break_by_level(group):
    challenge("f2", date(2026, 10, 26))
    challenge("f2", date(2026, 10, 27))    # f2 도 이번 주 2개 → me(Lv3) 와 동점
    data = ranking().json()["data"]
    assert [(e["user"]["user_id"], e["rank"]) for e in data] == [("f1", 1), ("me", 2), ("f2", 2)]


def test_no_friends_shows_only_me():
    make_user("solo", "혼자")
    data = ranking("solo").json()["data"]
    assert len(data) == 1 and data[0]["is_me"] and data[0]["rank"] == 1 and data[0]["completed_count"] == 0


def test_ranking_view_is_per_viewer(group):
    """f1 이 보면 f1 의 친구(me)만 보인다. me 의 친구 f2 는 f1 과 친구가 아니므로 안 보인다."""
    ids = [e["user"]["user_id"] for e in ranking("f1").json()["data"]]
    assert ids == ["f1", "me"]


def test_ranking_exposes_no_private_data(group):
    with Session(engine) as s:
        item = ShopItem(name="골드 컬러", category="CHARACTER", price=100, rarity="EPIC")
        s.add(item)
        s.flush()
        s.add(UserInventory(user_id="f1", item_id=item.item_id, acquired_type="PURCHASED", is_equipped=True))
        s.commit()
    r = ranking()
    text = r.text
    for key in ("email", "current_points", "income_type", "payday", "category_name", "식비", "price"):
        assert key not in text, key
    f1 = next(e for e in r.json()["data"] if e["user"]["user_id"] == "f1")
    assert f1["user"]["character"]["name"] == "골드 컬러"


def test_ranking_validation_and_auth(group):
    assert ranking(period="year").status_code == 400
    assert client.get("/friends/ranking").status_code == 401


def test_ranking_range_edges():
    assert ranking_range("week", date(2026, 11, 1)) == (date(2026, 10, 26), date(2026, 11, 1))  # 일요일
    assert ranking_range("week", date(2026, 10, 26)) == (date(2026, 10, 26), date(2026, 11, 1))  # 월요일
    assert ranking_range("month", date(2026, 12, 31)) == (date(2026, 12, 1), date(2026, 12, 31))
    assert ranking_range("month", date(2026, 2, 10)) == (date(2026, 2, 1), date(2026, 2, 28))
