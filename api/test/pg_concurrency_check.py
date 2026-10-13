"""
Postgres 동시성 검증 (선택 실행)
================================
SQLite 는 FOR UPDATE / SKIP LOCKED 를 무시하므로, '동시에 정산이 두 번 돌아도 안전한가'는
진짜 Postgres 에서만 확인할 수 있다. 이 스크립트는 임베디드 Postgres(pgserver)를 띄워서 확인한다.

    pip install pgserver psycopg2-binary
    python tests/pg_concurrency_check.py            # 현재 코드 검증
    python tests/pg_concurrency_check.py --no-user-lock   # (비교용) 유저 행 잠금을 뺀 변형

※ 운영 DB(Supabase)에서는 절대 실행하지 말 것 — 테이블을 drop/create 한다. 임베디드 DB만 사용한다.
"""
import os
import sys
import time
import threading
import tempfile
from datetime import date, time as dtime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pgserver

_dir = tempfile.mkdtemp(prefix="pgdata_")
_srv = pgserver.get_server(_dir, cleanup_mode="stop")
os.environ["DATABASE_URL"] = _srv.get_uri().replace("postgresql://", "postgresql+psycopg2://", 1)

from sqlmodel import SQLModel, Session, select  # noqa: E402
import models  # noqa: E402
from models import User, DailyChallenge, PointTransaction  # noqa: E402
from services import challenge_verification_service as verification  # noqa: E402
from services.leveling import calculate_level_from_xp  # noqa: E402

NO_USER_LOCK = "--no-user-lock" in sys.argv
N_CHALLENGES = 24
N_THREADS = 6
D0 = date(2026, 10, 1)
TODAY = date(2026, 10, 20)


def setup():
    SQLModel.metadata.drop_all(models.engine)
    SQLModel.metadata.create_all(models.engine)
    with Session(models.engine) as s:
        s.add(User(user_id="u1", email="a@a.com", password_hash="x"))
        s.commit()  # Postgres 는 FK 를 강제하므로 유저를 먼저 확정
        for i in range(N_CHALLENGES):
            s.add(DailyChallenge(
                user_id="u1", category_name="카페", challenge_date=D0 + timedelta(days=i % 10),
                challenge_type="제한형", challenge_text="t", difficulty="E",
                status="VERIFYING", xp_reward=10 + (i % 5) * 5,
                ai_metadata={"daily_limit": 4000},
            ))
        s.commit()


def install_slow_reward():
    """보상 계산 중간에 잠깐 멈춰서 경쟁 상태(race)가 생길 틈을 넓힌다."""
    real = verification.process_challenge_completion

    def slow(session, user, xp, commit=True):
        time.sleep(0.03)
        return real(session, user, xp, commit=commit)

    verification.process_challenge_completion = slow


def maybe_remove_user_lock():
    if not NO_USER_LOCK:
        return
    import inspect
    src = inspect.getsource(verification._verify_one)
    assert ".with_for_update()\n    ).first()" in src, "유저 잠금 코드를 못 찾음"
    # 유저 행을 잠그지 않는 변형으로 교체 (비교 실험용)
    patched = src.replace("select(User).where(User.user_id == challenge.user_id).with_for_update()",
                          "select(User).where(User.user_id == challenge.user_id)")
    ns = verification.__dict__
    exec(patched, ns)


def run_threads():
    results, lock = [], threading.Lock()
    barrier = threading.Barrier(N_THREADS)

    def worker():
        barrier.wait()  # 동시에 출발
        r = verification.verify_pending_challenges(today=TODAY)
        with lock:
            results.append(r)

    threads = [threading.Thread(target=worker) for _ in range(N_THREADS)]
    t0 = time.time()
    [t.start() for t in threads]
    [t.join() for t in threads]
    return results, time.time() - t0


def check():
    with Session(models.engine) as s:
        challenges = s.exec(select(DailyChallenge)).all()
        user = s.get(User, "u1")
        ptx = s.exec(select(PointTransaction)).all()

    expected_xp = sum(c.xp_reward for c in challenges)
    by_status = {}
    for c in challenges:
        by_status[c.status] = by_status.get(c.status, 0) + 1

    problems = []
    if by_status.get("SUCCESS", 0) != N_CHALLENGES:
        problems.append(f"SUCCESS 가 {N_CHALLENGES}개가 아님: {by_status}")
    if user.total_xp != expected_xp:
        problems.append(f"XP 불일치(덮어쓰기/중복 지급): 실제 {user.total_xp} / 기대 {expected_xp}")
    if user.current_level != calculate_level_from_xp(user.total_xp):
        problems.append(f"레벨 불일치: {user.current_level} vs {calculate_level_from_xp(user.total_xp)}")
    if sum(p.amount for p in ptx) != user.current_points:
        problems.append(f"포인트 장부 불일치: 로그합 {sum(p.amount for p in ptx)} / 잔액 {user.current_points}")
    snaps = sum(1 for c in challenges if c.reward_snapshot)
    if snaps != N_CHALLENGES:
        problems.append(f"reward_snapshot 누락: {snaps}/{N_CHALLENGES}")

    return problems, user, by_status, len(ptx)


if __name__ == "__main__":
    setup()
    install_slow_reward()
    maybe_remove_user_lock()
    results, elapsed = run_threads()

    print(f"[{'유저 잠금 제거 변형' if NO_USER_LOCK else '현재 코드'}] 스레드 {N_THREADS}개 동시 정산, {elapsed:.2f}s")
    print("스레드별 결과:", [(r['succeeded'], r['skipped'], r['errors']) for r in results], "(성공, 건너뜀, 오류)")
    problems, user, by_status, ptx_n = check()
    print(f"상태 분포={by_status}, total_xp={user.total_xp}, level={user.current_level}, points={user.current_points}, 포인트로그={ptx_n}건")
    total_success = sum(r["succeeded"] for r in results)
    total_errors = sum(r["errors"] for r in results)
    print(f"스레드 합계: 성공 {total_success}, 오류 {total_errors}")
    if total_success != N_CHALLENGES:
        problems.append(f"성공 합계가 {N_CHALLENGES}가 아님({total_success}) -> 같은 챌린지를 두 번 정산했거나 누락")
    print("결과:", "OK ✅ 이상 없음" if not problems else "문제 발견 ❌")
    for p in problems:
        print("  -", p)
    sys.exit(1 if problems else 0)
