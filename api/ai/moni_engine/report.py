"""
report.py
=========

주간 / 월간 성과 리포트의 "종합 평가 문구"를 생성하는 모듈.

역할 분담
---------
- BE  : 소비/예산/챌린지 집계 (API로 계산) → 이 모듈에 전달
- AI  : 집계 수치에서 "말할 만한 사실"을 규칙으로 선별 → LLM으로 총평 한 문단 생성
- LLM : 수치 계산을 하지 않는다. 이미 정해진 사실을 "표현"만 한다.

핵심 함수
---------
    generate_weekly_comment(weekly_report, challenge_stats)   → 총평만
    generate_monthly_comment(monthly_report, challenge_stats, budget_history) → 총평만
    build_weekly_report(...)   → 리포트 dict 전체 조립 (총평 포함)
    build_monthly_report(...)  → 리포트 dict 전체 조립 (총평 포함)

BE가 총평만 받아 직접 조립해도 되고(generate_*), AI가 조립한 리포트를
그대로 저장해도 된다(build_*). 둘 중 편한 쪽을 쓰면 된다.

※ BE 응답의 실제 필드명은 2026-10-01 기준 BE 코드를 읽고 FIELD MAP에 확정했다.
  BE가 필드명을 바꾸면 FIELD MAP만 수정하면 된다.
  (`_pick`이 후보 키를 순서대로 탐색하므로 예비 후보도 함께 남겨둠)

※ BE는 모든 응답을 {"status": "success", "data": {...}} 로 감싼다.
  `_unwrap`이 이를 벗겨내므로, 껍데기째 넘겨도 data만 넘겨도 동작한다.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from moni_engine.llm_client import call_llm


SCHEMA_VERSION = "1.0"

# 총평 길이 정책 (프롬프트 + 토큰 상한 양쪽에 반영)
WEEKLY_MAX_SENTENCES = 2
MONTHLY_MAX_SENTENCES = 3
WEEKLY_MAX_TOKENS = 120
MONTHLY_MAX_TOKENS = 160

# 소비 증감을 "언급할 만하다"고 볼 최소 변화율
MIN_CHANGE_RATIO_TO_MENTION = 0.1   # 10% 이상 변했을 때만 언급

# 챌린지 달성률 평가 구간.
# "잘했다 / 보통 / 아쉽다"의 판단은 규칙이 내리고, LLM은 그 라벨을 표현만 한다.
# (라벨 없이 숫자만 주면 LLM이 30% 달성을 "잘 챙겼다"고 부르는 문제가 있었음)
COMPLETION_GOOD = 0.7
COMPLETION_FAIR = 0.4

# 예산 사용률 평가 구간
USAGE_OVER = 1.0     # 초과
USAGE_TIGHT = 0.9    # 거의 다 씀

# LLM을 부를 최소 사실 개수.
# 말할 사실이 이보다 적으면 LLM이 빈칸을 상상으로 채우므로(환각),
# 아예 호출하지 않고 규칙 기반 문구로 간다.
MIN_FACTS_FOR_LLM = 2


# ============================================================
# FIELD MAP : BE 응답에서 값을 꺼낼 때 시도할 키 후보들
#
# 2026-10-01 실제 BE 코드(api/routers/reports_router.py,
# api/services/reports_service.py, challenge_stats_service.py,
# categories_router.py)를 읽고 확정함. 맨 앞이 실제 키, 뒤는 예비 후보.
# ============================================================
# /reports/weekly → data.weekly_summary
K_WEEK_TOTAL = ("total_spend", "this_week_total", "week_total", "total_spent", "total")
K_LAST_WEEK_TOTAL = ("last_week_total_spend", "last_week_total", "previous_total")
K_CHANGE = ("change_amount", "change", "diff", "delta")
# 비율(0.22) 형태 키. BE는 이걸 주지 않고 change_percent(퍼센트)를 준다.
K_CHANGE_RATE = ("change_rate", "change_ratio", "rate")
# 퍼센트(-22.5) 형태 키. 100으로 나눠서 써야 하므로 위와 분리한다.
K_CHANGE_PERCENT = ("change_percent", "change_pct")
K_XP = ("xp_earned", "earned_xp", "total_xp", "xp")

# /reports/weekly → data.category_comparison[]
K_CATEGORY = ("category_name", "category", "name")
K_THIS_WEEK = ("this_week_spend", "this_week", "current_week", "current")
K_LAST_WEEK = ("last_week_spend", "last_week", "previous_week", "previous")

# /reports/monthly → data.monthly_summary
#   주의: BE는 total_spent(과거분사)가 아니라 total_spend다.
K_MONTH_TOTAL = ("total_spend", "total_spent", "total_spending", "month_total", "total")
K_BUDGET = ("budget_limit", "budget", "total_budget")
K_PRESSURE = ("budget_pressure", "pressure")

# /challenges/stats/by-category → data.categories[]
K_COMPLETED = ("completed_count", "completed", "success_count")
K_TOTAL_COUNT = ("total_count", "total", "generated_count")

# /reports/monthly → data.category_overrun[]
K_OVERRUN_DATE = ("overrun_date", "exceeded_date", "over_date")

# /reports/monthly → data.weekly_breakdown[]
#   주의: monthly 응답에는 weekly_trend도 있는데 그건 '요일별'(월~일) 집계다.
#   시간 순서 주차별 흐름은 weekly_breakdown 쪽이다. 헷갈리면 흐름 판정이 망가진다.
K_WEEK_LABEL = ("week_label", "week", "week_number", "label")
K_WEEK_AMOUNT = ("amount", "total", "total_spend", "spending")

# /categories/budget-history → data[]
K_BUDGET_BEFORE = ("old_limit", "before", "old_value", "previous_budget", "old_budget")
K_BUDGET_AFTER = ("new_limit", "after", "new_value", "new_budget")
K_CHANGED_AT = ("changed_at", "updated_at", "created_at", "date")



# ============================================================
# 안전한 값 추출 헬퍼
# ============================================================
def _pick(data: Any, keys: Iterable[str], default=None):
    """dict에서 후보 키를 순서대로 찾아 첫 번째로 존재하는 값을 반환."""
    if not isinstance(data, dict):
        return default
    for k in keys:
        if k in data and data[k] is not None:
            return data[k]
    return default


def _num(value, default: float = 0.0) -> float:
    """숫자로 안전 변환. 실패하면 default."""
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_list(value) -> List[dict]:
    """
    카테고리 목록이 list로 올 수도, {카테고리명: {...}} dict로 올 수도 있다.
    어느 쪽이든 list[dict]로 정규화한다.
    """
    if isinstance(value, list):
        return [v for v in value if isinstance(v, dict)]
    if isinstance(value, dict):
        out = []
        for name, v in value.items():
            if isinstance(v, dict):
                item = dict(v)
                item.setdefault("category_name", name)
                out.append(item)
        return out
    return []


def _unwrap(response: Any) -> Any:
    """
    BE는 모든 응답을 {"status": "success", "data": {...}} 로 감싼다.
    껍데기째로 넘어와도, data만 넘어와도 같게 동작하도록 벗겨낸다.

    budget-history처럼 data가 list인 경우도 있으므로 타입을 가리지 않는다.
    """
    if isinstance(response, dict) and "data" in response and "status" in response:
        return response["data"]
    return response


def _warn_if_unmapped(label: str, source: Any, summary: Any) -> None:
    """
    응답은 왔는데 요약 블록을 못 찾은 경우를 알린다.

    FIELD MAP이 안 맞으면 값이 전부 0으로 떨어져 리포트가 조용히
    rule_insufficient_data로 나가버린다. 서버에서 눈치챌 수 있게 로그를 남긴다.
    """
    if isinstance(source, dict) and source and not summary:
        print(f"[report.py 경고] {label}: 응답은 있는데 요약 블록을 찾지 못했습니다. "
              f"최상위 키={list(source.keys())[:8]} — FIELD MAP 확인 필요")


def _won(amount: float) -> str:
    """금액을 사람이 읽는 표기로. (요약 텍스트용, 최종 문구엔 LLM이 판단)"""
    return f"{int(round(amount)):,}원"


# ============================================================
# 주간 : 사실 선별 (규칙)
# ============================================================
def extract_weekly_facts(
    weekly_report: Optional[dict],
    challenge_stats: Optional[Any] = None,
) -> dict:
    """
    BE의 주간 집계 결과에서 총평에 쓸 "말할 만한 사실"만 골라낸다.

    수치를 새로 계산하지 않는다. 이미 집계된 값 중 무엇을 이야기할지 고르는 역할.
    """
    weekly_report = _unwrap(weekly_report) or {}
    summary = _pick(weekly_report, ("weekly_summary", "summary"), {}) or {}
    _warn_if_unmapped("주간", weekly_report, summary)

    categories = _as_list(
        _pick(weekly_report, ("category_comparison", "categories", "by_category"), [])
    )

    week_total = _num(_pick(summary, K_WEEK_TOTAL))
    last_week_total = _num(_pick(summary, K_LAST_WEEK_TOTAL))

    change = _pick(summary, K_CHANGE)
    change = _num(change) if change is not None else (week_total - last_week_total)

    # 변화율: 비율 키 → 퍼센트 키(÷100) → 직접 계산 순서로 시도.
    # BE는 change_percent(예: -22.6)를 주므로 스케일 변환이 필요하다.
    change_rate = _pick(summary, K_CHANGE_RATE)
    if change_rate is None:
        pct = _pick(summary, K_CHANGE_PERCENT)
        if pct is not None:
            change_rate = _num(pct) / 100.0
    if change_rate is None and last_week_total > 0:
        change_rate = change / last_week_total
    change_rate = _num(change_rate)

    # ---- 카테고리별 증감에서 가장 눈에 띄는 것만 추림 ----
    increased, decreased = [], []
    for c in categories:
        name = _pick(c, K_CATEGORY)
        if not name:
            continue
        this_w = _num(_pick(c, K_THIS_WEEK))
        last_w = _num(_pick(c, K_LAST_WEEK))
        diff = _pick(c, K_CHANGE)
        diff = _num(diff) if diff is not None else (this_w - last_w)

        entry = {"category": name, "this_week": this_w,
                 "last_week": last_w, "change": diff}
        if diff > 0:
            increased.append(entry)
        elif diff < 0:
            decreased.append(entry)

    top_increase = max(increased, key=lambda e: e["change"], default=None)
    top_decrease = min(decreased, key=lambda e: e["change"], default=None)

    # ---- 챌린지 성과 ----
    challenge = _summarize_challenge_stats(challenge_stats)

    # 주간 XP는 챌린지 stats 또는 weekly_summary 어느 쪽에 있을 수 있음
    xp_earned = challenge.get("xp_earned")
    if not xp_earned:
        xp_earned = _num(_pick(summary, K_XP))

    return {
        "period": "weekly",
        "week_total": week_total,
        "last_week_total": last_week_total,
        "change": change,
        "change_rate": change_rate,
        "spending_direction": _direction_label(change, last_week_total),
        "top_increase": top_increase,
        "top_decrease": top_decrease,
        "challenge_completed": challenge.get("completed_count", 0),
        "challenge_total": challenge.get("total_count", 0),
        "best_category": challenge.get("best_category"),
        "xp_earned": xp_earned or 0,
    }


def _direction_label(change: float, base: float) -> str:
    """지난주 대비 방향. 변화가 미미하면 '비슷'."""
    if base > 0 and abs(change) / base < MIN_CHANGE_RATIO_TO_MENTION:
        return "비슷"
    if change > 0:
        return "증가"
    if change < 0:
        return "감소"
    return "비슷"


def _summarize_challenge_stats(challenge_stats: Optional[Any]) -> dict:
    """
    /challenges/stats/by-category 응답을 요약.
    전체 합계가 응답에 있으면 그대로 쓰고, 카테고리별 목록만 있으면 합산한다.
    """
    challenge_stats = _unwrap(challenge_stats)
    if not challenge_stats:
        return {"completed_count": 0, "total_count": 0, "xp_earned": 0,
                "best_category": None}

    # 응답이 {summary: {...}, categories: [...]} 형태일 수도, 바로 리스트일 수도 있다
    summary = _pick(challenge_stats, ("summary", "totals", "overall"), {}) or {}
    items = _as_list(
        _pick(challenge_stats, ("categories", "by_category", "data", "items"),
              challenge_stats if isinstance(challenge_stats, list) else [])
    )

    completed = _pick(summary, K_COMPLETED)
    total = _pick(summary, K_TOTAL_COUNT)
    xp = _pick(summary, K_XP)

    # 요약이 없으면 카테고리별 값을 합산
    if completed is None:
        completed = sum(_num(_pick(i, K_COMPLETED)) for i in items)
    if total is None:
        total = sum(_num(_pick(i, K_TOTAL_COUNT)) for i in items)
    if xp is None:
        xp = sum(_num(_pick(i, K_XP)) for i in items)

    # 가장 잘 해낸 카테고리 (달성 개수 기준)
    best = None
    best_n = 0
    for i in items:
        name = _pick(i, K_CATEGORY)
        n = _num(_pick(i, K_COMPLETED))
        if name and n > best_n:
            best, best_n = name, n

    return {
        "completed_count": int(_num(completed)),
        "total_count": int(_num(total)),
        "xp_earned": int(_num(xp)),
        "best_category": best,
    }


# ============================================================
# 월간 : 사실 선별 (규칙)
# ============================================================
def extract_monthly_facts(
    monthly_report: Optional[dict],
    challenge_stats: Optional[Any] = None,
    budget_history: Optional[Any] = None,
) -> dict:
    """
    BE의 월간 집계 결과에서 총평에 쓸 사실만 골라낸다.

    월간은 주간에 없는 것(주차별 흐름, 예산 초과 시점, 예산 변경)이 핵심이다.
    daily_cumulative(일자별 누적 전체)처럼 양이 큰 값은 LLM에 넘기지 않는다.
    """
    monthly_report = _unwrap(monthly_report) or {}
    summary = _pick(monthly_report, ("monthly_summary", "summary"), {}) or {}
    _warn_if_unmapped("월간", monthly_report, summary)

    total_spent = _num(_pick(summary, K_MONTH_TOTAL))
    budget = _num(_pick(summary, K_BUDGET))
    usage_ratio = (total_spent / budget) if budget > 0 else 0.0

    # ---- 주차별 추이 (월간의 핵심) ----
    breakdown = _as_list(
        _pick(monthly_report, ("weekly_breakdown", "weeks", "by_week"), [])
    )
    weekly_amounts = [_num(_pick(w, K_WEEK_AMOUNT)) for w in breakdown]
    trend = _detect_trend(weekly_amounts)

    # ---- 예산 초과 시점 ----
    overrun_raw = _pick(monthly_report, ("category_overrun", "overrun", "overruns"), [])
    overruns = []
    for item in _as_list(overrun_raw):
        name = _pick(item, K_CATEGORY)
        date = _pick(item, K_OVERRUN_DATE)
        if name and date:   # overrun_date가 null이면 초과 안 한 것
            overruns.append({"category": name, "overrun_date": str(date)})

    # ---- 예산 변경 이력 ----
    budget_changes = []
    for item in _as_list(_unwrap(budget_history)):
        name = _pick(item, K_CATEGORY)
        before = _pick(item, K_BUDGET_BEFORE)
        after = _pick(item, K_BUDGET_AFTER)
        if name is None:
            continue
        budget_changes.append({
            "category": name,
            "before": _num(before),
            "after": _num(after),
            "changed_at": str(_pick(item, K_CHANGED_AT) or ""),
            "direction": ("증액" if _num(after) > _num(before) else "감액"),
        })

    # ---- 챌린지 성과 ----
    challenge = _summarize_challenge_stats(challenge_stats)
    xp_earned = challenge.get("xp_earned") or _num(_pick(summary, K_XP))

    return {
        "period": "monthly",
        "total_spent": total_spent,
        "budget": budget,
        "usage_ratio": usage_ratio,
        "weekly_amounts": weekly_amounts,
        "trend": trend,
        "overruns": overruns,
        "budget_changes": budget_changes,
        "challenge_completed": challenge.get("completed_count", 0),
        "challenge_total": challenge.get("total_count", 0),
        "best_category": challenge.get("best_category"),
        "xp_earned": int(_num(xp_earned)),
    }


def _detect_trend(amounts: List[float]) -> str:
    """
    주차별 소비 흐름을 한 단어로. (전반부 평균 vs 후반부 평균)
    데이터가 2주 미만이면 판단하지 않는다.
    """
    values = [a for a in amounts if a is not None]
    if len(values) < 2:
        return "판단불가"

    half = len(values) // 2
    first = values[:half] or values[:1]
    second = values[half:] or values[-1:]
    avg_first = sum(first) / len(first)
    avg_second = sum(second) / len(second)

    if avg_first <= 0:
        return "판단불가"

    ratio = (avg_second - avg_first) / avg_first
    if ratio <= -MIN_CHANGE_RATIO_TO_MENTION:
        return "후반에 줄어듦"
    if ratio >= MIN_CHANGE_RATIO_TO_MENTION:
        return "후반에 늘어남"
    return "한 달 내내 비슷"


# ============================================================
# 사실 → LLM에 넘길 요약 텍스트
# ============================================================
def _completion_label(completed: int, total: int) -> str:
    """
    챌린지 달성 수준에 대한 '판단'을 규칙이 내린다.

    LLM에게 개수만 주면 3/10도 "잘 챙겼다"고 쓰는 일이 생긴다.
    잘한 건지 아쉬운 건지는 규칙이 정해서 넘기고, LLM은 그 톤을 따르게 한다.
    """
    if total <= 0:
        return ""
    rate = completed / total
    if rate >= COMPLETION_GOOD:
        return "달성 수준: 잘 해낸 편 (칭찬해도 되는 수준)"
    if rate >= COMPLETION_FAIR:
        return "달성 수준: 보통 (과하게 칭찬하지 말 것)"
    return ("달성 수준: 낮은 편 "
        "(칭찬하지 말 것. 단 아쉽다/부족하다 같은 총괄 평가도 하지 말 것. "
        "달성한 개수는 사실대로 인정하고, 나머지는 다음 주 이야기로 넘길 것)")


def _usage_label(usage_ratio: float, budget: float) -> str:
    """예산 사용 수준에 대한 판단도 규칙이 내린다."""
    if budget <= 0:
        return ""
    if usage_ratio > USAGE_OVER:
        return "예산 평가: 초과함 (괜찮다고 옹호하지 말 것, 담담하게 짚을 것)"
    if usage_ratio >= USAGE_TIGHT:
        return "예산 평가: 거의 다 씀 (아직 초과는 아님)"
    return "예산 평가: 예산 안에서 지냄 (칭찬해도 되는 수준)"


def _weekly_fact_lines(f: dict) -> List[str]:
    """
    주간 사실을 짧은 문장 목록으로. (LLM 입력용)

    근거가 없는 항목은 아예 넣지 않는다. 빈 줄을 채우면
    LLM이 그 빈칸을 상상으로 메우기 때문(환각).
    """
    lines = []

    if f["challenge_total"] > 0:
        lines.append(f"이번 주 챌린지 {f['challenge_completed']}개 달성")
        label = _completion_label(f["challenge_completed"], f["challenge_total"])
        if label:
            lines.append(label)
    if f["xp_earned"]:
        lines.append(f"획득 XP {int(f['xp_earned'])}")

    # 소비 기록이 실제로 있을 때만 방향을 말한다
    has_spending = f["week_total"] > 0 or f["last_week_total"] > 0
    if has_spending:
        if f["spending_direction"] == "감소":
            lines.append("전체 소비가 지난주보다 줄어듦")
        elif f["spending_direction"] == "증가":
            lines.append("전체 소비가 지난주보다 늘어남")
        else:
            lines.append("전체 소비는 지난주와 비슷")

    if f["top_decrease"]:
        lines.append(f"{f['top_decrease']['category']} 지출이 지난주보다 줄어듦")
    if f["top_increase"]:
        lines.append(f"{f['top_increase']['category']} 지출이 지난주보다 늘어남")

    return lines


def _monthly_fact_lines(f: dict) -> List[str]:
    """월간 사실을 짧은 문장 목록으로. (근거 없는 항목은 제외)"""
    lines = []

    if f["challenge_total"] > 0:
        lines.append(f"이번 달 챌린지 {f['challenge_completed']}개 달성")
        label = _completion_label(f["challenge_completed"], f["challenge_total"])
        if label:
            lines.append(label)
    if f["xp_earned"]:
        lines.append(f"획득 XP {int(f['xp_earned'])}")

    if f["trend"] != "판단불가":
        lines.append(f"소비 흐름: {f['trend']}")

    if f["budget"] > 0:
        lines.append(f"이번 달 예산의 {f['usage_ratio']:.0%}를 사용")
        label = _usage_label(f["usage_ratio"], f["budget"])
        if label:
            lines.append(label)

    if f["overruns"]:
        first = f["overruns"][0]
        lines.append(f"{first['category']}는 {first['overrun_date']}에 예산을 넘김")
        if len(f["overruns"]) > 1:
            lines.append(f"예산을 넘긴 카테고리가 총 {len(f['overruns'])}개")

    if f["budget_changes"]:
        ch = f["budget_changes"][0]
        lines.append(
            f"{ch['category']} 예산을 월 중간에 {ch['direction']}함 "
            f"(사실만 언급할 것. 잘한 일인지 아닌지 평가하지 말 것)"
        )

    return lines


# 규칙이 내린 '판단' 줄. 사실 개수를 셀 때는 제외한다.
_LABEL_PREFIXES = ("달성 수준:", "예산 평가:")


def _substantive_count(lines: List[str]) -> int:
    """LLM을 부를지 판단할 때 쓰는 '실제 사실' 개수. 평가 라벨은 세지 않는다."""
    return sum(1 for l in lines if not l.startswith(_LABEL_PREFIXES))


def _lines_to_text(lines: List[str]) -> str:
    return "\n".join(f"- {l}" for l in lines)


# 이전 이름 호환 (테스트 스크립트 등에서 사용)
def _weekly_summary_text(f: dict) -> str:
    return _lines_to_text(_weekly_fact_lines(f))


def _monthly_summary_text(f: dict) -> str:
    return _lines_to_text(_monthly_fact_lines(f))


# ============================================================
# 프롬프트
# ============================================================
# 캐릭터는 챌린지 문구(llm_client)와 같은 Moni지만, 문체가 다르다.
#   챌린지 문구 = 그 순간 옆에서 건네는 제안 → 반말 구어체
#   리포트 총평 = 한 주/한 달을 정리해 보고하는 글 → 경어체(~해요체)
# 규칙 기반 폴백 문구가 이미 경어체이므로, LLM 총평도 경어체로 맞춰야
# 같은 화면에서 문체가 튀지 않는다.
PERSONA = """[너의 캐릭터: Moni]
- 사용자의 소비 습관을 함께 챙기는, 다정한 코치야
- 2030 사회초년생과 눈높이가 맞되, 사용자에게는 존댓말을 쓴다
- 여유롭고 따뜻함. 죄책감이나 압박을 절대 주지 않고, 실패해도 괜찮다는 태도
- 은은한 위트가 있음 (억지 유행어나 과한 밈은 쓰지 않는다)"""

_COMMON_RULES = """[사실 규칙 — 가장 중요]
- 아래 요약에 적힌 것만 근거로 삼을 것
- 요약에 없는 내용은 절대 지어내지 말 것
  (예: 요약에 소비 이야기가 없는데 "소비가 안정적이었어요"라고 쓰면 안 됨)
