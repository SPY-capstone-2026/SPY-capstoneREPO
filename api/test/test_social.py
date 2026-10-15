"""
소셜(친구 요청/목록/공개 프로필) 테스트.

실행: cd api && python -m pytest tests/test_social.py -q
Postgres 경쟁 테스트까지: TEST_DATABASE_URL=postgresql+psycopg2://... python -m pytest tests/test_social.py -q
※ 테이블을 drop/create 하므로 운영 DB(Supabase) 주소를 넣으면 절대 안 된다.
"""
import threading

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, select

from main import app
from auth import create_access_token
from models import engine, User, Friendship, ShopItem, UserInventory, Transaction, UserCategorySetting

IS_POSTGRES = engine.url.get_backend_name().startswith("postgresql")
client = TestClient(app)

# 공개 응답에 절대 나오면 안 되는 키
PRIVATE_KEYS = {
    "email", "password_hash", "income_type", "payday", "spend_profile",
    "current_points", "valid_data_start_date", "budget_limit", "amount", "price",
}


@pytest.fixture(autouse=True)
def fresh_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield


def make_user(user_id, nickname=None, level=1, xp=0, points=500):
    with Session(engine) as s:
        s.add(User(
            user_id=user_id, email=f"{user_id}@moni.app", password_hash="x",
            income_type="STUDENT", payday=25, spend_profile="IMPULSIVE",
            nickname=nickname, current_level=level, total_xp=xp, current_points=points,
        ))
        s.commit()
    return user_id


def H(user_id):
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def give_item(user_id, name, category, equipped):
    with Session(engine) as s:
        item = s.exec(select(ShopItem).where(ShopItem.name == name)).first()
        if item is None:
            item = ShopItem(name=name, category=category, price=100, rarity="RARE")
            s.add(item)
            s.flush()
        s.add(UserInventory(user_id=user_id, item_id=item.item_id,
                            acquired_type="PURCHASED", is_equipped=equipped))
        s.commit()
        return item.item_id


def all_keys(obj):
    """중첩된 dict/list 의 모든 키"""
    keys = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            keys.add(k)
            keys |= all_keys(v)
    elif isinstance(obj, list):
        for v in obj:
            keys |= all_keys(v)
    return keys


def send(frm, nickname):
    return client.post("/friends/requests", json={"nickname": nickname}, headers=H(frm))


@pytest.fixture
def ab():
    make_user("a", "에이")
    make_user("b", "비비")
    return "a", "b"


# ----------------------------------------
# 닉네임 (PATCH /me)
# ----------------------------------------
def test_set_nickname_and_shown_in_me():
    make_user("a")
    r = client.patch("/me", json={"nickname": "  모니짱  "}, headers=H("a"))
    assert r.status_code == 200
    assert r.json()["data"]["nickname"] == "모니짱"
    assert client.get("/me", headers=H("a")).json()["nickname"] == "모니짱"


def test_nickname_duplicate_409_and_own_same_ok():
    make_user("a", "중복이")
    make_user("b")
    assert client.patch("/me", json={"nickname": "중복이"}, headers=H("b")).status_code == 409
    assert client.patch("/me", json={"nickname": "중복이"}, headers=H("a")).status_code == 200


@pytest.mark.parametrize("bad", ["a", "가" * 13, "모니 짱", "moni!", "   "])
def test_nickname_validation_400(bad):
    make_user("a")
    assert client.patch("/me", json={"nickname": bad}, headers=H("a")).status_code == 400


def test_patch_me_without_nickname_keeps_it():
    make_user("a", "유지됨")
    client.patch("/me", json={"payday": 10}, headers=H("a"))
    assert client.get("/me", headers=H("a")).json()["nickname"] == "유지됨"


# ----------------------------------------
# 친구 요청 보내기
# ----------------------------------------
def test_send_request_creates_pending(ab):
    r = send("a", "비비")
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["status"] == "PENDING" and d["direction"] == "SENT" and d["auto_accepted"] is False
    assert d["user"]["user_id"] == "b"


