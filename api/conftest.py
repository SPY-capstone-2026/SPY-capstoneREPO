"""
pytest 공통 설정.

1) DB: 기본은 임시 SQLite. TEST_DATABASE_URL 을 주면 그 DB(로컬/임베디드 Postgres 등)에서 돌린다.
   ※ 테스트가 테이블을 drop/create 하므로 운영 DB(Supabase) 주소를 넣으면 절대 안 된다.
2) AI 엔진: moni_engine.engine 은 TensorFlow/LLM 을 불러오는 무거운 모듈이라 테스트에서는 대역으로 대체한다.
"""
import os
import sys
import tempfile
import types

if os.getenv("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
else:
    _db = os.path.join(tempfile.mkdtemp(), "test.db")
    os.environ["DATABASE_URL"] = f"sqlite:///{_db}"

if "moni_engine.engine" not in sys.modules:
    _pkg = types.ModuleType("moni_engine")
    _eng = types.ModuleType("moni_engine.engine")
    _eng.get_today_challenges = lambda **kwargs: []
    _pkg.engine = _eng
    sys.modules["moni_engine"] = _pkg
    sys.modules["moni_engine.engine"] = _eng

if "moni_engine.report" not in sys.modules:
    _rep = types.ModuleType("moni_engine.report")
    _rep.generate_weekly_comment = lambda *a, **k: {"comment": "stub", "comment_source": "stub"}
    _rep.generate_monthly_comment = lambda *a, **k: {"comment": "stub", "comment_source": "stub"}
    sys.modules["moni_engine.report"] = _rep
    sys.modules["moni_engine"].report = _rep
