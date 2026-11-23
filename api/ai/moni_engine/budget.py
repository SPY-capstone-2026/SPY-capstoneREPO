"""
budget.py
=========

다음 달 카테고리별 예산 추천.

핵심 함수:
    recommend_budgets(category_history, current_settings, challenge_stats)
        → list[dict]  (추천 결과)
    build_recommendation_text(recommendations)
        → str         (월간 리포트 마지막 줄에 붙일 문구)

설계 원칙
---------
1. **금액은 규칙이 정한다. LLM은 쓰지 않는다.**
   리포트 총평 프롬프트에서 금액·퍼센트를 의도적으로 제외한 것과 같은 이유다.
   숫자가 핵심인 기능을 LLM에 맡기면 환각 방어가 무너진다.

2. **거울이 되지 않는다.**
   "다음 달 예산 = 지난달 지출"은 지금 쓰는 만큼을 돌려주는 것일 뿐
   코칭이 아니다. 과거에 실제로 달성했던 수준을 기준으로 삼는다.

3. **데이터가 없으면 추천하지 않는다.**
   억지로 내놓은 금액은 틀리고, 한 번 틀리면 신뢰를 잃는다.

추천 방식
---------
이력 6개월 이상  → 하위 p 분위수 (p는 챌린지 달성률에 연동)
이력 3~5개월     → 중앙값 × 조정계수 (분위수가 불안정한 구간)
이력 3개월 미만  → 추천하지 않음

가드
----
- 변화폭을 현재 예산의 ±30%로 제한 (급변 방지)
- 증액 시 과거 중앙값을 넘지 않음 (실제로 쓰는 것보다 많이 추천하지 않음)
- 현재 예산보다 많이 쓰는 경우 격차를 절반씩만 좁힘
- 변화가 5% 미만이면 추천하지 않음 (의미 없는 조정 제외)
- 월별 변동이 너무 큰 카테고리는 제외 (어떤 방법으로도 못 맞춤)
"""
from __future__ import annotations

import re
from typing import Any, Iterable, List, Optional

import numpy as np

# ============================================================
# BE 응답 필드 매핑
#   BE가 어떤 이름으로 주는지 확정되지 않아, 후보를 나열해두고
#   먼저 맞는 것을 쓴다. 확정되면 이 목록만 고치면 된다.
#   (report.py의 K_* 상수와 같은 방식)
# ============================================================
K_CATEGORY = ("category_name", "categoryName", "category", "name")
K_YEAR_MONTH = ("year_month", "yearMonth", "month", "period")
K_MONTH_SPENT = ("actual_spend", "actualSpend",       # /reports/monthly 의 키
                 "total_spent", "totalSpent", "amount", "spent", "total")
K_BUDGET = ("budget_limit", "budgetLimit", "budget", "limit")

# ============================================================
# 설정값
# ============================================================
# BE는 '리포트 달을 포함한 6개월'을 보낸다(CATEGORY_HISTORY_MONTHS=6).
# 진행 중인 달을 빼면 5개월이 남으므로 기준을 5로 둔다.
# 6으로 두면 월중 조회가 전부 중앙값 경로로 내려가, 변동이 작은 카테고리에서
# 불필요하게 빡빡한 추천이 나간다 (시뮬레이션: 달성률 42.8% → 46.7%).
MIN_MONTHS_FOR_QUANTILE = 5     # 이 이상이면 분위수
MIN_MONTHS_FOR_MEDIAN = 3       # 이 미만이면 추천하지 않음

MAX_CHANGE_RATIO = 0.30         # 현재 예산 대비 변화 상한 (±30%)
MIN_CHANGE_RATIO = 0.05         # 이보다 작은 변화는 추천하지 않음
GAP_CLOSE_RATIO = 0.5           # 예산 초과 시 격차를 한 번에 메우지 않고 절반만

ALLOW_INCREASE = True           # 증액 추천 허용 여부 (팀 결정으로 끌 수 있게)

MAX_CV_FOR_RECOMMEND = 0.70     # 월별 변동계수가 이보다 크면 추천 제외
CV_HIGH_CONFIDENCE = 0.35       # 이 아래면 confidence "high"

# 챌린지 달성률 → 분위수 p
#   달성률이 높으면 더 조여도 되고, 낮으면 느슨하게 잡는다.
#   (0918 면담: "최근 6개월 성공률이 낮으면 강도를 낮춘다")
QUANTILE_HIGH_ACHIEVE = 35      # 달성률 70% 이상
QUANTILE_MID_ACHIEVE = 45       # 40~70%
QUANTILE_LOW_ACHIEVE = 55       # 40% 미만
ACHIEVE_HIGH = 0.70
ACHIEVE_LOW = 0.40

