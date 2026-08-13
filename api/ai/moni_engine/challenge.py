"""
challenge.py
============

예측값 + 압박도 + 예산 상황 → 챌린지 dict 생성.

이 모듈은 카테고리에 무관하게 동작해야 한다.
"카페", "식비" 같은 특정 카테고리명을 하드코딩하지 않는다.

설계 (v2 - 감축률 기반)
------------------------
- 오늘 한도 = predicted_today × 최종 감축률
- 최종 감축률 = min(압박도 감축률, 예산 감축률)
    · 압박도 감축률: 압박도 유형별 기본 조임 강도 (상한선)
    · 예산 감축률 : 남은 예산 ÷ 남은 기간 예상 소비 (예산 방어선)
- 유형 / XP / 문구 톤은 모두 "최종 감축률" 구간으로 결정 (일관성)
- 한도가 MIN_LIMIT 미만이거나 예산 초과 → 금지형 처리

핵심 함수:
    generate_challenge(...)  → 챌린지 dict (LLM 문구는 engine에서 별도 주입)
"""

from __future__ import annotations

from typing import Optional


# ------------------------------------------------------------
# 감축률 → 유형/난이도/XP 구간
# (low_inclusive, high_exclusive, challenge_type, difficulty, xp_reward)
# 주의: 감축률은 "높을수록 덜 조임". 압박도와 방향이 반대다.
#   감축률 1.0 = 평소만큼 써도 됨(유지형)
#   감축률 0.0 = 지출 없음(금지형)
# ------------------------------------------------------------
REDUCTION_TIERS = [
    (0.8, float("inf"), "유지형",      "Easy",        10),
    (0.55, 0.8,         "제한형",      "Medium",      20),
    (0.3, 0.55,         "강한 제한형", "Medium-Hard", 25),
    (0.0, 0.3,          "금지형",      "Hard",        30),
]

# 압박도 유형별 기본 감축률 (상한선 역할)
# 압박도가 높을수록 더 많이 조인다 (감축률이 작아진다).
PRESSURE_TIERS = [
    (0.0, 0.8,          1.0),   # 유지형 수준 - 평소만큼
    (0.8, 1.1,          0.7),   # 제한형
    (1.1, 1.5,          0.4),   # 강한 제한형
    (1.5, float("inf"), 0.0),   # 금지형
]

# 최소 한도 (원). 이 값 미만이면 금지형으로 전환.
MIN_LIMIT = 2000
# 한도 반올림 단위 (원)
LIMIT_ROUND_UNIT = 500

# Streak 보너스 챌린지 설정
STREAK_MIN_DAYS = 2
STREAK_BASE_XP = 15
STREAK_XP_PER_DAY = 5
STREAK_XP_MAX = 60
STREAK_MIN_NONZERO_RATIO = 0.4


# ------------------------------------------------------------
# 감축률 계산
# ------------------------------------------------------------
def _pressure_reduction(budget_pressure: float) -> float:
    """압박도 → 기본 감축률 (상한선)."""
    for low, high, reduction in PRESSURE_TIERS:
        if low <= budget_pressure < high:
            return reduction
    return 0.0


def _budget_reduction(
    predicted_remaining_spend: float,
    month_to_date_actual: float,
    budget_limit: float,
) -> Optional[float]:
    """
    예산 감축률 = 남은 예산 ÷ 남은 기간 예상 소비.

    Returns
    -------
    float  : 예산 방어에 필요한 감축률 (0~1로 clip)
    None   : 이미 예산 초과 (남은 예산 <= 0) → 호출부에서 금지형 처리
    """
    remaining_budget = budget_limit - month_to_date_actual
    if remaining_budget <= 0:
        return None  # 예산 초과
    if predicted_remaining_spend <= 0:
        # 남은 기간 예측 소비가 0이면 조일 필요 없음
        return 1.0
    ratio = remaining_budget / predicted_remaining_spend
    # 감축률은 상한 1.0 (예산이 남아돌아도 평소보다 더 쓰라고 하지 않음)
    return min(1.0, ratio)


