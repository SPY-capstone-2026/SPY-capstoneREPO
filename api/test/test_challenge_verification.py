"""
챌린지 검증(자정 정산) 테스트
=============================
요구사항 §9 의 11개 시나리오 + 상태 전이 API / 보정 / 오류 격리 / 캐시 무효화 케이스.

실행 (api/ 폴더에서):
    pip install pytest httpx
    python -m pytest tests/test_challenge_verification.py -v

주의: conftest.py 가 DATABASE_URL 을 임시 SQLite 로 바꿔서 돌리므로 운영 DB(Supabase)는 건드리지 않는다.
"""

from datetime import date, datetime, time as dtime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, select

import models
from models import (
    User, Transaction, DailyChallenge, PointTransaction, GeneratedReport,
)
from auth import get_current_user_id
from routers import challenges_router, internal_router
from services import time_utils
from services import challenge_verification_service as verification
from services.challenge_verification_service import (
    verify_pending_challenges, get_challenge_limit,
)
from services.challenge_stats_service import get_category_stats

USER_ID = "u1"
OTHER_USER_ID = "u2"
D = date(2026, 10, 13)          # 챌린지 대상 날짜
NEXT_DAY = D + timedelta(days=1)  # '자정 직후' = 이 날짜를 today 로 보고 정산


# ------------------------------------------------------------------ 헬퍼
@pytest.fixture
def db():
    SQLModel.metadata.drop_all(models.engine)
    SQLModel.metadata.create_all(models.engine)
    with Session(models.engine) as s:
        s.add(User(user_id=USER_ID, email="a@a.com", password_hash="x"))
        s.add(User(user_id=OTHER_USER_ID, email="b@b.com", password_hash="x"))
        s.commit()
    yield models.engine


def new_challenge(
    *, d=D, category="카페", ctype="제한형", limit=4000, status="VERIFYING",
    xp=30, meta="auto", user_id=USER_ID,
):
    if meta == "auto":
        meta = {"daily_limit": limit}
    with Session(models.engine) as s:
        c = DailyChallenge(
            user_id=user_id, category_name=category, challenge_date=d,
            challenge_type=ctype, challenge_text="t", difficulty="Easy",
            status=status, xp_reward=xp, ai_metadata=meta,
        )
        s.add(c)
        s.commit()
        s.refresh(c)
        return c.challenge_id


def add_tx(d, amount, category="카페", user_id=USER_ID):
    with Session(models.engine) as s:
        s.add(Transaction(
            user_id=user_id, tx_date=d, tx_time=dtime(12, 0), amount=amount,
            merchant_name="m", mydata_category=category, final_category=category,
        ))
        s.commit()


def challenge(cid) -> DailyChallenge:
    with Session(models.engine) as s:
        return s.get(DailyChallenge, cid)


def user(uid=USER_ID) -> User:
    with Session(models.engine) as s:
        return s.get(User, uid)


def point_tx_count(uid=USER_ID) -> int:
    with Session(models.engine) as s:
        return len(s.exec(select(PointTransaction).where(PointTransaction.user_id == uid)).all())


def assert_rewarded(cid, xp=30):
    c = challenge(cid)
    assert c.status == "SUCCESS"
    assert c.reward_snapshot is not None
    assert c.completed_at is not None
    assert user().total_xp == xp


def assert_not_rewarded(cid, status):
    c = challenge(cid)
    assert c.status == status
    assert c.reward_snapshot is None
    assert user().total_xp == 0
    assert point_tx_count() == 0


# ============================================================ §9 시나리오
def test_01_no_spend_challenge_without_spending_succeeds_and_rewards(db):
    cid = new_challenge(ctype="금지형", limit=0)
    summary = verify_pending_challenges(today=NEXT_DAY)

    assert summary["succeeded"] == 1
    assert_rewarded(cid)
    assert user().current_level == 2           # 30XP = Lv1->2 경계
    assert user().current_points == 50
    assert point_tx_count() == 1
    assert challenge(cid).verification_result["spent"] == 0
    assert challenge(cid).verification_result["mode"] == "no_spend"