- 요약에 없는 해석이나 판단을 덧붙이지 말 것
  (예: "자연스러운 변화예요", "괜찮은 수준이에요", "충분히 잘하고 있어요"
   처럼 요약이 말하지 않은 평가를 네가 대신 내리면 안 됨)
- 요약에 "달성 수준", "예산 평가" 같은 판단이 적혀 있으면 그 판단을 따를 것.
  요약이 아쉽다고 한 것을 잘했다고 바꿔 말하면 안 됨
- 짚을 만한 내용이 적으면 짧게 끝낼 것. 억지로 늘리지 말 것

[문체 — 반드시 지킬 것]
- 존댓말 해요체로 통일 ("~했어요", "~네요", "~보여요", "~면 좋겠어요")
- 반말 금지 ("~했어", "~구나", "~네", "~자")
- 문어체 금지 ("~했다", "~로 보인다", "~이다")
- 딱딱한 격식체 금지 ("~하였습니다", "~됩니다")

[표현 규칙]
- 요약을 그대로 나열하지 말고 자연스러운 말로 녹여줄 것
- 금액, 퍼센트, 개수 같은 숫자는 문장에 넣지 말 것
- 잘한 점이 있으면 먼저 짚고, 신경 쓸 부분은 부드럽게
- 죄책감이나 훈계 금지

