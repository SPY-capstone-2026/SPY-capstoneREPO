"""
예산 수정 관련 테스트
=====================
1. 예산을 늘리면 오늘의 미완료 챌린지가 새 예산 기준으로 다시 만들어진다 (정책 + 보호 장치)
2. 예산 변경 기록이 KST 로 남고, 주간/월간 리포트에 '언제/얼마 -> 얼마'로 나온다
3. AI 총평에는 DB 객체가 아니라 dict 목록이 전달된다 (DB 객체를 넘기면 AI 쪽에서 전부 무시됨)

실행: python -m pytest tests/test_budget_and_regeneration.py -v
(경쟁 상태 테스트는 Postgres 에서만 실행: TEST_DATABASE_URL 지정)
"""
import os
import threading
import time
from datetime import date, datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, select

import models
from models import User, UserCategorySetting, DailyChallenge, BudgetChangeLog
from auth import get_current_user_id
from routers import categories_router, challenges_router, reports_router
from services import challenge_regeneration_service as regen
from services import time_utils

USER = "u1"
D = date(2027, 3, 15)   # 챌린지 '오늘' (KST)


# ------------------------------------------------------------------ 공용
@pytest.fixture
def world(monkeypatch):
    """유저 + 카테고리 설정(식비/카페=챌린지 대상, 의류=비대상) + 오늘이 D 로 고정된 환경."""
    SQLModel.metadata.drop_all(models.engine)
    SQLModel.metadata.create_all(models.engine)
    ids = {}
    with Session(models.engine) as s:
        s.add(User(user_id=USER, email="a@a.com", password_hash="x"))
        s.commit()
        for name, budget, daily in (("식비", 300000, True), ("카페", 80000, True), ("의류", 100000, False)):
            row = UserCategorySetting(user_id=USER, category_name=name, budget_limit=budget, is_daily_challenge=daily)
            s.add(row)
            s.commit()
            ids[name] = row.id

    monkeypatch.setattr(regen, "kst_today", lambda: D)
    monkeypatch.setattr(challenges_router, "kst_today", lambda: D)
    return ids


@pytest.fixture
def client(world):
    app = FastAPI()
    app.include_router(categories_router.router)
    app.include_router(challenges_router.router)
    app.include_router(reports_router.router)
    app.dependency_overrides[get_current_user_id] = lambda: USER
    return TestClient(app)


def new_row(category="식비", ctype="금지형", status="PENDING", text="old", d=D, origin=None):
    meta = {"daily_limit": 0}
    if origin:
        meta["challenge_origin"] = origin
    with Session(models.engine) as s:
        row = DailyChallenge(user_id=USER, category_name=category, challenge_date=d, challenge_type=ctype,
                             challenge_text=text, difficulty="Hard", status=status, xp_reward=30, ai_metadata=meta)
        s.add(row)
        s.commit()
        return row.challenge_id


def fresh_item(category="식비", ctype="유지형", text="new", origin="pressure"):
    return dict(user_id=USER, category_name=category, challenge_date=D, challenge_type=ctype,
                challenge_text=text, difficulty="Easy", status="PENDING", xp_reward=12,
                ai_metadata={"challenge_origin": origin, "daily_limit": 9000})


class FakeEngine:
    """AI 엔진 대역. 호출 횟수를 기록한다."""
    def __init__(self, items=None, error=None):
        self.items, self.error, self.calls = items or [], error, 0

    def __call__(self, **kwargs):
        self.calls += 1
        if self.error:
            raise self.error
        return [dict(i) for i in self.items]


def install_engine(monkeypatch, **kw):
    engine = FakeEngine(**kw)
    monkeypatch.setattr(regen, "get_today_challenges", engine)
    return engine


def rows(category=None, d=D):
    with Session(models.engine) as s:
        q = select(DailyChallenge).where(DailyChallenge.user_id == USER).where(DailyChallenge.challenge_date == d)
        if category:
            q = q.where(DailyChallenge.category_name == category)
        return s.exec(q.order_by(DailyChallenge.challenge_id)).all()