# 3~5개월 구간에서 중앙값에 곱할 계수 (분위수 대신)
MEDIAN_FACTOR_HIGH_ACHIEVE = 0.93
MEDIAN_FACTOR_MID_ACHIEVE = 0.97
MEDIAN_FACTOR_LOW_ACHIEVE = 1.00

ROUND_UNIT = 1000               # 추천 금액 반올림 단위

# 진행 중인 달을 이력에서 뺄지 여부.
#   리포트를 이번 달에 열면 이번 달 합계는 '아직 덜 쓴' 금액이다.
#   그대로 섞으면 중앙값이 실제보다 낮게 잡혀 예산을 과하게 조이게 된다.
#   지난 달 리포트를 나중에 볼 때는 그 달이 이미 끝났으므로 빼지 않는다.
DROP_IN_PROGRESS_MONTH = True
KST_OFFSET_HOURS = 9            # 서버가 UTC여도 사용자의 '이번 달'은 KST 기준

# 진행 중인 달의 리포트에서는 월 후반부터만 추천을 띄운다.
#   월 초에 "다음 달에는 이렇게 잡아보세요"는 이 달 이야기를 건너뛰는 셈이다.
#   20일이면 달의 2/3가 지나 '곧 다음 달'이 체감되고, 띄우는 기간도 열흘쯤 된다.
#   끝난 달의 리포트에는 이 제한이 걸리지 않는다.
RECOMMEND_ONLY_LATE_IN_MONTH = True
RECOMMEND_FROM_DAY = 20


# ============================================================
# 공통 헬퍼
#   report.py와 같은 역할이지만, report.py가 budget.py를 import하므로
#   순환 참조를 피하려고 여기에 따로 둔다.
# ============================================================
def _pick(data: Any, keys: Iterable[str], default=None):
    """여러 후보 키 중 먼저 존재하는 값을 꺼낸다."""
    if not isinstance(data, dict):
        return default
    for k in keys:
        if k in data and data[k] is not None:
            return data[k]
    return default