def test_send_request_errors(ab):
    assert send("a", "에이").status_code == 400          # 자기 자신
    assert send("a", "없는사람").status_code == 404
    assert send("a", "비비").status_code == 200
    assert send("a", "비비").status_code == 409          # 중복 요청
    with Session(engine) as s:
        assert len(s.exec(select(Friendship)).all()) == 1


def test_reverse_request_auto_accepts(ab):
    send("a", "비비")
    r = send("b", "에이")
    assert r.status_code == 200
    assert r.json()["data"]["auto_accepted"] is True
    assert r.json()["data"]["status"] == "ACCEPTED"
    with Session(engine) as s:
        rows = s.exec(select(Friendship)).all()
        assert len(rows) == 1 and rows[0].status == "ACCEPTED"
    assert send("a", "비비").status_code == 409          # 이미 친구


def test_user_without_nickname_cannot_be_found():
    make_user("a", "에이")
    make_user("c")  # 닉네임 없음
    assert client.get("/users/search", params={"nickname": ""}, headers=H("a")).status_code == 404


# ----------------------------------------
# 요청 목록 / 수락 / 거절 / 취소
# ----------------------------------------
def test_request_lists(ab):
    rid = send("a", "비비").json()["data"]["request_id"]
    recv = client.get("/friends/requests", headers=H("b")).json()
    assert recv["count"] == 1 and recv["data"][0]["request_id"] == rid
    assert recv["data"][0]["direction"] == "RECEIVED" and recv["data"][0]["user"]["user_id"] == "a"
    sent = client.get("/friends/requests", params={"direction": "sent"}, headers=H("a")).json()
    assert sent["count"] == 1 and sent["data"][0]["user"]["user_id"] == "b"
    # 보낸 사람의 '받은 목록'에는 없다
    assert client.get("/friends/requests", headers=H("a")).json()["count"] == 0
    assert client.get("/friends/requests", params={"direction": "x"}, headers=H("a")).status_code == 400


def test_accept_makes_friends_both_ways(ab):
    rid = send("a", "비비").json()["data"]["request_id"]
    r = client.post(f"/friends/requests/{rid}/accept", headers=H("b"))
    assert r.status_code == 200 and r.json()["data"]["status"] == "ACCEPTED"
    fa = client.get("/friends", headers=H("a")).json()
    fb = client.get("/friends", headers=H("b")).json()
    assert [f["user_id"] for f in fa["data"]] == ["b"]
    assert [f["user_id"] for f in fb["data"]] == ["a"]
    # 수락 후엔 대기 목록에서 사라진다
    assert client.get("/friends/requests", headers=H("b")).json()["count"] == 0


def test_only_addressee_can_accept_or_reject(ab):
    make_user("c", "씨씨")
    rid = send("a", "비비").json()["data"]["request_id"]
    for who in ("a", "c"):
        assert client.post(f"/friends/requests/{rid}/accept", headers=H(who)).status_code == 404
        assert client.post(f"/friends/requests/{rid}/reject", headers=H(who)).status_code == 404
    assert client.get("/friends", headers=H("a")).json()["count"] == 0


def test_accept_twice_404(ab):
    rid = send("a", "비비").json()["data"]["request_id"]
    assert client.post(f"/friends/requests/{rid}/accept", headers=H("b")).status_code == 200
    assert client.post(f"/friends/requests/{rid}/accept", headers=H("b")).status_code == 404


def test_reject_deletes_and_allows_resend(ab):
    rid = send("a", "비비").json()["data"]["request_id"]
    assert client.post(f"/friends/requests/{rid}/reject", headers=H("b")).status_code == 200
    with Session(engine) as s:
        assert s.exec(select(Friendship)).all() == []
    assert send("a", "비비").status_code == 200