def test_02_no_spend_challenge_with_spending_fails_without_reward(db):
    cid = new_challenge(ctype="금지형", limit=0)
    add_tx(D, 1500)
    summary = verify_pending_challenges(today=NEXT_DAY)

    assert summary["failed"] == 1
    assert_not_rewarded(cid, "FAILED")
    assert challenge(cid).verification_result["spent"] == 1500


def test_03_limit_challenge_spent_equals_limit_succeeds(db):
    cid = new_challenge(limit=4000)
    add_tx(D, 4000)
    verify_pending_challenges(today=NEXT_DAY)
    assert_rewarded(cid)


def test_04_limit_challenge_spent_below_limit_succeeds(db):
    cid = new_challenge(limit=4000)
    add_tx(D, 1500)
    add_tx(D, 1500)  # 합계 3000
    verify_pending_challenges(today=NEXT_DAY)
    assert_rewarded(cid)


def test_05_limit_challenge_spent_over_limit_fails(db):
    cid = new_challenge(limit=4000)
    add_tx(D, 4001)
    verify_pending_challenges(today=NEXT_DAY)
    assert_not_rewarded(cid, "FAILED")


def test_05b_limit_uses_sum_of_multiple_transactions(db):
    cid = new_challenge(limit=4000)
    add_tx(D, 2500)
    add_tx(D, 2500)  # 개별로는 한도 이하지만 합계 5000 > 4000
    verify_pending_challenges(today=NEXT_DAY)
    assert_not_rewarded(cid, "FAILED")


def test_06_check_then_cancel_before_midnight_is_excluded(db, client, today_is_D):
    cid = new_challenge(status="PENDING", limit=4000)

    r = client.patch(f"/challenges/{cid}/status", json={"status": "SUCCESS"})
    assert r.status_code == 200 and r.json()["data"]["challenge"]["status"] == "VERIFYING"

    r = client.patch(f"/challenges/{cid}/status", json={"status": "PENDING"})
    assert r.status_code == 200 and r.json()["data"]["challenge"]["status"] == "PENDING"

    summary = verify_pending_challenges(today=NEXT_DAY)
    assert summary["found"] == 0
    assert_not_rewarded(cid, "PENDING")


def test_07_unchecked_challenge_gets_no_reward(db):
    cid = new_challenge(status="PENDING", limit=4000)
    summary = verify_pending_challenges(today=NEXT_DAY)
    assert summary["found"] == 0
    assert_not_rewarded(cid, "PENDING")


def test_08_duplicate_runs_do_not_double_reward(db):
    cid = new_challenge(limit=4000)
    first = verify_pending_challenges(today=NEXT_DAY)
    second = verify_pending_challenges(today=NEXT_DAY)
    third = verify_pending_challenges(today=NEXT_DAY + timedelta(days=5))

    assert first["succeeded"] == 1
    assert second["found"] == 0 and third["found"] == 0
    assert_rewarded(cid)                # XP 30 한 번만
    assert point_tx_count() == 1


def test_09_delayed_run_uses_challenge_date_spending_not_run_date(db):
    # 케이스 A: 대상일 지출 0 + 이후 날짜엔 큰 지출 -> 달성이어야 함 (이후 지출은 무관)
    a = new_challenge(d=D, ctype="금지형", limit=0)
    for offset in (1, 2, 3):
        add_tx(D + timedelta(days=offset), 99999)

    # 케이스 B: 대상일 지출 초과 + 이후 날짜엔 지출 0 -> 미달성이어야 함
    b = new_challenge(d=D - timedelta(days=1), limit=4000, xp=20)
    add_tx(D - timedelta(days=1), 9000)

    # 3일 늦게 실행 (자정 작업이 며칠 밀린 상황)
    summary = verify_pending_challenges(today=D + timedelta(days=3))

    assert summary["found"] == 2 and summary["succeeded"] == 1 and summary["failed"] == 1
    assert challenge(a).status == "SUCCESS"
    assert challenge(a).verification_result["target_date"] == D.isoformat()
    assert challenge(b).status == "FAILED"
    assert challenge(b).verification_result["target_date"] == (D - timedelta(days=1)).isoformat()