def _num(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _unwrap(response: Any) -> Any:
    """BE 응답의 {"status": "success", "data": {...}} 래핑을 벗긴다."""
    if isinstance(response, dict):
        if "data" in response and set(response.keys()) <= {
            "status", "data", "message", "code"
        }:
            return response["data"]
    return response


def _as_list(value) -> List[dict]:
    value = _unwrap(value)
    if isinstance(value, list):
        return [v for v in value if isinstance(v, dict)]
    if isinstance(value, dict):
        for key in ("items", "list", "results", "categories", "history"):
            inner = value.get(key)
            if isinstance(inner, list):
                return [v for v in inner if isinstance(v, dict)]
    return []


def _round(amount: float) -> int:
    """추천 금액은 천원 단위로 끊는다. 137,412원 같은 값은 설득력이 없다."""
    if amount <= 0:
        return 0
    return int(round(amount / ROUND_UNIT) * ROUND_UNIT)


# ============================================================
# 입력 정규화 — BE 응답 형태가 확정되면 여기만 고치면 된다
# ============================================================
def normalize_history(category_history: Any) -> dict[str, List[float]]:
    """
    BE의 카테고리별 월별 지출 이력을 {카테고리: [금액, ...]}로 바꾼다.

    기대 형태 (둘 다 처리)
      ① [{"category_name": "식비", "year_month": "2026-09", "total_spent": 152000}, ...]
      ② {"식비": [152000, 148000, ...], ...}

    금액 순서는 '오래된 것 → 최근'으로 정렬한다. year_month가 없으면
    들어온 순서를 그대로 믿는다.

    ※ BE 엔드포인트가 아직 확정되지 않았다. 응답 형태가 달라지면
      K_* 상수와 이 함수만 수정하면 나머지는 그대로 동작한다.
    """
    raw = _unwrap(category_history)

    # ② 형태: {카테고리: [금액들]}
    if isinstance(raw, dict) and raw and all(
        isinstance(v, (list, tuple)) for v in raw.values()
    ):
        return {str(k): [_num(x) for x in v] for k, v in raw.items()}

    # ① 형태: 평평한 레코드 목록
    buckets: dict[str, List[tuple]] = {}
    for row in _as_list(raw):
        name = _pick(row, K_CATEGORY)
        if not name:
            continue
        ym = str(_pick(row, K_YEAR_MONTH) or "")
        amount = _num(_pick(row, K_MONTH_SPENT))
        buckets.setdefault(str(name), []).append((ym, amount))

    out: dict[str, List[float]] = {}
    for name, rows in buckets.items():
        if all(ym for ym, _ in rows):
            rows.sort(key=lambda r: r[0])
        out[name] = [a for _, a in rows]
    return out


def _today_kst():
    """서버 타임존과 무관하게 사용자 기준(KST) 오늘."""
    from datetime import datetime, timedelta, timezone
    return datetime.now(timezone(timedelta(hours=KST_OFFSET_HOURS)))


def current_year_month() -> str:
    """오늘이 속한 달을 'YYYY-MM'으로. KST 기준."""
    now = _today_kst()
    return f"{now.year:04d}-{now.month:02d}"


def should_recommend(report_month: Any = None) -> bool:
    """
    이 리포트에 예산 추천을 띄울 때인지.

    끝난 달의 리포트에는 항상 띄운다. 데이터가 완전하고,
    "지난 달이 이랬으니 이번 달은" 이라는 맥락이 자연스럽다.

    진행 중인 달의 리포트는 월 후반부터만 띄운다. 11월 3일에 열어서
    총평은 "이번 달은 아직 소비가 많지 않네요"라고 하는데 바로 아래에
    "12월에는 이렇게 잡아보세요"가 붙으면 한 칸 건너뛴 이야기가 된다.
    이 달이 어떻게 흘러갈지도 모르는 시점이기 때문이다.

    리포트 달을 알 수 없으면 막지 않는다 (기존 동작 유지).
    """
    if not RECOMMEND_ONLY_LATE_IN_MONTH:
        return True
    ym = str(report_month or "")
    if len(ym) < 7:
        return True
    if ym[:7] != current_year_month():
        return True
    return _today_kst().day >= RECOMMEND_FROM_DAY


def drop_in_progress_month(category_history: Any) -> Any:
    """
    아직 끝나지 않은 달(= 오늘이 속한 달)의 레코드를 걸러낸다.

    year_month 가 없는 입력은 어느 달인지 알 수 없으므로 그대로 돌려준다.
    (그 경우 호출자가 완료된 달만 넘겨야 한다.)
    """
    rows = _as_list(category_history)
    if not rows:
        return category_history
    cur = current_year_month()
    kept = []
    for row in rows:
        ym = str(_pick(row, K_YEAR_MONTH) or "")
        if ym[:7] == cur:
            continue
        kept.append(row)
    # 전부 걸러졌다면 year_month 형식이 예상과 다른 것이다. 원본을 쓴다.
    return kept if kept else category_history


def history_from_monthly_reports(reports: Any) -> List[dict]:
    """
    기존 `/reports/monthly` 응답 여러 달치를 history 형태로 바꾼다.

    BE가 카테고리별 월별 집계를 한 번에 주는 수단이 없을 때 쓰는 어댑터다.
    입력은 (year_month, 월간리포트응답) 쌍의 목록이고, 응답은 전체 dict든
    data 부분이든 evaluated_categories 목록이든 다 받는다.

        history_from_monthly_reports([
            ("2026-05", resp_may), ("2026-06", resp_jun), ...
        ])
        → [{"category_name": "식비", "year_month": "2026-05",
             "total_spent": 152000}, ...]

    year_month 를 호출자가 붙여야 하는 이유: 응답 자체에는 어느 달인지가
    들어 있지 않다. 순서만 믿으면 한 달이 비었을 때 조용히 어긋난다.
    """
    # _as_list()는 dict만 남기므로 (년월, 응답) 쌍이 걸러진다. 여기서는 원본을 돈다.
    items = reports if isinstance(reports, (list, tuple)) else [reports]
    out: List[dict] = []
    for item in items:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            ym, resp = item
        else:
            ym, resp = "", item
        body = _unwrap(resp)
        cats = body
        if isinstance(body, dict):
            cats = body.get("evaluated_categories") or body.get(
                "evaluatedCategories") or []
        for row in _as_list(cats):
            name = _pick(row, K_CATEGORY)
            if not name:
                continue
            out.append({
                "category_name": str(name),
                "year_month": str(ym),
                "total_spent": _num(_pick(row, K_MONTH_SPENT)),
            })
    return out


def settings_from_monthly_report(report: Any) -> List[dict]:
    """
    `/reports/monthly` 응답 한 달치에서 현재 예산 설정을 뽑는다.

    evaluated_categories 에 budget_limit 이 함께 들어 있으므로
    예산 설정을 따로 조회할 필요가 없다. 이번 달 리포트를 넘기면 된다.
    """
    body = _unwrap(report)
    cats = body
    if isinstance(body, dict):
        cats = body.get("evaluated_categories") or body.get(
            "evaluatedCategories") or []
    out: List[dict] = []
    for row in _as_list(cats):
        name = _pick(row, K_CATEGORY)
        if not name:
            continue
        out.append({"category_name": str(name),
                    "budget_limit": _num(_pick(row, K_BUDGET))})
    return out


def normalize_settings(current_settings: Any) -> dict[str, float]:
    """현재 카테고리별 예산 설정을 {카테고리: 예산}으로."""
    out: dict[str, float] = {}
    for row in _as_list(current_settings):
        name = _pick(row, K_CATEGORY)
        if not name:
            continue
        out[str(name)] = _num(_pick(row, K_BUDGET))
    return out


def _achievement_ratio(challenge_stats: Any) -> Optional[float]:
    """챌린지 달성률. 구할 수 없으면 None (그 경우 중간 강도를 쓴다)."""
    raw = _unwrap(challenge_stats)
    rows = _as_list(raw) or ([raw] if isinstance(raw, dict) else [])
    completed = total = 0.0
    for r in rows:
        completed += _num(_pick(r, ("completed_count", "completedCount",
                                    "success_count", "completed")))
        total += _num(_pick(r, ("total_count", "totalCount",
                                "challenge_count", "total")))
    if total <= 0:
        return None
    return completed / total


# ============================================================
# 추천 본체
# ============================================================
def _strength(achieve: Optional[float]) -> tuple[int, float, str]:
    """달성률 → (분위수 p, 중앙값 계수, 강도 라벨)."""
    if achieve is None:
        return QUANTILE_MID_ACHIEVE, MEDIAN_FACTOR_MID_ACHIEVE, "보통"
    if achieve >= ACHIEVE_HIGH:
        return QUANTILE_HIGH_ACHIEVE, MEDIAN_FACTOR_HIGH_ACHIEVE, "높음"
    if achieve < ACHIEVE_LOW:
        return QUANTILE_LOW_ACHIEVE, MEDIAN_FACTOR_LOW_ACHIEVE, "낮음"
    return QUANTILE_MID_ACHIEVE, MEDIAN_FACTOR_MID_ACHIEVE, "보통"


def _apply_guards(target: float, current: float, median: float) -> tuple[float, str]:
    """
    목표 금액에 가드를 적용한다. (최종 금액, 적용된 가드 이름)

    - 현재 예산을 모르면(0) 가드 없이 그대로 쓴다.
    - 현재 예산보다 많이 쓰고 있으면 격차를 절반만 좁힌다.
      (0918 면담: "이번 달 10만원 초과면 다음 달은 10만원보다 덜 초과하게")
    - 증액은 과거 중앙값을 넘지 않는다.
      실제로 쓰는 것보다 많은 예산을 추천할 이유가 없다.
    - 어느 방향이든 현재 예산의 ±30%를 넘지 않는다.
    """
    if current <= 0:
        return target, "no_current_budget"

    note = "quantile"

    # 과거에 현재 예산보다 많이 썼다면 한 번에 맞추지 않고 절반만 간다
    if median > current and target > current:
        target = current + (target - current) * GAP_CLOSE_RATIO
        note = "gap_half"

    # 증액 천장: 과거 중앙값
    if target > current:
        if not ALLOW_INCREASE:
            return current, "increase_disabled"
        if target > median:
            target = median
            note = "capped_at_median"

    # 급변 방지
    hi = current * (1 + MAX_CHANGE_RATIO)
    lo = current * (1 - MAX_CHANGE_RATIO)
    if target > hi:
        return hi, "capped_max_change"
    if target < lo:
        return lo, "capped_max_change"
    return target, note


def recommend_budgets(
    category_history: Any,
    current_settings: Any = None,
    challenge_stats: Any = None,
) -> List[dict]:
    """
    다음 달 카테고리별 예산을 추천한다.

    Parameters
    ----------
    category_history : BE의 카테고리별 월별 지출 이력
        (엔드포인트 미확정 — normalize_history()가 흡수한다)
    current_settings : 현재 카테고리별 예산 설정
    challenge_stats : 챌린지 달성 통계 (추천 강도 조절용, 없으면 '보통')

    Returns
    -------
    list[dict]
        [{category_name, current_budget, recommended_budget, direction,
          change_ratio, reason, months_used, confidence}, ...]
        추천할 것이 없으면 빈 리스트.
    """
    if DROP_IN_PROGRESS_MONTH:
        category_history = drop_in_progress_month(category_history)
    history = normalize_history(category_history)
    budgets = normalize_settings(current_settings)
    achieve = _achievement_ratio(challenge_stats)
    p, median_factor, _ = _strength(achieve)

    out: List[dict] = []
    for name, amounts in history.items():
        values = [a for a in amounts if a is not None]
        n = len(values)
        if n < MIN_MONTHS_FOR_MEDIAN:
            continue                                  # 데이터 부족 → 추천 안 함

        arr = np.asarray(values, dtype=float)
        median = float(np.median(arr))
        if median <= 0:
            continue                                  # 사실상 안 쓰는 카테고리

        mean = float(arr.mean())
        cv = float(arr.std(ddof=0) / mean) if mean > 0 else float("inf")
        if cv > MAX_CV_FOR_RECOMMEND:
            continue                                  # 변동이 너무 커 추천 불가

        # ---- 기준 금액 ----
        if n >= MIN_MONTHS_FOR_QUANTILE:
            target = float(np.percentile(arr, p))
            basis = "quantile"
        else:
            target = median * median_factor
            basis = "median"

        current = budgets.get(name, 0.0)
        target, guard = _apply_guards(target, current, median)
        recommended = _round(target)
        if recommended <= 0:
            continue

        # ---- 의미 없는 변화는 내보내지 않는다 ----
        if current > 0:
            change = (recommended - current) / current
            if abs(change) < MIN_CHANGE_RATIO:
                continue
        else:
            change = 0.0

        out.append({
            "category_name": name,
            "current_budget": int(current),
            "recommended_budget": recommended,
            "direction": ("증액" if recommended > current else "감액")
                         if current > 0 else "신규",
            "change_ratio": round(change, 4),
            "reason": basis if guard in ("quantile", "median") else guard,
            "months_used": n,
            "confidence": "high" if cv <= CV_HIGH_CONFIDENCE else "medium",
        })

    # 변화폭이 큰 것부터 — 사용자가 먼저 봐야 할 순서
    out.sort(key=lambda r: abs(r["change_ratio"]), reverse=True)
    return out


# ============================================================
# 리포트에 붙일 문구 — 규칙 기반 (LLM 미사용)
# ============================================================
MAX_LINES_IN_REPORT = 3


def next_year_month(year_month: Any) -> str:
    """'2026-11' → '2026-12'. 형식이 다르면 빈 문자열."""
    s = str(year_month or "")
    m = re.match(r"(\d{4})-(\d{1,2})", s)
    if not m:
        return ""
    y, mo = int(m.group(1)), int(m.group(2))
    if not 1 <= mo <= 12:
        return ""
    return f"{y + 1:04d}-01" if mo == 12 else f"{y:04d}-{mo + 1:02d}"


def build_recommendation_text(
    recommendations: List[dict],
    max_items: int = MAX_LINES_IN_REPORT,
    target_month: Any = None,
) -> str:
    """
    월간 리포트 마지막에 붙일 한 문단을 만든다.

    금액은 규칙이 계산한 값을 그대로 쓴다. LLM을 거치지 않으므로
    숫자가 바뀌거나 지어내질 일이 없다.

    target_month ('YYYY-MM')를 주면 "12월에는"처럼 달을 명시한다.
    월간 리포트는 지난 달 것도 열어볼 수 있어서 "다음 달"이 기준점을 잃는다.
    8월 리포트를 11월에 열면 "다음 달"이 이미 끝난 9월을 가리킨다.
    달을 적어두면 과거 리포트는 그때 기준의 기록으로 읽힌다.
    """
    if not recommendations:
        return ""

    items = recommendations[:max_items]
    body = ", ".join(
        f"{r['category_name']} {r['recommended_budget']:,}원" for r in items
    )

    m = re.match(r"\d{4}-(\d{2})", str(target_month or ""))
    lead = f"{int(m.group(1))}월에는" if m else "다음 달에는"

    # 금액 뒤에는 항상 '원'이 오므로 조사는 '으로'로 고정된다.
    text = f"{lead} {body} 정도로 예산을 잡아보시는 건 어떨까요?"

    more = len(recommendations) - len(items)
    if more > 0:
        text += f" 다른 {more}개 카테고리도 조정해볼 만해요."
    return text