def test_cancel_only_by_requester(ab):
    rid = send("a", "비비").json()["data"]["request_id"]
    assert client.delete(f"/friends/requests/{rid}", headers=H("b")).status_code == 404
    assert client.delete(f"/friends/requests/{rid}", headers=H("a")).status_code == 200
    assert client.get("/friends/requests", headers=H("b")).json()["count"] == 0


def test_cannot_cancel_accepted_via_request_api(ab):
    rid = send("a", "비비").json()["data"]["request_id"]
    client.post(f"/friends/requests/{rid}/accept", headers=H("b"))
    assert client.delete(f"/friends/requests/{rid}", headers=H("a")).status_code == 404
    assert client.get("/friends", headers=H("a")).json()["count"] == 1


# ----------------------------------------
# 친구 목록 / 삭제
# ----------------------------------------
def befriend(x, x_nick, y, y_nick):
    rid = send(x, y_nick).json()["data"]["request_id"]
    assert client.post(f"/friends/requests/{rid}/accept", headers=H(y)).status_code == 200


def test_friend_list_excludes_pending_and_sorted_by_level():
    make_user("me", "나야")
    make_user("lo", "가나다", level=2)
    make_user("hi", "하하", level=7)
    make_user("pend", "대기중", level=9)
    befriend("me", "나야", "lo", "가나다")
    befriend("hi", "하하", "me", "나야")       # 상대가 먼저 보낸 경우도 목록에 포함
    send("me", "대기중")                      # 대기 중은 친구 아님
    data = client.get("/friends", headers=H("me")).json()["data"]
    assert [f["user_id"] for f in data] == ["hi", "lo"]


def test_remove_friend(ab):
    befriend("a", "에이", "b", "비비")
    assert client.delete("/friends/a", headers=H("b")).status_code == 200
    assert client.get("/friends", headers=H("a")).json()["count"] == 0
    assert client.delete("/friends/a", headers=H("b")).status_code == 404
    assert send("a", "비비").status_code == 200   # 삭제 후 다시 요청 가능


def test_remove_pending_is_not_unfriend(ab):
    send("a", "비비")
    assert client.delete("/friends/b", headers=H("a")).status_code == 404
    with Session(engine) as s:
        assert len(s.exec(select(Friendship)).all()) == 1


# ----------------------------------------
# 공개 프로필 / 장착 상태 / 금융 데이터 비노출
# ----------------------------------------
def test_public_profile_shows_level_and_equipped_only(ab):
    with Session(engine) as s:
        u = s.get(User, "b")
        u.current_level, u.total_xp = 6, 210
        s.add(u)
        s.add(Transaction(user_id="b", tx_date=__import__("datetime").date(2026, 10, 1),
                          tx_time=__import__("datetime").time(12, 0), amount=99999,
                          merchant_name="비밀가게", mydata_category="식비", final_category="식비"))
        s.add(UserCategorySetting(user_id="b", category_name="식비", budget_limit=300000))
        s.commit()
    give_item("b", "골드 컬러", "CHARACTER", equipped=True)
    give_item("b", "왕관", "ACCESSORY", equipped=True)
    give_item("b", "리본", "ACCESSORY", equipped=False)   # 보유만, 미장착

    r = client.get("/users/b/profile", headers=H("a"))
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["nickname"] == "비비" and d["current_level"] == 6 and d["total_xp"] == 210
    assert d["character"]["name"] == "골드 컬러"
    assert sorted(i["name"] for i in d["equipped_items"]) == ["골드 컬러", "왕관"]
    assert d["friendship_status"] == "NONE"
    assert not (all_keys(r.json()) & PRIVATE_KEYS)
    assert "비밀가게" not in r.text and "99999" not in r.text and "300000" not in r.text


def test_no_private_fields_anywhere(ab):
    give_item("a", "민트 컬러", "CHARACTER", equipped=True)
    rid = send("a", "비비").json()["data"]["request_id"]
    responses = [
        client.get("/users/search", params={"nickname": "에이"}, headers=H("b")),
        client.get("/friends/requests", headers=H("b")),
        client.get("/friends/requests", params={"direction": "sent"}, headers=H("a")),
        send("b", "에이"),  # 자동 수락 응답
        client.get("/friends", headers=H("b")),
        client.get("/users/a/profile", headers=H("b")),
    ]
    for r in responses:
        assert r.status_code == 200, r.text
        assert not (all_keys(r.json()) & PRIVATE_KEYS), (r.request.url, all_keys(r.json()) & PRIVATE_KEYS)
        assert "@moni.app" not in r.text