def _select_reduction_tier(reduction: float):
    """최종 감축률 → (유형, 난이도, XP)."""
    for low, high, ctype, diff, xp in REDUCTION_TIERS:
        if low <= reduction < high:
            return ctype, diff, xp
    # 안전망: 가장 강한 유형
    return REDUCTION_TIERS[-1][2:]


def _round_limit(x: float) -> int:
    """한도를 LIMIT_ROUND_UNIT 단위로 반올림."""
    return int(round(x / LIMIT_ROUND_UNIT) * LIMIT_ROUND_UNIT)


def compute_daily_limit(
    predicted_today: float,
    budget_pressure: float,
    predicted_remaining_spend: float,
    month_to_date_actual: float,
    budget_limit: float,
) -> dict:
    """
    오늘의 챌린지 한도 + 유형/XP를 감축률 기반으로 계산한다.

    Returns
    -------
    dict {
        "challenge_type": str,
        "difficulty": str,
        "xp_reward": int,
        "daily_limit": int,          # 0이면 금지형
        "pressure_reduction": float,
        "budget_reduction": float | None,
        "final_reduction": float,
        "limit_source": str,         # "normal" | "min_limit_banned" | "budget_over"
    }
    """
    p_reduction = _pressure_reduction(budget_pressure)
    b_reduction = _budget_reduction(
        predicted_remaining_spend, month_to_date_actual, budget_limit
    )

    # ---- 예산 초과: 무조건 금지형 ----
    if b_reduction is None:
        ctype, diff, xp = _select_reduction_tier(0.0)
        return {
            "challenge_type": ctype,
            "difficulty": diff,
            "xp_reward": xp,
            "daily_limit": 0,
            "pressure_reduction": p_reduction,
            "budget_reduction": None,
            "final_reduction": 0.0,
            "limit_source": "budget_over",
        }

    # ---- 최종 감축률 = 더 빡센(작은) 쪽 ----
    final_reduction = min(p_reduction, b_reduction)

    # ---- 한도 계산 ----
    raw_limit = predicted_today * final_reduction
    daily_limit = _round_limit(raw_limit)

    # ---- 최소 한도 미만 → 금지형 전환 ----
    if final_reduction > 0 and daily_limit < MIN_LIMIT:
        ctype, diff, xp = _select_reduction_tier(0.0)
        return {
            "challenge_type": ctype,
            "difficulty": diff,
            "xp_reward": xp,
            "daily_limit": 0,
            "pressure_reduction": p_reduction,
            "budget_reduction": b_reduction,
            "final_reduction": final_reduction,
            "limit_source": "min_limit_banned",
        }

    # ---- 정상 ----
    ctype, diff, xp = _select_reduction_tier(final_reduction)
    return {
        "challenge_type": ctype,
        "difficulty": diff,
        "xp_reward": xp,
        "daily_limit": daily_limit,
        "pressure_reduction": p_reduction,
        "budget_reduction": b_reduction,
        "final_reduction": final_reduction,
        "limit_source": "normal",
    }


# ------------------------------------------------------------
# 맥락 라벨 (LLM 프롬프트용 한 줄 힌트)
# ------------------------------------------------------------
def build_context_label(
    predicted_today: float,
    recent_daily_avg: float,
    no_spend_streak: int,
    month_progress_ratio: float,
    budget_pressure: float,
) -> str:
    """
    이미 계산된 값들을 규칙으로 해석해 짧은 맥락 라벨을 만든다.
    LLM이 시계열을 해석하는 게 아니라, 규칙이 해석해 한 줄로 넘긴다.
    """
    if no_spend_streak >= 3:
        return f"{no_spend_streak}일째 지출이 없는 중"
    if recent_daily_avg > 0 and predicted_today > recent_daily_avg * 1.3:
        return "평소보다 소비가 많은 날로 예상됨"
    if recent_daily_avg > 0 and predicted_today < recent_daily_avg * 0.7:
        return "평소보다 여유로운 날"
    if month_progress_ratio > 0.7 and budget_pressure > 1.2:
        return "월말이라 예산 관리가 필요한 시점"
    return "평소와 비슷한 날"