def test_09b_other_category_and_other_user_spending_is_ignored(db):
    cid = new_challenge(category="카페", ctype="금지형", limit=0)
    add_tx(D, 50000, category="식비")                   # 다른 카테고리
    add_tx(D, 50000, category="카페", user_id=OTHER_USER_ID)  # 다른 유저
    verify_pending_challenges(today=NEXT_DAY)
    assert_rewarded(cid)


def test_10_transactions_changed_after_verification_do_not_change_result(db):
    ok = new_challenge(limit=4000, xp=30)
    bad = new_challenge(category="식비", limit=4000, xp=20)
    add_tx(D, 9000, category="식비")
    verify_pending_challenges(today=NEXT_DAY)
    assert challenge(ok).status == "SUCCESS" and challenge(bad).status == "FAILED"
    xp_after = user().total_xp

    # 자정 이후 과거 거래가 추가/삭제돼도 재검증하지 않는다
    add_tx(D, 99999, category="카페")
    with Session(models.engine) as s:
        for t in s.exec(select(Transaction).where(Transaction.final_category == "식비")).all():
            s.delete(t)
        s.commit()

    again = verify_pending_challenges(today=NEXT_DAY + timedelta(days=1))
    assert again["found"] == 0
    assert challenge(ok).status == "SUCCESS" and challenge(bad).status == "FAILED"
    assert user().total_xp == xp_after
    assert point_tx_count() == 1


def test_11a_kst_today_differs_from_utc_date(monkeypatch):
    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            now_utc = datetime(2026, 10, 13, 16, 30, tzinfo=timezone.utc)  # = KST 10/14 01:30
            return now_utc.astimezone(tz) if tz else now_utc.replace(tzinfo=None)

    monkeypatch.setattr(time_utils, "datetime", FrozenDatetime)
    assert FrozenDatetime.now(timezone.utc).date() == date(2026, 10, 13)   # UTC 날짜
    assert time_utils.kst_today() == date(2026, 10, 14)                    # KST 날짜
    assert time_utils.kst_now_naive().hour == 1


def test_11b_midnight_job_after_kst_midnight_uses_kst_date(db, monkeypatch):
    """UTC 로는 아직 10/13 인 시각(KST 10/14 01:30)에 실행돼도 10/13 챌린지가 정산되어야 한다."""
    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            now_utc = datetime(2026, 10, 13, 16, 30, tzinfo=timezone.utc)
            return now_utc.astimezone(tz) if tz else now_utc.replace(tzinfo=None)

    monkeypatch.setattr(time_utils, "datetime", FrozenDatetime)
    cid = new_challenge(d=date(2026, 10, 13), limit=4000)
    add_tx(date(2026, 10, 13), 1000)

    summary = verify_pending_challenges()   # today 미지정 -> KST 오늘(10/14)
    assert summary["as_of"] == "2026-10-14" and summary["succeeded"] == 1
    assert_rewarded(cid)


def test_11c_generate_sets_challenge_date_in_kst(db, client, monkeypatch):
    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            now_utc = datetime(2026, 10, 13, 16, 30, tzinfo=timezone.utc)
            return now_utc.astimezone(tz) if tz else now_utc.replace(tzinfo=None)

    monkeypatch.setattr(time_utils, "datetime", FrozenDatetime)
    monkeypatch.setattr(challenges_router, "get_today_challenges", lambda **kw: [])  # AI 실패 -> fallback

    r = client.post("/challenges/generate")
    assert r.status_code == 200
    # UTC 날짜(10/13)가 아니라 KST 날짜(10/14)로 만들어져야 한다
    assert r.json()["data"][0]["challenge_date"] == "2026-10-14"