[피해야 할 것]
- 관계를 내세우는 격려: "언제나 응원해요", "함께 해나가요", "제가 곁에 있어요",
  "정말 멋졌어요" 같은 표현 (마무리는 [마무리] 규칙을 따를 것)
- 내용 없는 조언: "작은 절약 팁을 시도해보세요" 처럼 구체성 없는 제안
  → 구체적으로 짚을 게 없으면 차라리 말하지 말 것
- 같은 말 반복, 미사여구로 문장 늘리기
- 이모지, 따옴표"""


def _build_weekly_prompt(summary_text: str) -> str:
    return f"""{PERSONA}

이번 주를 돌아보는 총평을 사용자에게 건네줘.

[이번 주 요약]
{summary_text}

{_COMMON_RULES}

[길이 — 반드시 지킬 것]
- 최대 두 문장. 한 문장으로 끝나도 좋음
- 마지막 문장이 [마무리] 역할을 겸한다 (문장 수를 늘리지 말 것)
- 각 문장은 짧고 담백하게 (한 문장 40자 안팎)

[마무리]
- 마지막 문장은 다음 주를 향한 가벼운 한마디로 닫을 것
- 문장을 하나 더 붙이는 게 아니라, 마지막 문장을 마무리 톤으로 쓰는 것
  예: 다음 주도 이 흐름으로 가볍게 가봐요
      다음 주는 식비만 살짝 신경 써봐요
