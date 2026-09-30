"""
mock 데이터로 report.py 검증.

mock은 2026-10-01 기준 실제 BE 코드에서 그대로 옮긴 구조다.
  api/routers/reports_router.py       (/reports/weekly, /reports/monthly)
  api/services/reports_service.py     (category_comparison, weekly_breakdown, category_overrun)
  api/services/challenge_stats_service.py  (get_category_stats)
  api/routers/categories_router.py    (/categories/budget-history)

BE 응답은 전부 {"status": "success", "data": {...}} 로 감싸여 있다.
report.py가 껍데기째로 받아도, data만 받아도 동작해야 하므로 양쪽을 테스트한다.

실행:
    MONI_SKIP_LLM=1 python3 test_report_mock.py    # 폴백(계산) 확인
    OPENAI_API_KEY=... python3 test_report_mock.py # 실제 GPT 총평 확인
    ... --full-prompt                              # 프롬프트 전문 출력
"""
import sys

sys.path.insert(0, ".")

from moni_engine.report import (
    build_weekly_report, build_monthly_report,
    extract_weekly_facts, extract_monthly_facts,
)

# ============================================================
# MOCK : GET /reports/weekly  (실제 응답 구조)
# ============================================================

# --- 주간 A: 소비가 줄어든 주 ---
WEEKLY_GOOD = {
    "status": "success",
    "data": {
        "week_start": "2026-09-21",
        "week_end": "2026-09-27",
        "weekly_summary": {
            "total_spend": 182000,
            "last_week_total_spend": 235000,
            "change_amount": -53000,
            "change_percent": -22.6,          # 비율 아님, 퍼센트
            "transaction_count": 21,
            "xp_earned": 160,
        },
        "daily_trend": [                        # 요일별 (총평에는 안 씀)
            {"label": "월", "amount": 21000},
            {"label": "화", "amount": 18000},
            {"label": "수", "amount": 32000},
            {"label": "목", "amount": 25000},
            {"label": "금", "amount": 41000},
            {"label": "토", "amount": 30000},
            {"label": "일", "amount": 15000},
        ],
        "category_comparison": [
            {"category_name": "식비", "budget_limit": 480000,
             "this_week_spend": 121000, "last_week_spend": 112000,
             "change_amount": 9000, "change_percent": 8.0},
            {"category_name": "교통", "budget_limit": 150000,
             "this_week_spend": 40000, "last_week_spend": 75000,
             "change_amount": -35000, "change_percent": -46.7},
            {"category_name": "카페", "budget_limit": 100000,
             "this_week_spend": 21000, "last_week_spend": 48000,
             "change_amount": -27000, "change_percent": -56.3},
        ],
    },
}

# --- 주간 B: 소비가 늘어난 주 ---
WEEKLY_BAD = {
    "status": "success",
    "data": {
        "week_start": "2026-09-14",
        "week_end": "2026-09-20",
        "weekly_summary": {
            "total_spend": 312000,
            "last_week_total_spend": 210000,
            "change_amount": 102000,
            "change_percent": 48.6,
            "transaction_count": 28,
            "xp_earned": 65,
        },
        "daily_trend": [{"label": l, "amount": a} for l, a in
                        zip("월화수목금토일", [30000, 25000, 60000, 42000, 75000, 50000, 30000])],
        "category_comparison": [
            {"category_name": "식비", "budget_limit": 480000,
             "this_week_spend": 198000, "last_week_spend": 120000,
             "change_amount": 78000, "change_percent": 65.0},
            {"category_name": "쇼핑", "budget_limit": 200000,
             "this_week_spend": 62000, "last_week_spend": 57000,
             "change_amount": 5000, "change_percent": 8.8},
            {"category_name": "카페", "budget_limit": 100000,
             "this_week_spend": 52000, "last_week_spend": 33000,
             "change_amount": 19000, "change_percent": 57.6},
        ],
    },
}