# ===================================================== 상태 전이 API 동작
def test_api_check_moves_to_verifying_and_gives_no_reward(db, client, today_is_D):
    cid = new_challenge(status="PENDING", limit=4000)
    r = client.patch(f"/challenges/{cid}/status", json={"status": "SUCCESS"})
    body = r.json()["data"]

    assert r.status_code == 200
    assert body["challenge"]["status"] == "VERIFYING"
    assert body["level_result"] is None and body["reversal_result"] is None  # 응답 키는 유지
    assert body["user_progress"]["total_xp"] == 0
    assert user().total_xp == 0 and point_tx_count() == 0


def test_api_repeated_check_is_idempotent(db, client, today_is_D):
    cid = new_challenge(status="PENDING")
    for _ in range(3):
        r = client.patch(f"/challenges/{cid}/status", json={"status": "SUCCESS"})
        assert r.status_code == 200
    assert challenge(cid).status == "VERIFYING"


def test_api_cannot_change_past_date_challenge(db, client, today_is_D):
    cid = new_challenge(d=D - timedelta(days=1), status="PENDING")
    r = client.patch(f"/challenges/{cid}/status", json={"status": "SUCCESS"})
    assert r.status_code == 400
    assert challenge(cid).status == "PENDING"


def test_api_cannot_cancel_after_midnight_even_if_job_has_not_run(db, client, today_is_D):
    cid = new_challenge(d=D - timedelta(days=1), status="VERIFYING")  # 어제 체크, 정산 아직 안 됨
    r = client.patch(f"/challenges/{cid}/status", json={"status": "PENDING"})
    assert r.status_code == 400
    assert challenge(cid).status == "VERIFYING"


def test_api_verified_challenge_is_locked(db, client, today_is_D):
    cid = new_challenge(d=D, status="VERIFYING", limit=4000)
    verify_pending_challenges(today=NEXT_DAY)
    xp = user().total_xp

    # 취소 시도 -> 409 (예전에는 XP 회수였지만 이제는 확정된 결과)
    assert client.patch(f"/challenges/{cid}/status", json={"status": "PENDING"}).status_code == 409
    # 같은 의미의 재요청 -> 멱등 200, XP 변화 없음
    assert client.patch(f"/challenges/{cid}/status", json={"status": "SUCCESS"}).status_code == 200
    assert challenge(cid).status == "SUCCESS" and user().total_xp == xp


def test_api_failed_challenge_cannot_be_rechecked(db, client, today_is_D):
    cid = new_challenge(d=D, status="VERIFYING", limit=0, ctype="금지형")
    add_tx(D, 100)
    verify_pending_challenges(today=NEXT_DAY)
    assert challenge(cid).status == "FAILED"
    assert client.patch(f"/challenges/{cid}/status", json={"status": "SUCCESS"}).status_code == 409


def test_api_other_users_challenge_is_forbidden(db, client, today_is_D):
    cid = new_challenge(user_id=OTHER_USER_ID, status="PENDING")
    r = client.patch(f"/challenges/{cid}/status", json={"status": "SUCCESS"})
    assert r.status_code == 403


def test_api_end_to_end_check_then_midnight_reward(db, client, today_is_D):
    cid = new_challenge(status="PENDING", limit=4000)
    add_tx(D, 2000)
    assert client.patch(f"/challenges/{cid}/status", json={"status": "SUCCESS"}).status_code == 200
    assert user().total_xp == 0                         # 체크만으로는 보상 없음

    verify_pending_challenges(today=NEXT_DAY)           # 자정 정산
    assert_rewarded(cid)
    snap = challenge(cid).reward_snapshot
    assert snap["leveled_up"] is True and snap["points_earned"] == 50


# ====================================================== 보정(catch-up) / 통계
def test_lazy_catch_up_on_today_endpoint(db, client, monkeypatch):
    """스케줄러가 안 돌았어도 사용자가 /challenges/today 를 열면 밀린 정산이 처리된다."""
    cid = new_challenge(d=D, status="VERIFYING", limit=4000)
    monkeypatch.setattr(challenges_router, "kst_today", lambda: NEXT_DAY)
    monkeypatch.setattr(verification, "kst_today", lambda: NEXT_DAY)

    r = client.get("/challenges/today")
    assert r.status_code == 200
    assert_rewarded(cid)


