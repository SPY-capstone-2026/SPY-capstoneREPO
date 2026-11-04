"""
시드 거래 생성기(generate_seed v2) / 교체(reseed_transactions) / 이어 생성(extend_transactions) 테스트.
실행: cd api && python -m pytest test/test_seed_generation.py -q
"""
from datetime import date, datetime, time, timedelta

import pandas as pd
import pytest
from sqlmodel import Session, SQLModel, select

from models import engine, User, Transaction, GeneratedReport, DailyChallenge
import generate_seed as gs
import reseed_transactions as rs
import extend_transactions as ex

U = "user-office-001"
OTHER = "other-user"
START, END = date(2025, 10, 1), date(2026, 10, 15)


@pytest.fixture(scope="module")
def year_df():
    df, _ = gs.generate_university_student_data(
        user_id=U, start_date=START, end_date=END, until=datetime(2026, 10, 15, 23, 59))
    df["d"] = pd.to_datetime(df["tx_date"]).dt.date
    return df


# ----------------------------------------
# 생성 규칙 (1년치)
# ----------------------------------------
def test_daily_food_cap(year_df):
    food = year_df[year_df.final_category == "식비"].groupby("d").amount.sum()
    assert food.max() <= gs.DAILY_FOOD_CAP_SPECIAL
    # 15,000원 초과는 가끔 (약속/시험기간 야식 날)
    assert (food > gs.DAILY_FOOD_CAP).mean() < 0.10
    assert 8_000 <= food.mean() <= 13_000


def test_cafe_rules(year_df):
    cafe = year_df[year_df.final_category == "카페"]
    assert cafe.amount.max() <= 5_000
    cups = cafe.groupby("d").size()
    assert cups.max() <= 2
    days = (END - START).days + 1
    assert 0.70 <= len(cups) / days <= 0.95           # 대부분의 날 1잔 이상
    assert (cups == 2).sum() / days < 0.20             # 2잔은 가끔


def test_exam_days_have_more_cafe_and_food(year_df):
    df = year_df.assign(exam=year_df.d.map(lambda d: gs.exam_label(d) is not None))
    cafe = df[df.final_category == "카페"].groupby(["d", "exam"]).size().reset_index(name="n")
    assert cafe[cafe.exam].n.mean() > cafe[~cafe.exam].n.mean()
    food = df[df.final_category == "식비"].groupby(["d", "exam"]).amount.sum().reset_index()
    assert food[food.exam].amount.mean() > food[~food.exam].amount.mean()


def test_shopping_at_most_twice_a_month(year_df):
    shop = year_df[year_df.final_category.isin(["화장품", "의류"])].copy()
    shop["ym"] = shop.tx_date.str[:7]
    counts = shop.groupby(["ym", "final_category"]).size()
    assert counts.max() <= 2
    months = year_df.tx_date.str[:7].nunique()
    assert counts.xs("화장품", level=1).sum() / months <= 1.5


def test_user_corrected_means_category_changed(year_df):
    corrected = year_df[year_df.is_user_corrected]
    assert len(corrected) > 0
    assert (corrected.mydata_category != corrected.final_category).all()
    plain = year_df[~year_df.is_user_corrected]
    assert ((plain.mydata_category == plain.final_category) | (plain.mydata_category == "쇼핑")).all()


def test_unique_ids_and_sorted(year_df):
    assert year_df.tx_id.is_unique
    stamps = pd.to_datetime(year_df.tx_date + " " + year_df.tx_time)
    assert stamps.is_monotonic_increasing


# ----------------------------------------
# 시간 기준 (핵심 요구사항)
# ----------------------------------------
def test_until_cuts_future_transactions():
    until = datetime(2026, 10, 15, 17, 0)
    df, _ = gs.generate_university_student_data(user_id=U, start_date=date(2026, 10, 10),
                                                end_date=date(2026, 10, 20), until=until)
    stamps = pd.to_datetime(df.tx_date + " " + df.tx_time)
    assert stamps.max() <= until
    assert df.tx_date.max() == "2026-10-15"