# --- 지난주 기록이 아예 없는 주 (change_percent가 None) ---
WEEKLY_NO_LAST_WEEK = {
    "status": "success",
    "data": {
        "week_start": "2026-09-21",
        "week_end": "2026-09-27",
        "weekly_summary": {
            "total_spend": 95000,
            "last_week_total_spend": 0,
            "change_amount": 95000,
            "change_percent": None,           # BE는 previous가 0이면 None을 준다
            "transaction_count": 8,
            "xp_earned": 40,
        },
        "daily_trend": [],
        "category_comparison": [
            {"category_name": "식비", "budget_limit": 480000,
             "this_week_spend": 95000, "last_week_spend": 0,
             "change_amount": 95000, "change_percent": None},
        ],
    },
}


# ============================================================
# MOCK : GET /challenges/stats/by-category
#   → summary 블록이 없다. categories 합산으로 처리돼야 한다.
# ============================================================
CHALLENGE_STATS_WEEK = {
    "status": "success",
    "data": {
        "period": "week",
        "start_date": "2026-09-21",
        "end_date": "2026-09-27",
        "categories": [
            {"category_name": "교통", "total_count": 3, "completed_count": 1,
             "completion_rate": 0.3333, "xp_earned": 20},
            {"category_name": "식비", "total_count": 6, "completed_count": 3,
             "completion_rate": 0.5, "xp_earned": 60},
            {"category_name": "카페", "total_count": 6, "completed_count": 5,
             "completion_rate": 0.8333, "xp_earned": 80},
        ],
    },
}

# 달성률이 낮은 주 (3/10)
CHALLENGE_STATS_LOW = {
    "status": "success",
    "data": {
        "period": "week",
        "start_date": "2026-09-14",
        "end_date": "2026-09-20",
        "categories": [
            {"category_name": "식비", "total_count": 5, "completed_count": 1,
             "completion_rate": 0.2, "xp_earned": 25},
            {"category_name": "카페", "total_count": 5, "completed_count": 2,
             "completion_rate": 0.4, "xp_earned": 40},
        ],
    },
}

# 달성률이 높은 주 (8/10)
CHALLENGE_STATS_HIGH = {
    "status": "success",
    "data": {
        "period": "week",
        "categories": [
            {"category_name": "식비", "total_count": 5, "completed_count": 4,
             "completion_rate": 0.8, "xp_earned": 80},
            {"category_name": "카페", "total_count": 5, "completed_count": 4,
             "completion_rate": 0.8, "xp_earned": 85},
        ],
    },
}

MONTHLY_CHALLENGE_STATS = {
    "status": "success",
    "data": {
        "period": "all",
        "start_date": "2026-09-01",
        "end_date": "2026-09-30",
        "categories": [
            {"category_name": "교통", "total_count": 12, "completed_count": 7,
             "completion_rate": 0.5833, "xp_earned": 150},
            {"category_name": "식비", "total_count": 25, "completed_count": 15,
             "completion_rate": 0.6, "xp_earned": 330},
            {"category_name": "카페", "total_count": 25, "completed_count": 19,
             "completion_rate": 0.76, "xp_earned": 340},
        ],
    },
}


# ============================================================
# MOCK : GET /reports/monthly
# ============================================================

def _daily_cum(start_day: int, days: int, step: int):
    """daily_cumulative는 실제로 한 달치(30개 전후)가 들어온다. LLM에 넘어가면 안 된다."""
    return [{"date": f"2026-09-{d:02d}", "cumulative_spend": (d - start_day + 1) * step}
            for d in range(start_day, start_day + days)]