def test_lazy_catch_up_failure_never_breaks_read_api(db, client, monkeypatch):
    monkeypatch.setattr(challenges_router, "kst_today", lambda: NEXT_DAY)

    def boom(**kw):
        raise RuntimeError("db down")
    monkeypatch.setattr(verification, "verify_pending_challenges", boom)

    assert client.get("/challenges/today").status_code == 200


def test_stats_count_only_verified_success(db):
    new_challenge(limit=4000, xp=30)
    with Session(models.engine) as s:
        before = get_category_stats(s, USER_ID)
    assert before[0]["completed_count"] == 0 and before[0]["xp_earned"] == 0   # VERIFYING 은 집계 안 됨

    verify_pending_challenges(today=NEXT_DAY)
    with Session(models.engine) as s:
        after = get_category_stats(s, USER_ID)
    assert after[0]["completed_count"] == 1 and after[0]["xp_earned"] == 30


def test_verification_invalidates_cached_report_for_that_date(db):
    new_challenge(d=D, limit=4000)
    with Session(models.engine) as s:
        s.add(GeneratedReport(
            user_id=USER_ID, report_type="WEEKLY", period_start=date(2026, 10, 12),
            period_end=date(2026, 10, 18), report_data={"stale": True},
        ))
        s.add(GeneratedReport(
            user_id=USER_ID, report_type="WEEKLY", period_start=date(2026, 10, 5),
            period_end=date(2026, 10, 11), report_data={"unrelated": True},
        ))
        s.commit()

    verify_pending_challenges(today=NEXT_DAY)
    with Session(models.engine) as s:
        remaining = s.exec(select(GeneratedReport)).all()
    assert [r.report_data for r in remaining] == [{"unrelated": True}]   # 해당 날짜 포함 캐시만 삭제


# ============================================================ 한도 해석 단위
def _c(**kw):
    base = dict(user_id=USER_ID, category_name="카페", challenge_date=D, challenge_type="제한형",
                challenge_text="t", difficulty="E", xp_reward=10, ai_metadata=None)
    base.update(kw)
    return DailyChallenge(**base)


def test_limit_parsing():
    assert get_challenge_limit(_c(ai_metadata={"daily_limit": 4000})) == (4000, "limit")
    assert get_challenge_limit(_c(ai_metadata={"daily_limit": 4000.0})) == (4000, "limit")
    assert get_challenge_limit(_c(ai_metadata={"daily_limit": "4000"})) == (4000, "limit")
    assert get_challenge_limit(_c(ai_metadata={"daily_limit": 0})) == (0, "no_spend")
    assert get_challenge_limit(_c(challenge_type="streak형", ai_metadata={"challenge_origin": "streak"})) == (0, "no_spend")
    assert get_challenge_limit(_c(challenge_type="금지형", ai_metadata={})) == (0, "no_spend")
    assert get_challenge_limit(_c(ai_metadata={"daily_limit": "abc"})) == (None, "unverifiable")
    assert get_challenge_limit(_c(ai_metadata=None)) == (None, "unverifiable")


def test_streak_challenge_requires_no_spend(db):
    ok = new_challenge(category="카페", ctype="streak형", xp=60, meta={"challenge_origin": "streak", "no_spend_streak": 11})
    verify_pending_challenges(today=NEXT_DAY)
    assert_rewarded(ok, xp=60)


def test_streak_challenge_fails_when_spent(db):
    bad = new_challenge(category="카페", ctype="streak형", xp=60, meta={"challenge_origin": "streak"})
    add_tx(D, 1)
    verify_pending_challenges(today=NEXT_DAY)
    assert challenge(bad).status == "FAILED" and user().total_xp == 0