- 이번 주 결과를 다시 평가하지 말 것
  ("그래도 괜찮았어요", "충분히 잘했어요" 처럼 앞에서 짚은 것을 뒤집으면 안 됨)
- 부담을 주는 다짐 요구 금지 ("꼭 지켜봐요", "약속해요")

문구만 출력해줘."""


def _build_monthly_prompt(summary_text: str) -> str:
    return f"""{PERSONA}

이번 달 한 달을 돌아보는 총평을 사용자에게 건네줘.

[이번 달 요약]
{summary_text}

{_COMMON_RULES}

[길이 — 반드시 지킬 것]
- 최대 세 문장. 두 문장으로 끝나도 좋음
- 마지막 문장이 [마무리] 역할을 겸한다 (문장 수를 늘리지 말 것)
- 각 문장은 짧고 담백하게 (한 문장 40자 안팎)

[마무리]
- 마지막 문장은 다음 달을 향한 가벼운 한마디로 닫을 것
- 문장을 하나 더 붙이는 게 아니라, 마지막 문장을 마무리 톤으로 쓰는 것
  예: 다음 달도 이 흐름이면 좋겠어요
      다음 달은 앞쪽에서 조금 여유를 두면 좋겠어요
- 이번 달 결과를 다시 평가하지 말 것
- 예산을 넘긴 달이라면, 괜찮다고 달래는 대신 다음 달에 해볼 것을 짚어줄 것
- 부담을 주는 다짐 요구 금지