# --- 월간 A: 예산 초과 + 월 중 예산 증액 ---
MONTHLY_OVERRUN = {
    "status": "success",
    "data": {
        "month": "2026-09",
        "is_current_month": False,
        "monthly_summary": {
            "total_spend": 1_180_000,
            "budget_limit": 1_000_000,
            "predicted_monthly_spend": 1_180_000,
            "budget_pressure": 1.18,
            "transaction_count": 96,
            "xp_earned": 820,
        },
        "weekly_trend": [   # 요일별! 주차별 흐름으로 오인하면 안 되는 자리
            {"label": l, "amount": a} for l, a in
            zip("월화수목금토일", [140000, 130000, 190000, 160000, 250000, 190000, 120000])
        ],
        "weekly_breakdown": [   # 이쪽이 시간순 주차별 흐름
            {"week_label": "1주차", "week_start": "2026-08-31",
             "week_end": "2026-09-06", "amount": 210000},
            {"week_label": "2주차", "week_start": "2026-09-07",
             "week_end": "2026-09-13", "amount": 265000},
            {"week_label": "3주차", "week_start": "2026-09-14",
             "week_end": "2026-09-20", "amount": 352000},
            {"week_label": "4주차", "week_start": "2026-09-21",
             "week_end": "2026-09-27", "amount": 353000},
        ],
        "evaluated_categories": [
            {"category_name": "식비", "budget_limit": 480000, "actual_spend": 610000,
             "predicted_monthly_spend": 610000, "budget_pressure": 1.27, "rank": 1},
            {"category_name": "쇼핑", "budget_limit": 200000, "actual_spend": 230000,
             "predicted_monthly_spend": 230000, "budget_pressure": 1.15, "rank": 2},
            {"category_name": "카페", "budget_limit": 100000, "actual_spend": 95000,
             "predicted_monthly_spend": 95000, "budget_pressure": 0.95, "rank": 3},
        ],
        "category_overrun": [
            {"category_name": "식비", "budget_limit": 480000,
             "overrun_date": "2026-09-20",
             "daily_cumulative": _daily_cum(1, 30, 20000)},
            {"category_name": "쇼핑", "budget_limit": 200000,
             "overrun_date": "2026-09-26",
             "daily_cumulative": _daily_cum(1, 30, 7600)},
            {"category_name": "카페", "budget_limit": 100000,
             "overrun_date": None,
             "daily_cumulative": _daily_cum(1, 30, 3100)},
        ],
    },
}

BUDGET_HISTORY = {
    "status": "success",
    "count": 1,
    "data": [
        {"category_name": "식비", "old_limit": 400000, "new_limit": 480000,
         "changed_at": "2026-09-12T10:22:00"},
    ],
}

# --- 월간 B: 잘 관리한 달 (후반 감소, 초과 없음) ---
MONTHLY_GOOD = {
    "status": "success",
    "data": {
        "month": "2026-09",
        "is_current_month": False,
        "monthly_summary": {
            "total_spend": 720_000,
            "budget_limit": 1_000_000,
            "predicted_monthly_spend": 720_000,
            "budget_pressure": 0.72,
            "transaction_count": 61,
            "xp_earned": 820,
        },
        "weekly_trend": [{"label": l, "amount": a} for l, a in
                         zip("월화수목금토일", [95000, 88000, 130000, 102000, 140000, 105000, 60000])],
        "weekly_breakdown": [
            {"week_label": "1주차", "week_start": "2026-08-31",
             "week_end": "2026-09-06", "amount": 245000},
            {"week_label": "2주차", "week_start": "2026-09-07",
             "week_end": "2026-09-13", "amount": 210000},
            {"week_label": "3주차", "week_start": "2026-09-14",
             "week_end": "2026-09-20", "amount": 148000},
            {"week_label": "4주차", "week_start": "2026-09-21",
             "week_end": "2026-09-27", "amount": 117000},
        ],
        "evaluated_categories": [],
        "category_overrun": [
            {"category_name": "식비", "budget_limit": 480000, "overrun_date": None,
             "daily_cumulative": _daily_cum(1, 30, 12000)},
            {"category_name": "카페", "budget_limit": 100000, "overrun_date": None,
             "daily_cumulative": _daily_cum(1, 30, 2400)},
        ],
    },
}