def test_unverifiable_fallback_challenge_follows_policy(db, monkeypatch):
    fallback_meta = {"model_version": "fallback-v1", "budget_limit": 30000}   # daily_limit 없음
    approved = new_challenge(meta=fallback_meta, xp=10)
    verify_pending_challenges(today=NEXT_DAY)
    assert challenge(approved).status == "SUCCESS"
    assert challenge(approved).verification_result["mode"] == "unverifiable"

    monkeypatch.setattr(verification, "UNVERIFIABLE_POLICY", "reject")
    rejected = new_challenge(d=D - timedelta(days=1), meta=fallback_meta, xp=10)
    verify_pending_challenges(today=NEXT_DAY)
    assert challenge(rejected).status == "FAILED"


# ================================================ 통계/스트릭도 KST 기준인지
# ※ 날짜는 일부러 실제 오늘 날짜와 멀리 떨어진 2027년으로 고정한다.
#   (실제 시스템 날짜와 우연히 같으면 date.today() 회귀를 못 잡는다)
# 2027-03-14 15:30 UTC = 2027-03-15(월) 00:30 KST
def _freeze_kst_monday_dawn(monkeypatch):
    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            now_utc = datetime(2027, 3, 14, 15, 30, tzinfo=timezone.utc)
            return now_utc.astimezone(tz) if tz else now_utc.replace(tzinfo=None)
    monkeypatch.setattr(time_utils, "datetime", FrozenDatetime)


def test_weekly_count_uses_kst_week_on_monday_dawn(db, monkeypatch):
    """KST 월요일 00:30 (= UTC 일요일 15:30). '이번 주'는 월요일부터여야 한다."""
    from services.challenge_stats_service import get_weekly_completed_count
    _freeze_kst_monday_dawn(monkeypatch)
    new_challenge(d=date(2027, 3, 15), status="SUCCESS")   # KST 월요일 날짜의 달성 챌린지

    with Session(models.engine) as s:
        result = get_weekly_completed_count(s, USER_ID)
    assert result["week_start"] == "2027-03-15" and result["completed_count"] == 1


def test_streak_breaks_when_yesterday_missed_even_in_kst_dawn(db, monkeypatch):
    """KST 3/15 00:30 (= UTC 3/14). 어제(3/14)를 못 깼다면 스트릭은 0이어야 한다."""
    from services.challenge_stats_service import get_current_streak
    _freeze_kst_monday_dawn(monkeypatch)
    new_challenge(d=date(2027, 3, 13), status="SUCCESS")   # 그제만 달성, 어제(3/14)는 미달성

    with Session(models.engine) as s:
        assert get_current_streak(s, USER_ID)["current_streak"] == 0


def test_streak_counts_from_yesterday_in_kst_dawn(db, monkeypatch):
    """KST 3/15 00:30. 오늘은 아직 정산 전이니 어제(3/14)부터 거슬러 올라가 2일."""
    from services.challenge_stats_service import get_current_streak
    _freeze_kst_monday_dawn(monkeypatch)
    new_challenge(d=date(2027, 3, 13), status="SUCCESS")
    new_challenge(d=date(2027, 3, 14), status="SUCCESS", category="식비")

    with Session(models.engine) as s:
        assert get_current_streak(s, USER_ID)["current_streak"] == 2


def test_by_category_default_week_is_kst(db, client, monkeypatch):
    _freeze_kst_monday_dawn(monkeypatch)
    new_challenge(d=date(2027, 3, 15), status="SUCCESS", xp=30)

    r = client.get("/challenges/stats/by-category")   # 기본값: 이번 주
    data = r.json()["data"]
    assert data["start_date"] == "2027-03-15"
    assert data["categories"][0]["completed_count"] == 1 and data["categories"][0]["xp_earned"] == 30