[월간 총평의 초점]
- 한 달의 흐름(초반과 후반이 어떻게 달랐는지)이 있으면 그것을 중심으로
- 예산을 넘긴 시점이나 예산을 조정한 일이 요약에 있으면, 일어난 일만
  담담하게 짚을 것. 잘한 일이라거나 어쩔 수 없었다는 식으로 감싸지 말 것

문구만 출력해줘."""


# ============================================================
# 규칙 기반 폴백 문구
# ============================================================
def _achievement_phrase(count: int, period: str, total: int = 0) -> str:
    """
    달성 개수에 맞는 표현.

    '~개나'는 실제로 잘 해냈을 때만 쓴다. 15개 중 5개인데 "5개나"라고 하면
    과한 칭찬이 되므로 달성률을 함께 본다.
    """
    if count <= 0:
        return f"{period} 소비를 돌아보셨네요."

    rate = (count / total) if total > 0 else 0.0
    if count >= 5 and rate >= COMPLETION_GOOD:
        return f"{period} 챌린지를 {count}개나 해내셨어요."
    return f"{period} 챌린지를 {count}개 달성하셨어요."


def _rule_based_weekly_comment(f: dict) -> str:
    """LLM 실패 시 사용. 선별된 사실을 템플릿에 채워 개인화는 유지한다."""
    head = _achievement_phrase(f["challenge_completed"], "이번 주", f["challenge_total"])

    if f["top_decrease"]:
        tail = f"{f['top_decrease']['category']} 지출이 줄어든 게 눈에 띄네요."
    elif f["spending_direction"] == "증가":
        tail = "다음 주는 조금만 더 여유롭게 가봐요."
    else:
        tail = "다음 주도 가볍게 이어가봐요."

    return f"{head} {tail}"


def _rule_based_monthly_comment(f: dict) -> str:
    """월간 폴백 문구."""
    head = _achievement_phrase(f["challenge_completed"], "한 달 동안", f["challenge_total"])

    over_budget = f["budget"] > 0 and f["usage_ratio"] > USAGE_OVER

    # 흐름을 판단할 근거가 없으면 흐름 이야기를 하지 않는다
    if f["trend"] == "후반에 줄어듦":
        mid = "월 후반으로 갈수록 소비를 잘 조절하셨어요."
    elif f["trend"] == "후반에 늘어남":
        # 예산을 넘긴 달에는 "괜찮아요"로 감싸지 않는다
        mid = ("월 후반에 지출이 늘었어요." if over_budget
               else "월 후반에 지출이 조금 늘었지만 괜찮아요.")
    elif f["trend"] == "한 달 내내 비슷":
        mid = "한 달 내내 꾸준한 페이스를 유지하셨어요."
    else:
        mid = ""

    # 예산을 넘긴 달에 "가볍게 이어가봐요"는 상황과 맞지 않는다
    if over_budget:
        tail = "예산은 조금 넘겼으니 다음 달은 앞쪽에서 여유를 두면 좋겠어요."
    else:
        tail = "다음 달도 가볍게 이어가봐요."

    return " ".join(part for part in (head, mid, tail) if part)


# ============================================================
# 총평 생성 (핵심 진입점)
# ============================================================
def generate_weekly_comment(
    weekly_report: Optional[dict],
    challenge_stats: Optional[Any] = None,
) -> dict:
    """
    주간 리포트 총평을 생성한다.

    Parameters
    ----------
    weekly_report : dict
        GET /reports/weekly 응답 (weekly_summary, category_comparison 포함)
    challenge_stats : dict | list
        GET /challenges/stats/by-category (이번 주 기준) 응답

    Returns
    -------
    dict {
        "comment": str,
        "comment_source": "llm" | "rule_fallback" | "rule_insufficient_data",
        "highlights": dict,
    }
    """
    facts = extract_weekly_facts(weekly_report, challenge_stats)
    lines = _weekly_fact_lines(facts)

    # 말할 사실이 너무 적으면 LLM을 부르지 않는다.
    # (빈 요약을 주면 LLM이 없는 내용을 지어내기 때문)
    if _substantive_count(lines) < MIN_FACTS_FOR_LLM:
        return {
            "comment": _rule_based_weekly_comment(facts),
            "comment_source": "rule_insufficient_data",
            "highlights": facts,
        }

    text = call_llm(
        _build_weekly_prompt(_lines_to_text(lines)),
        max_tokens=WEEKLY_MAX_TOKENS,
    )
    if text:
        return {"comment": text, "comment_source": "llm", "highlights": facts}

    return {
        "comment": _rule_based_weekly_comment(facts),
        "comment_source": "rule_fallback",
        "highlights": facts,
    }


def generate_monthly_comment(
    monthly_report: Optional[dict],
    challenge_stats: Optional[Any] = None,
    budget_history: Optional[Any] = None,
) -> dict:
    """
    월간 리포트 총평을 생성한다.

    Parameters
    ----------
    monthly_report : dict
        GET /reports/monthly 응답
        (monthly_summary, weekly_breakdown, category_overrun 포함)
    challenge_stats : dict | list
        GET /challenges/stats/by-category (이번 달 기간 지정) 응답
    budget_history : list
        GET /categories/budget-history 응답 (없으면 예산 변경 코멘트 생략)

    Returns
    -------
    dict {"comment": str, "comment_source": ..., "highlights": dict}
    """
    facts = extract_monthly_facts(monthly_report, challenge_stats, budget_history)
    lines = _monthly_fact_lines(facts)

    if _substantive_count(lines) < MIN_FACTS_FOR_LLM:
        return {
            "comment": _rule_based_monthly_comment(facts),
            "comment_source": "rule_insufficient_data",
            "highlights": facts,
        }

    text = call_llm(
        _build_monthly_prompt(_lines_to_text(lines)),
        max_tokens=MONTHLY_MAX_TOKENS,
    )
    if text:
        return {"comment": text, "comment_source": "llm", "highlights": facts}

    return {
        "comment": _rule_based_monthly_comment(facts),
        "comment_source": "rule_fallback",
        "highlights": facts,
    }


# ============================================================
# 리포트 전체 조립 (BE가 그대로 저장할 수 있는 형태)
# ============================================================
def build_weekly_report(
    weekly_report: Optional[dict],
    challenge_stats: Optional[Any] = None,
    user_id: Optional[str] = None,
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
) -> dict:
    """
    총평을 포함한 주간 리포트 dict를 조립해 반환한다.

    BE가 집계한 값은 가공하지 않고 그대로 담는다(spending / challenge).
    AI가 더하는 것은 comment(총평)와 highlights(선별된 사실)뿐이다.
    """
    result = generate_weekly_comment(weekly_report, challenge_stats)

    return {
        "user_id": user_id,
        "report_type": "weekly",
        "period_start": period_start,
        "period_end": period_end,
        "schema_version": SCHEMA_VERSION,
        "spending": weekly_report,       # BE 집계 원본
        "challenge": challenge_stats,    # BE 집계 원본
        "comment": result["comment"],
        "comment_source": result["comment_source"],
        "highlights": result["highlights"],
    }


def build_monthly_report(
    monthly_report: Optional[dict],
    challenge_stats: Optional[Any] = None,
    budget_history: Optional[Any] = None,
    user_id: Optional[str] = None,
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
) -> dict:
    """총평을 포함한 월간 리포트 dict를 조립해 반환한다."""
    result = generate_monthly_comment(monthly_report, challenge_stats, budget_history)

    return {
        "user_id": user_id,
        "report_type": "monthly",
        "period_start": period_start,
        "period_end": period_end,
        "schema_version": SCHEMA_VERSION,
        "spending": monthly_report,        # BE 집계 원본
        "challenge": challenge_stats,      # BE 집계 원본
        "budget_history": budget_history,  # BE 원본 (없으면 None)
        "comment": result["comment"],
        "comment_source": result["comment_source"],
        "highlights": result["highlights"],
    }