# ============================================================
# 출력 헬퍼
# ============================================================
def show_weekly(title, weekly, stats):
    print("=" * 66)
    print(f"[주간] {title}")
    print("=" * 66)
    r = build_weekly_report(weekly, stats, user_id="user-001",
                            period_start="2026-09-21", period_end="2026-09-27")
    h = r["highlights"]
    print("  선별된 사실:")
    print(f"    소비 방향     : {h['spending_direction']} "
          f"({int(h['last_week_total']):,} → {int(h['week_total']):,}, "
          f"변화율 {h['change_rate']:+.1%})")
    print(f"    가장 줄인 것  : {h['top_decrease']}")
    print(f"    가장 늘어난 것: {h['top_increase']}")
    print(f"    챌린지        : {h['challenge_completed']}/{h['challenge_total']} 달성, "
          f"XP {h['xp_earned']}")
    print(f"  총평 [{r['comment_source']}]")
    print(f"    → {r['comment']}")
    print()
    return r


def show_monthly(title, monthly, stats, history=None):
    print("=" * 66)
    print(f"[월간] {title}")
    print("=" * 66)
    r = build_monthly_report(monthly, stats, history, user_id="user-001",
                             period_start="2026-09-01", period_end="2026-09-30")
    h = r["highlights"]
    print("  선별된 사실:")
    print(f"    주차별 흐름   : {[int(a) for a in h['weekly_amounts']]} → '{h['trend']}'")
    print(f"    예산 사용률   : {h['usage_ratio']:.0%} "
          f"({int(h['total_spent']):,} / {int(h['budget']):,})")
    print(f"    예산 초과     : {h['overruns'] or '없음'}")
    print(f"    예산 변경     : {h['budget_changes'] or '없음'}")
    print(f"    챌린지        : {h['challenge_completed']}/{h['challenge_total']} 달성, "
          f"XP {h['xp_earned']}")
    print(f"  총평 [{r['comment_source']}]")
    print(f"    → {r['comment']}")
    print()
    return r