# ======================================================= 오류 격리 / 원자성
def test_one_failing_challenge_does_not_block_others_and_rolls_back(db, monkeypatch):
    good1 = new_challenge(d=D - timedelta(days=1), limit=4000, xp=20)
    poison = new_challenge(d=D, limit=4000, xp=999)
    good2 = new_challenge(d=D, category="식비", limit=4000, xp=10)

    real = verification.process_challenge_completion

    def flaky(session, user_, xp, commit=True):
        if xp == 999:
            raise RuntimeError("보상 지급 중 오류")
        return real(session, user_, xp, commit=commit)

    monkeypatch.setattr(verification, "process_challenge_completion", flaky)
    summary = verify_pending_challenges(today=NEXT_DAY)

    assert summary["errors"] == 1 and summary["succeeded"] == 2
    assert challenge(good1).status == "SUCCESS" and challenge(good2).status == "SUCCESS"

    # 오류 난 챌린지는 흔적 없이 롤백되어 VERIFYING 으로 남고(다음 실행에서 재시도), 보상도 없다
    p = challenge(poison)
    assert p.status == "VERIFYING" and p.verification_result is None and p.reward_snapshot is None
    assert user().total_xp == 30   # 20 + 10, poison 의 999 는 반영 안 됨

    # 원인이 해결된 뒤 다음 실행에서 정상 처리
    monkeypatch.setattr(verification, "process_challenge_completion", real)
    assert verify_pending_challenges(today=NEXT_DAY)["succeeded"] == 1
    assert challenge(poison).status == "SUCCESS"


@pytest.mark.parametrize("fail_on_nth_commit", [1, 2])
def test_status_change_and_reward_commit_atomically(db, monkeypatch, fail_on_nth_commit):
    """
    어느 커밋이 실패하든 '상태 / XP / 스냅샷'이 따로 놀면 안 된다.
      - SUCCESS 라면: XP 반영 + 스냅샷 존재 + 포인트 로그 존재 (전부 있음)
      - 아니라면   : VERIFYING 이고 XP/스냅샷/포인트 로그 전부 없음 (전부 롤백)
    (정산이 커밋을 한 번만 하도록 만든 구조라면 2번째 커밋은 아예 일어나지 않는다)
    """
    cid = new_challenge(limit=4000)
    real_commit = Session.commit
    calls = {"n": 0}

    def flaky_commit(self):
        calls["n"] += 1
        if calls["n"] == fail_on_nth_commit:
            raise RuntimeError("commit 실패")
        return real_commit(self)

    monkeypatch.setattr(Session, "commit", flaky_commit)
    verify_pending_challenges(today=NEXT_DAY)
    monkeypatch.setattr(Session, "commit", real_commit)

    c = challenge(cid)
    if c.status == "SUCCESS":
        assert c.reward_snapshot is not None and c.completed_at is not None
        assert user().total_xp == 30 and point_tx_count() == 1
    else:
        assert c.status == "VERIFYING"
        assert c.reward_snapshot is None and c.verification_result is None
        assert user().total_xp == 0 and point_tx_count() == 0


# ============================================ 동시 실행 방어선 (낡은 ID 목록)
def test_stale_id_list_cannot_double_reward(db):
    """
    실행 A가 ID 목록을 읽은 뒤, 실행 B가 먼저 정산을 끝낸 상황.
    A가 낡은 ID로 _verify_one 을 호출해도 잠금 후 상태 재확인에서 걸러져야 한다.
    """
    cid = new_challenge(limit=4000)
    with Session(models.engine) as s:
        first = verification._verify_one(s, cid, NEXT_DAY)      # B: 정산 완료
    with Session(models.engine) as s:
        second = verification._verify_one(s, cid, NEXT_DAY)     # A: 낡은 목록으로 뒤늦게 도착

    assert first == "SUCCESS" and second is None
    assert_rewarded(cid)
    assert point_tx_count() == 1


def test_stale_id_list_respects_cancellation_in_between(db):
    """ID 목록을 읽은 뒤 사용자가 체크를 취소했다면 정산하면 안 된다."""
    cid = new_challenge(limit=4000)
    with Session(models.engine) as s:          # 사용자 취소 (PENDING)
        c = s.get(DailyChallenge, cid)
        c.status = "PENDING"
        s.add(c)
        s.commit()

    with Session(models.engine) as s:
        assert verification._verify_one(s, cid, NEXT_DAY) is None
    assert_not_rewarded(cid, "PENDING")