def raise_budget(client, ids, category="식비", to=450000, **extra):
    return client.patch(f"/categories/{ids[category]}", json={"budget_limit": to, **extra})


# ============================================================ 재생성 정책
def test_budget_increase_replaces_pending_challenge_of_that_category_only(world, client, monkeypatch):
    old_food = new_row("식비", "금지형", text="식비 무지출")
    old_cafe = new_row("카페", "제한형", text="카페 한도")
    engine = install_engine(monkeypatch, items=[
        fresh_item("식비", "유지형", "new-식비"), fresh_item("카페", "제한형", "new-카페"),
    ])

    r = raise_budget(client, world)
    assert r.status_code == 200 and r.json()["challenge_refresh_scheduled"] is True
    assert r.json()["data"]["budget_limit"] == 450000

    food = rows("식비")
    assert len(food) == 1 and food[0].challenge_text == "new-식비" and food[0].challenge_id != old_food
    cafe = rows("카페")
    assert len(cafe) == 1 and cafe[0].challenge_id == old_cafe and cafe[0].challenge_text == "카페 한도"   # 다른 카테고리는 그대로
    assert engine.calls == 1


def test_checked_or_settled_challenges_are_never_touched_and_not_duplicated(world, client, monkeypatch):
    checked = new_row("식비", "금지형", status="VERIFYING", text="체크함", origin="pressure")
    stale_streak = new_row("식비", "streak형", text="옛 streak", origin="streak")
    install_engine(monkeypatch, items=[
        fresh_item("식비", "유지형", "new-pressure", origin="pressure"),
        fresh_item("식비", "streak형", "new-streak", origin="streak"),
    ])

    raise_budget(client, world)

    food = {r.challenge_text: r for r in rows("식비")}
    assert food["체크함"].challenge_id == checked and food["체크함"].status == "VERIFYING"   # 체크한 건 그대로
    assert "new-pressure" not in food                    # 이미 압박도 챌린지가 있으니 같은 종류를 또 만들지 않음
    assert "new-streak" in food and "옛 streak" not in food   # 미완료 streak 는 교체
    assert stale_streak not in [r.challenge_id for r in rows("식비")]


@pytest.mark.parametrize("status", ["SUCCESS", "FAILED"])
def test_settled_challenge_is_left_alone(world, client, monkeypatch, status):
    done = new_row("식비", "금지형", status=status, text="정산 끝", origin="pressure")
    install_engine(monkeypatch, items=[fresh_item("식비")])
    raise_budget(client, world)
    food = rows("식비")
    assert [r.challenge_id for r in food] == [done] and food[0].status == status


def test_decrease_or_unchanged_budget_does_not_regenerate(world, client, monkeypatch):
    old = new_row("식비", text="그대로")
    engine = install_engine(monkeypatch, items=[fresh_item("식비")])

    down = raise_budget(client, world, to=200000)       # 감소
    same = raise_budget(client, world, to=200000)       # 같은 값
    assert down.json()["challenge_refresh_scheduled"] is False
    assert same.json()["challenge_refresh_scheduled"] is False
    assert engine.calls == 0
    assert [r.challenge_id for r in rows("식비")] == [old]


def test_non_challenge_category_is_not_regenerated(world, client, monkeypatch):
    leftover = new_row("의류", text="예전에 만들어진 의류 챌린지")     # 의류는 지금 챌린지 대상이 아님
    engine = install_engine(monkeypatch, items=[fresh_item("의류")])

    r = raise_budget(client, world, category="의류", to=200000)
    assert r.json()["challenge_refresh_scheduled"] is False
    assert engine.calls == 0 and [x.challenge_id for x in rows("의류")] == [leftover]