def test_split_generation_equals_full_day():
    """17시에 한 번, 23시59분에 이어서 한 번 = 하루를 한 번에 만든 것과 같다."""
    d = date(2026, 10, 20)  # 시험기간이라 밤 거래가 많은 날
    full, _ = gs.generate_university_student_data(user_id=U, start_date=d, end_date=d,
                                                  until=datetime(2026, 10, 20, 23, 59))
    first, _ = gs.generate_university_student_data(user_id=U, start_date=d, end_date=d,
                                                   until=datetime(2026, 10, 20, 17, 0))
    second, _ = gs.generate_university_student_data(user_id=U, start_date=d, end_date=d,
                                                    after=datetime(2026, 10, 20, 17, 0),
                                                    until=datetime(2026, 10, 20, 23, 59))
    assert len(first) > 0 and len(second) > 0
    assert pd.concat([first, second]).reset_index(drop=True).equals(full)


def test_deterministic_per_day_regardless_of_range():
    a, _ = gs.generate_university_student_data(user_id=U, start_date=date(2026, 9, 1),
                                               end_date=date(2026, 9, 30), until=datetime(2026, 10, 1))
    b, _ = gs.generate_university_student_data(user_id=U, start_date=date(2026, 9, 15),
                                               end_date=date(2026, 9, 15), until=datetime(2026, 10, 1))
    assert a[a.tx_date == "2026-09-15"].reset_index(drop=True).equals(b)


# ----------------------------------------
# DB: 교체 / 복원 / 이어 생성
# ----------------------------------------
@pytest.fixture
def db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        for uid in (U, OTHER):
            s.add(User(user_id=uid, email=f"{uid}@x", password_hash="x"))
        s.commit()
        # 옛날(v1) 생성 거래: 비싼 식비
        for i in range(10):
            d = date(2026, 10, 1) + timedelta(days=i)
            s.add(Transaction(tx_id=f"old{i:05d}", user_id=U, tx_date=d, tx_time=time(19, 0),
                              amount=30000, merchant_name="삼겹살집", mydata_category="식비",
                              final_category="식비"))
        s.add(Transaction(tx_id="manual-1", user_id=U, tx_date=date(2026, 10, 5), tx_time=time(12, 0),
                          amount=7777, merchant_name="내가 입력", mydata_category="직접 입력",
                          final_category="식비", is_user_corrected=True))
        s.add(Transaction(tx_id="other-1", user_id=OTHER, tx_date=date(2026, 10, 5), tx_time=time(12, 0),
                          amount=5000, merchant_name="학생식당", mydata_category="식비", final_category="식비"))
        s.add(GeneratedReport(user_id=U, report_type="WEEKLY", period_start=date(2026, 10, 5),
                              period_end=date(2026, 10, 11), report_data={}))
        s.add(GeneratedReport(user_id=OTHER, report_type="WEEKLY", period_start=date(2026, 10, 5),
                              period_end=date(2026, 10, 11), report_data={}))
        for status in ("PENDING", "VERIFYING"):
            s.add(DailyChallenge(user_id=U, category_name="식비", challenge_date=date(2026, 10, 15),
                                 challenge_type="LIMIT", challenge_text="t", difficulty="EASY",
                                 status=status, xp_reward=10))
        s.commit()
    yield


NOW = datetime(2026, 10, 15, 17, 0)


def _tx(user_id):
    with Session(engine) as s:
        return rs.load_user_transactions(s, user_id)