def test_job_does_not_touch_today_or_future_challenges(db):
    """아직 날짜가 안 지난 챌린지(오늘 체크분)는 정산 대상이 아니다."""
    cid = new_challenge(d=D, limit=4000)
    summary = verify_pending_challenges(today=D)       # 같은 날 -> challenge_date < today 불충족
    assert summary["found"] == 0
    assert challenge(cid).status == "VERIFYING"


# ===================================================== 내부 정산 엔드포인트
def test_internal_endpoint_requires_secret(db, client, monkeypatch):
    new_challenge(limit=4000)

    monkeypatch.delenv("CRON_SECRET", raising=False)
    assert client.post("/internal/challenges/verify").status_code == 503     # 미설정 -> 비활성

    monkeypatch.setenv("CRON_SECRET", "s3cret")
    assert client.post("/internal/challenges/verify").status_code == 401     # 헤더 없음
    assert client.post("/internal/challenges/verify", headers={"X-Cron-Secret": "wrong"}).status_code == 401

    r = client.post("/internal/challenges/verify",
                    headers={"X-Cron-Secret": "s3cret"}, params={"as_of": NEXT_DAY.isoformat()})
    assert r.status_code == 200
    assert r.json()["data"] == {"as_of": NEXT_DAY.isoformat(), "found": 1, "succeeded": 1,
                                "failed": 0, "skipped": 0, "errors": 0}

    # 같은 호출을 한 번 더 해도 안전
    r2 = client.post("/internal/challenges/verify",
                     headers={"X-Cron-Secret": "s3cret"}, params={"as_of": NEXT_DAY.isoformat()})
    assert r2.json()["data"]["found"] == 0


def test_internal_endpoint_default_runs_as_of_kst_today(db, client, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "s3cret")
    monkeypatch.setattr(verification, "kst_today", lambda: NEXT_DAY)
    new_challenge(d=D, limit=4000)
    r = client.post("/internal/challenges/verify", headers={"X-Cron-Secret": "s3cret"})
    assert r.json()["data"]["as_of"] == NEXT_DAY.isoformat() and r.json()["data"]["succeeded"] == 1


def test_internal_endpoint_user_id_scopes_manual_run(db, client, monkeypatch):
    """as_of 수동 실행 시 user_id 를 주면 그 유저의 챌린지만 정산하고 다른 유저는 건드리지 않는다."""
    monkeypatch.setenv("CRON_SECRET", "s3cret")
    mine = new_challenge(d=D, limit=4000, user_id=USER_ID)
    others = new_challenge(d=D, limit=4000, user_id=OTHER_USER_ID)

    r = client.post("/internal/challenges/verify", headers={"X-Cron-Secret": "s3cret"},
                    params={"as_of": NEXT_DAY.isoformat(), "user_id": USER_ID})
    data = r.json()["data"]
    assert data["found"] == 1 and data["succeeded"] == 1 and data["user_id"] == USER_ID

    assert challenge(mine).status == "SUCCESS"
    assert challenge(others).status == "VERIFYING"          # 다른 유저는 그대로
    assert user(OTHER_USER_ID).total_xp == 0

    # user_id 없이 돌리면(운영 스케줄러 기본 동작) 나머지도 정산된다
    r2 = client.post("/internal/challenges/verify", headers={"X-Cron-Secret": "s3cret"},
                     params={"as_of": NEXT_DAY.isoformat()})
    assert r2.json()["data"]["succeeded"] == 1 and "user_id" not in r2.json()["data"]
    assert challenge(others).status == "SUCCESS"


# ------------------------------------------------------------------ 공용 픽스처
@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(challenges_router.router)
    app.include_router(internal_router.router)
    app.dependency_overrides[get_current_user_id] = lambda: USER_ID
    return TestClient(app)


@pytest.fixture
def today_is_D(monkeypatch):
    """'오늘(KST)'을 챌린지 대상 날짜 D 로 고정."""
    monkeypatch.setattr(challenges_router, "kst_today", lambda: D)
    monkeypatch.setattr(verification, "kst_today", lambda: D)