# ------------------------------------------------------------
# 규칙 기반 폴백 문구 (LLM 실패 시)
# ------------------------------------------------------------
def rule_based_text(category_name: str, challenge_type: str, daily_limit: int) -> str:
    """LLM 호출 실패 시 사용하는 기본 문구."""
    if challenge_type == "금지형" or daily_limit <= 0:
        return f"오늘은 {category_name} 지출 없이 하루를 보내보세요."
    return f"오늘은 {category_name} 지출을 {daily_limit:,}원 이하로 유지해보세요."


def _build_reason(
    category_name: str,
    predicted_monthly_spend: float,
    budget_limit: float,
    budget_pressure: float,
    final_reduction: float,
    daily_limit: int,
) -> str:
    """챌린지 생성 이유 (디버깅/기록용)."""
    pct = budget_pressure * 100
    return (
        f"예상 월 {category_name} 지출 {int(predicted_monthly_spend):,}원이 "
        f"월 예산 {int(budget_limit):,}원 대비 {pct:.1f}% 수준. "
        f"최종 감축률 {final_reduction:.2f} 적용, 오늘 한도 {daily_limit:,}원."
    )


def generate_challenge(
    category_name: str,
    budget_limit: float,
    predicted_monthly_spend: float,
    budget_pressure: float,
    predicted_today: float,
    predicted_remaining_spend: float,
    month_to_date_actual: float,
    month_progress_ratio: Optional[float] = None,
) -> dict:
    """
    감축률 기반 챌린지 생성 (문구 제외).

    문구(challenge_text)는 여기서 넣지 않는다.
    engine에서 LLM 모듈을 호출해 주입하며, 실패 시 rule_based_text로 폴백한다.
    """
    calc = compute_daily_limit(
        predicted_today=predicted_today,
        budget_pressure=budget_pressure,
        predicted_remaining_spend=predicted_remaining_spend,
        month_to_date_actual=month_to_date_actual,
        budget_limit=budget_limit,
    )

    reason = _build_reason(
        category_name=category_name,
        predicted_monthly_spend=predicted_monthly_spend,
        budget_limit=budget_limit,
        budget_pressure=budget_pressure,
        final_reduction=calc["final_reduction"],
        daily_limit=calc["daily_limit"],
    )

    return {**calc, "reason": reason}


# ------------------------------------------------------------
# Streak 보너스 챌린지 (기존 유지)
# ------------------------------------------------------------
def streak_qualifies(streak_count: int, nonzero_ratio: float) -> bool:
    """streak 보너스 챌린지 자격 판단."""
    return (
        streak_count >= STREAK_MIN_DAYS
        and nonzero_ratio >= STREAK_MIN_NONZERO_RATIO
    )


def _streak_xp(streak_count: int) -> int:
    xp = STREAK_BASE_XP + streak_count * STREAK_XP_PER_DAY
    return min(xp, STREAK_XP_MAX)


def generate_streak_challenge(category_name: str, streak_count: int) -> dict:
    """무지출 streak 보너스 챌린지 생성. (한도 개념 없음, 기존 유지)"""
    xp = _streak_xp(streak_count)
    next_day = streak_count + 1
    return {
        "challenge_type": "streak형",
        "challenge_text": (
            f"{category_name} 무지출 {streak_count}일 연속 중! "
            f"오늘도 이어가서 {next_day}일째 달성해볼까요?"
        ),
        "difficulty": "Special",
        "xp_reward": xp,
        "reason": (
            f"{category_name} {streak_count}일 연속 무지출을 이어가는 중입니다. "
            f"오늘 성공 시 {next_day}일 연속 달성, 보너스 {xp} XP를 받을 수 있습니다."
        ),
    }