def test_friendship_status_values(ab):
    st = lambda viewer, target: client.get(f"/users/{target}/profile", headers=H(viewer)).json()["data"]["friendship_status"]
    assert st("a", "a") == "SELF"
    assert st("a", "b") == "NONE"
    rid = send("a", "비비").json()["data"]["request_id"]
    assert st("a", "b") == "REQUEST_SENT"
    assert st("b", "a") == "REQUEST_RECEIVED"
    client.post(f"/friends/requests/{rid}/accept", headers=H("b"))
    assert st("a", "b") == "FRIEND" and st("b", "a") == "FRIEND"


def test_profile_404_and_no_character(ab):
    assert client.get("/users/nope/profile", headers=H("a")).status_code == 404
    d = client.get("/users/b/profile", headers=H("a")).json()["data"]
    assert d["character"] is None and d["equipped_items"] == []


def test_friend_list_includes_equipped_and_unequip_reflects(ab):
    item_id = give_item("b", "왕관", "ACCESSORY", equipped=True)
    befriend("a", "에이", "b", "비비")
    assert [i["name"] for i in client.get("/friends", headers=H("a")).json()["data"][0]["equipped_items"]] == ["왕관"]
    client.patch(f"/shop/inventory/{item_id}/equip", json={"equip": False}, headers=H("b"))
    assert client.get("/friends", headers=H("a")).json()["data"][0]["equipped_items"] == []


def test_requires_auth():
    for method, url in [("get", "/friends"), ("get", "/friends/requests"),
                        ("get", "/users/x/profile"), ("get", "/users/search?nickname=x")]:
        assert getattr(client, method)(url).status_code == 401
    assert client.post("/friends/requests", json={"nickname": "x"}).status_code == 401


# ----------------------------------------
# 동시성 (Postgres 전용)
# ----------------------------------------
@pytest.mark.skipif(not IS_POSTGRES, reason="동시성은 Postgres 에서만 검증")
def test_concurrent_cross_requests_leave_single_row():
    """A→B, B→A 를 동시에 여러 번 보내도 두 사람 사이 관계 행은 1개, 500 없음."""
    for _ in range(10):
        SQLModel.metadata.drop_all(engine)
        SQLModel.metadata.create_all(engine)
        make_user("a", "에이")
        make_user("b", "비비")
        barrier = threading.Barrier(4)
        codes = []

        def go(frm, nick):
            barrier.wait()
            codes.append(send(frm, nick).status_code)

        ts = [threading.Thread(target=go, args=a) for a in
              [("a", "비비"), ("b", "에이"), ("a", "비비"), ("b", "에이")]]
        [t.start() for t in ts]
        [t.join() for t in ts]

        assert all(c in (200, 409) for c in codes), codes
        with Session(engine) as s:
            assert len(s.exec(select(Friendship)).all()) == 1


@pytest.mark.skipif(not IS_POSTGRES, reason="동시성은 Postgres 에서만 검증")
def test_concurrent_same_nickname_one_wins():
    for _ in range(10):
        SQLModel.metadata.drop_all(engine)
        SQLModel.metadata.create_all(engine)
        make_user("a")
        make_user("b")
        barrier = threading.Barrier(2)
        codes = []

        def go(uid):
            barrier.wait()
            codes.append(client.patch("/me", json={"nickname": "같은이름"}, headers=H(uid)).status_code)

        ts = [threading.Thread(target=go, args=(u,)) for u in ("a", "b")]
        [t.start() for t in ts]
        [t.join() for t in ts]
        assert sorted(codes) == [200, 409], codes