if __name__ == "__main__":
    show_weekly("소비가 줄어든 주 / 달성 보통", WEEKLY_GOOD, CHALLENGE_STATS_WEEK)
    show_weekly("소비가 늘어난 주 / 달성 낮음", WEEKLY_BAD, CHALLENGE_STATS_LOW)
    show_weekly("달성 높음", WEEKLY_GOOD, CHALLENGE_STATS_HIGH)
    show_weekly("지난주 기록 없음 (change_percent=None)",
                WEEKLY_NO_LAST_WEEK, CHALLENGE_STATS_LOW)
    show_monthly("예산 초과 + 월 중 예산 증액", MONTHLY_OVERRUN,
                 MONTHLY_CHALLENGE_STATS, BUDGET_HISTORY)
    show_monthly("잘 관리한 달 (후반 감소)", MONTHLY_GOOD, MONTHLY_CHALLENGE_STATS)

    # ---- 껍데기를 벗겨서 data만 넘겨도 동일하게 동작해야 한다 ----
    print("=" * 66)
    print("[형태] status/data 껍데기 유무에 관계없이 같은 결과인지")
    print("=" * 66)
    wrapped = extract_weekly_facts(WEEKLY_GOOD, CHALLENGE_STATS_WEEK)
    unwrapped = extract_weekly_facts(WEEKLY_GOOD["data"], CHALLENGE_STATS_WEEK["data"])
    print(f"  껍데기 포함: {int(wrapped['week_total']):,}원, "
          f"{wrapped['challenge_completed']}/{wrapped['challenge_total']} 달성")
    print(f"  data만     : {int(unwrapped['week_total']):,}원, "
          f"{unwrapped['challenge_completed']}/{unwrapped['challenge_total']} 달성")
    print(f"  일치: {'OK' if wrapped == unwrapped else 'MISMATCH'}")
    print()

    mw = extract_monthly_facts(MONTHLY_OVERRUN, MONTHLY_CHALLENGE_STATS, BUDGET_HISTORY)
    mu = extract_monthly_facts(MONTHLY_OVERRUN["data"],
                               MONTHLY_CHALLENGE_STATS["data"], BUDGET_HISTORY["data"])
    print(f"  월간 껍데기 포함: 사용률 {mw['usage_ratio']:.0%}, "
          f"초과 {len(mw['overruns'])}건, 변경 {len(mw['budget_changes'])}건")
    print(f"  월간 data만     : 사용률 {mu['usage_ratio']:.0%}, "
          f"초과 {len(mu['overruns'])}건, 변경 {len(mu['budget_changes'])}건")
    print(f"  일치: {'OK' if mw == mu else 'MISMATCH'}")
    print()

    # ---- 엣지 케이스 ----
    print("=" * 66)
    print("[엣지] 빈 데이터 / 일부 필드 누락")
    print("=" * 66)
    r1 = build_weekly_report(None, None)
    print(f"  전부 None      → [{r1['comment_source']}] {r1['comment']}")
    r2 = build_weekly_report({}, {})
    print(f"  빈 dict        → [{r2['comment_source']}] {r2['comment']}")
    r3 = build_weekly_report({"status": "success", "data": {}},
                             {"status": "success", "data": {"categories": []}})
    print(f"  빈 응답        → [{r3['comment_source']}] {r3['comment']}")
    r4 = build_monthly_report(
        {"status": "success", "data": {"monthly_summary": {"total_spend": 500000}}},
        None, None)
    print(f"  요약만 일부    → [{r4['comment_source']}] {r4['comment']}")
    print()

    # ---- FIELD MAP이 틀렸을 때 경고가 나오는지 ----
    print("=" * 66)
    print("[안전장치] 키 이름이 바뀌면 경고가 뜨는지")
    print("=" * 66)
    bogus = {"status": "success", "data": {"summary_v2": {"total_spend": 100000}}}
    rb = build_weekly_report(bogus, None)
    print(f"  결과: [{rb['comment_source']}] {rb['comment']}")
    print()

    # ---- 반환 구조 ----
    print("=" * 66)
    print("[구조] 반환 키")
    print("=" * 66)
    sw = build_weekly_report(WEEKLY_GOOD, CHALLENGE_STATS_WEEK, user_id="user-001")
    sm = build_monthly_report(MONTHLY_OVERRUN, MONTHLY_CHALLENGE_STATS, BUDGET_HISTORY)
    print("  weekly : " + ", ".join(sw.keys()))
    print("  monthly: " + ", ".join(sm.keys()))
    print()

    # ---- LLM에 넘어가는 요약 ----
    from moni_engine.report import (
        _weekly_summary_text, _monthly_summary_text,
        _build_weekly_prompt, _build_monthly_prompt,
    )
    print("=" * 66)
    print("[프롬프트] LLM에 넘어가는 주간 요약")
    print("=" * 66)
    print(_weekly_summary_text(extract_weekly_facts(WEEKLY_GOOD, CHALLENGE_STATS_WEEK)))
    print()
    print("=" * 66)
    print("[프롬프트] LLM에 넘어가는 월간 요약")
    print("=" * 66)
    print(_monthly_summary_text(
        extract_monthly_facts(MONTHLY_OVERRUN, MONTHLY_CHALLENGE_STATS, BUDGET_HISTORY)))
    print()
    print("  ※ daily_cumulative(카테고리당 30개)가 위 요약에 없어야 정상")
    print()

    if "--full-prompt" in sys.argv:
        print("=" * 66)
        print("[프롬프트 전문] 월간")
        print("=" * 66)
        print(_build_monthly_prompt(_monthly_summary_text(
            extract_monthly_facts(MONTHLY_OVERRUN, MONTHLY_CHALLENGE_STATS, BUDGET_HISTORY))))
        print()

    print("✅ 전체 정상 동작")