def test_unchecking_challenge_category_leaves_existing_challenge(world, client, monkeypatch):
    """'챌린지 생성 카테고리' 해제 시 기존 챌린지는 그대로 (팀 결정). 증액과 같이 와도 재생성하지 않는다."""
    old = new_row("식비", text="해제 전에 만든 챌린지")
    engine = install_engine(monkeypatch, items=[fresh_item("식비")])

    r = raise_budget(client, world, is_daily_challenge=False)
    assert r.json()["challenge_refresh_scheduled"] is False and engine.calls == 0
    assert [x.challenge_id for x in rows("식비")] == [old]

    only_toggle = client.patch(f"/categories/{world['카페']}", json={"is_daily_challenge": False})
    assert only_toggle.status_code == 200 and engine.calls == 0   # 해제만 해도 챌린지 건드리지 않음


def test_service_itself_refuses_category_unchecked_after_scheduling(world, monkeypatch):
    """
    예산을 올린 직후(재생성이 백그라운드로 예약된 뒤, 실행되기 전)에 사용자가 '챌린지 대상'을 해제한 경우.
    라우터는 이미 예약을 마쳤으므로 서비스가 직접 다시 확인해서 막아야 한다.
    """
    old = new_row("식비", text="해제 직전에 있던 챌린지")
    engine = install_engine(monkeypatch, items=[fresh_item("식비")])
    with Session(models.engine) as s:
        setting = s.exec(select(UserCategorySetting).where(UserCategorySetting.category_name == "식비")).first()
        setting.is_daily_challenge = False
        s.add(setting)
        s.commit()

    result = regen.regenerate_pending_challenges_for_category(USER, "식비")
    assert result["reason"] == "not_a_challenge_category" and engine.calls == 0
    assert [r.challenge_id for r in rows("식비")] == [old]


def test_engine_error_keeps_existing_challenge_and_request_still_succeeds(world, client, monkeypatch):
    old = new_row("식비", text="유지돼야 함")
    install_engine(monkeypatch, error=RuntimeError("LLM down"))

    r = raise_budget(client, world)
    assert r.status_code == 200                             # 예산 수정 자체는 성공
    assert [x.challenge_id for x in rows("식비")] == [old]
    assert regen.regenerate_pending_challenges_for_category(USER, "식비")["reason"] == "engine_error"


def test_empty_engine_result_keeps_existing_challenge(world, client, monkeypatch):
    old = new_row("식비")
    install_engine(monkeypatch, items=[])
    raise_budget(client, world)
    assert [x.challenge_id for x in rows("식비")] == [old]


def test_category_no_longer_needed_under_new_budget_is_removed_without_touching_others(world, client, monkeypatch):
    new_row("식비", text="더는 필요 없음")
    cafe = new_row("카페", text="카페 그대로")
    install_engine(monkeypatch, items=[fresh_item("카페", "제한형", "엔진이 새로 만든 카페")])   # 식비 챌린지는 안 만듦

    raise_budget(client, world)

    assert rows("식비") == []
    cafe_rows = rows("카페")
    assert [r.challenge_id for r in cafe_rows] == [cafe] and cafe_rows[0].challenge_text == "카페 그대로"


def test_only_todays_challenges_are_replaced(world, client, monkeypatch):
    yesterday = new_row("식비", text="어제 것", d=date(2027, 3, 14))
    new_row("식비", text="오늘 것")
    install_engine(monkeypatch, items=[fresh_item("식비", "유지형", "new")])

    raise_budget(client, world)
    assert [r.challenge_id for r in rows("식비", d=date(2027, 3, 14))] == [yesterday]
    assert [r.challenge_text for r in rows("식비")] == ["new"]


# ===================================================== 예산 변경 기록 + 리포트
def test_budget_change_is_logged_with_kst_time_and_exposed_with_direction(world, client, monkeypatch):
    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            now_utc = datetime(2027, 3, 14, 16, 30, tzinfo=timezone.utc)   # = KST 3/15 01:30
            return now_utc.astimezone(tz) if tz else now_utc.replace(tzinfo=None)
    monkeypatch.setattr(time_utils, "datetime", FrozenDatetime)
    install_engine(monkeypatch, items=[])

    raise_budget(client, world, to=450000)
    raise_budget(client, world, to=450000)   # 같은 값 -> 기록 안 쌓임

    with Session(models.engine) as s:
        logs = s.exec(select(BudgetChangeLog)).all()
    assert len(logs) == 1
    assert logs[0].changed_at == datetime(2027, 3, 15, 1, 30)     # UTC(3/14 16:30)가 아니라 KST

    history = client.get("/categories/budget-history").json()["data"]
    assert history == [{"category_name": "식비", "old_limit": 300000, "new_limit": 450000,
                        "direction": "증액", "changed_at": "2027-03-15T01:30:00"}]