def test_reseed_replaces_only_generated_rows(db, tmp_path):
    with Session(engine) as s:
        plan = rs.plan_reseed(s, U, until=NOW)
        assert plan["start"] == date(2026, 10, 1)
        assert len(plan["generated"]) == 10 and len(plan["manual"]) == 1
        backup = rs.save_backup(plan["current"], U, backup_dir=str(tmp_path))
        result = rs.apply_reseed(s, U, plan, regenerate_today=True)

    after = _tx(U)
    assert "manual-1" in set(after.tx_id)                         # 직접 입력은 남는다
    assert not after.tx_id.str.startswith("old").any()            # 옛 생성 거래는 사라진다
    assert len(after) == len(plan["new"]) + 1 == result["inserted"] + 1
    stamps = pd.to_datetime(after.tx_date + " " + after.tx_time)
    assert stamps.max() <= NOW                                    # 미래 거래 없음
    assert len(_tx(OTHER)) == 1                                   # 다른 유저 그대로

    with Session(engine) as s:
        assert [r.user_id for r in s.exec(select(GeneratedReport)).all()] == [OTHER]
        assert sorted(c.status for c in s.exec(select(DailyChallenge)).all()) == ["VERIFYING"]

    # 복원하면 원래대로
    with Session(engine) as s:
        rs.restore_backup(s, U, backup)
    restored = _tx(U).sort_values("tx_id").reset_index(drop=True)
    original = pd.read_csv(backup, dtype={"tx_id": str}).sort_values("tx_id").reset_index(drop=True)
    assert restored.tx_id.tolist() == original.tx_id.tolist()
    assert restored.amount.tolist() == original.amount.tolist()


def test_reseed_without_flag_keeps_today_challenges(db):
    with Session(engine) as s:
        rs.apply_reseed(s, U, rs.plan_reseed(s, U, until=NOW))
        assert len(s.exec(select(DailyChallenge)).all()) == 2


def test_reseed_twice_is_safe(db):
    for _ in range(2):
        with Session(engine) as s:
            rs.apply_reseed(s, U, rs.plan_reseed(s, U, start=date(2026, 10, 1), until=NOW))
    assert len(_tx(U)) == len(gs.generate_university_student_data(
        user_id=U, start_date=date(2026, 10, 1), end_date=NOW.date(), until=NOW)[0]) + 1


def test_restore_rejects_other_users_backup(db, tmp_path):
    path = tmp_path / "b.csv"
    _tx(OTHER).to_csv(path, index=False)
    with Session(engine) as s, pytest.raises(SystemExit):
        rs.restore_backup(s, U, str(path))
    assert len(_tx(U)) == 11


def test_extend_adds_only_after_last_until_now(db):
    with Session(engine) as s:
        rs.apply_reseed(s, U, rs.plan_reseed(s, U, until=datetime(2026, 10, 15, 12, 0)))
    before = _tx(U)

    with Session(engine) as s:
        last, until, df = ex.plan_extend(s, U, until=NOW)
        assert last <= datetime(2026, 10, 15, 12, 0)
        assert not df.empty
        stamps = pd.to_datetime(df.tx_date + " " + df.tx_time)
        assert (stamps > last).all() and (stamps <= NOW).all()
        ex.apply_extend(s, U, df)

    # 다시 실행하면 추가할 게 없다
    with Session(engine) as s:
        _, _, df2 = ex.plan_extend(s, U, until=NOW)
        assert df2 is None or df2.empty

    # 12시 교체 + 17시까지 이어 생성 = 17시에 한 번에 교체한 결과와 같다 (직접 입력 제외)
    after = _tx(U)
    gen = after[after.mydata_category != "직접 입력"].sort_values("tx_id").tx_id.tolist()
    expected, _ = gs.generate_university_student_data(user_id=U, start_date=date(2026, 10, 1),
                                                      end_date=NOW.date(), until=NOW)
    assert gen == sorted(expected.tx_id.tolist())
    assert len(after) > len(before)


def test_extend_ignores_manual_rows_for_last_time(db):
    with Session(engine) as s:
        rs.apply_reseed(s, U, rs.plan_reseed(s, U, until=datetime(2026, 10, 15, 9, 0)))
        s.add(Transaction(tx_id="manual-late", user_id=U, tx_date=date(2026, 10, 15), tx_time=time(16, 59),
                          amount=1000, merchant_name="x", mydata_category="직접 입력", final_category="식비"))
        s.commit()
        last = ex.get_last_generated_at(s, U)
    assert last <= datetime(2026, 10, 15, 9, 0)