def _log(category, old, new, when):
    with Session(models.engine) as s:
        s.add(BudgetChangeLog(user_id=USER, category_name=category, old_limit=old, new_limit=new, changed_at=when))
        s.commit()


def test_weekly_report_shows_budget_changes_of_that_week_only(world, client):
    _log("식비", 300000, 400000, datetime(2026, 8, 11, 10, 0))    # 해당 주 (8/10~8/16)
    _log("카페", 80000, 60000, datetime(2026, 8, 5, 9, 0))        # 지난주
    _log("의류", 100000, 150000, datetime(2026, 8, 18, 9, 0))     # 다음 주

    data = client.get("/reports/weekly", params={"target_date": "2026-08-12"}).json()["data"]
    assert data["week_start"] == "2026-08-10"
    assert data["budget_changes"] == [{
        "category_name": "식비", "old_limit": 300000, "new_limit": 400000,
        "direction": "증액", "changed_at": "2026-08-11T10:00:00",
    }]


def test_monthly_report_shows_changes_and_passes_dicts_to_ai(world, client, monkeypatch):
    _log("식비", 300000, 400000, datetime(2026, 8, 11, 10, 0))
    _log("카페", 80000, 60000, datetime(2026, 8, 25, 22, 0))
    _log("식비", 250000, 300000, datetime(2026, 7, 30, 9, 0))     # 지난달 -> 제외

    captured = {}

    def fake_monthly_comment(payload, challenge_stats, budget_history):
        captured["history"] = budget_history
        return {"comment": "c", "comment_source": "stub"}
    monkeypatch.setattr(reports_router, "generate_monthly_comment", fake_monthly_comment)

    data = client.get("/reports/monthly", params={"target_date": "2026-08-20"}).json()["data"]

    assert [c["category_name"] for c in data["budget_changes"]] == ["카페", "식비"]      # 최신순, 8월 것만
    # AI(report.py)는 dict 만 읽는다. DB 객체가 넘어가면 전부 무시되므로 dict 여야 한다.
    assert all(isinstance(item, dict) for item in captured["history"])
    assert captured["history"] == data["budget_changes"]
    for key in ("category_name", "old_limit", "new_limit", "changed_at"):     # AI FIELD MAP 이 읽는 키
        assert key in captured["history"][0]


# ============================================== 경쟁 상태: 재생성 중 사용자가 체크
@pytest.mark.skipif(not os.environ["DATABASE_URL"].startswith("postgresql"),
                    reason="동시성은 Postgres 에서만 검증 가능 (TEST_DATABASE_URL 지정)")
def test_user_check_during_regeneration_is_not_lost(world, client, monkeypatch):
    target = new_row("식비", "금지형", text="체크될 챌린지", origin="pressure")

    def slow_engine(**kwargs):
        time.sleep(0.8)   # 엔진이 도는 사이에 사용자가 챌린지를 체크한다
        return [fresh_item("식비", "유지형", "new", origin="pressure")]
    monkeypatch.setattr(regen, "get_today_challenges", slow_engine)

    results = {}
    worker = threading.Thread(
        target=lambda: results.update(regen.regenerate_pending_challenges_for_category(USER, "식비"))
    )
    worker.start()
    time.sleep(0.3)
    check = TestClient(client.app).patch(f"/challenges/{target}/status", json={"status": "SUCCESS"})
    worker.join()

    assert check.status_code == 200 and check.json()["data"]["challenge"]["status"] == "VERIFYING"
    food = rows("식비")
    assert [r.challenge_id for r in food] == [target] and food[0].status == "VERIFYING"   # 체크가 사라지지 않음
    assert results["removed"] == 0 and results["regenerated"] == 0                        # 교체도 중복 생성도 없음
