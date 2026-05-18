"""
challenge.py
============

예산 압박도 + 카테고리명 → 챌린지 dict 생성.

이 모듈은 카테고리에 무관하게 동작해야 한다.
"카페", "식비" 같은 특정 카테고리명을 하드코딩하지 않는다.

핵심 함수:
    generate_challenge(category_name, budget_limit, predicted_monthly_spend,
                       budget_pressure, ...)
        → 챌린지 dict
"""

from __future__ import annotations

from typing import Optional


# 압박도 구간별 챌린지 정책
# (low_inclusive, high_exclusive, challenge_type, difficulty, xp_reward)
PRESSURE_TIERS = [
    (0.0, 0.8,     "유지형",       "Easy",        12),
    (0.8, 1.1,     "제한형",       "Medium",      20),
    (1.1, 1.5,     "강한 제한형",  "Medium-Hard", 25),
    (1.5, float("inf"), "금지형",  "Hard",        30),
]


def _select_tier(pressure: float):
    for low, high, ctype, diff, xp in PRESSURE_TIERS:
        if low <= pressure < high:
            return ctype, diff, xp
    # 안전망 (도달 안 함)
    return PRESSURE_TIERS[-1][2:]


def _format_challenge_text(
    category_name: str,
    challenge_type: str,
    budget_limit: float,
    days_remaining: Optional[int] = None,
    month_progress_ratio: Optional[float] = None,
) -> str:
    """
    챌린지 유형에 따라 카테고리명 변수 기반 문구 생성.

    일일 한도 계산:
        challenge_type별로 (월 예산 / 30일)을 기준으로 적정 일 한도 환산.
        예산이 작은 카테고리에서도 의미 있는 금액이 되도록 minimum 보장.
    """
    # 월 예산 → 일 예산 환산 (대략 30일 기준)
    daily_baseline = budget_limit / 30

    # 500원 단위 반올림 + 최소 500원 보장
    def round_amount(x):
        rounded = int(round(x / 500) * 500)
        return max(500, rounded)

    if challenge_type == "금지형":
        return f"오늘은 {category_name} 지출 없이 하루를 보내보세요."

    elif challenge_type == "강한 제한형":
        limit = round_amount(daily_baseline * 0.3)
        return f"오늘은 {category_name} 지출을 {limit:,}원 이하로 유지해보세요."

    elif challenge_type == "제한형":
        limit = round_amount(daily_baseline * 0.6)
        return f"오늘은 {category_name} 지출을 {limit:,}원 이하로 유지해보세요."

    else:  # 유지형
        limit = round_amount(daily_baseline)
        return f"오늘은 {category_name} 지출을 {limit:,}원 이하로 가볍게 유지해보세요."


def _build_reason(
    category_name: str,
    predicted_monthly_spend: float,
    budget_limit: float,
    budget_pressure: float,
    month_progress_ratio: Optional[float],
) -> str:
    """챌린지 생성 이유 (디버깅/UI용)."""
    pct = budget_pressure * 100
    base = (
        f"예상 월 {category_name} 지출 {int(predicted_monthly_spend):,}원이 "
        f"월 예산 {int(budget_limit):,}원 대비 {pct:.1f}% 수준입니다."
    )
    if month_progress_ratio is not None:
        if month_progress_ratio < 0.3 and budget_pressure >= 1.1:
            base += " 월초임에도 이미 예산을 초과할 페이스입니다."
        elif month_progress_ratio > 0.7 and budget_pressure >= 1.1:
            base += " 월말이 가까워 조정이 필요합니다."
    return base


def generate_challenge(
    category_name: str,
    budget_limit: float,
    predicted_monthly_spend: float,
    budget_pressure: float,
    month_progress_ratio: Optional[float] = None,
) -> dict:
    """
    예산 압박도 기반 챌린지 생성.

    Parameters
    ----------
    category_name : str
        챌린지 대상 카테고리 (예: "카페", "식비", "쇼핑")
    budget_limit : float
        User_Category_Settings.budget_limit
    predicted_monthly_spend : float
        prediction.predict_monthly_spend()의 결과
    budget_pressure : float
        prediction.calculate_budget_pressure()의 결과
    month_progress_ratio : float | None
        이번 달이 얼마나 진행됐는지 (0.0~1.0). 문구 톤 조정용.

    Returns
    -------
    dict
        {
            "challenge_type": str,
            "challenge_text": str,
            "difficulty": str,
            "xp_reward": int,
            "reason": str,
        }
    """
    challenge_type, difficulty, xp_reward = _select_tier(budget_pressure)

    challenge_text = _format_challenge_text(
        category_name=category_name,
        challenge_type=challenge_type,
        budget_limit=budget_limit,
        month_progress_ratio=month_progress_ratio,
    )

    reason = _build_reason(
        category_name=category_name,
        predicted_monthly_spend=predicted_monthly_spend,
        budget_limit=budget_limit,
        budget_pressure=budget_pressure,
        month_progress_ratio=month_progress_ratio,
    )

    return {
        "challenge_type": challenge_type,
        "challenge_text": challenge_text,
        "difficulty": difficulty,
        "xp_reward": xp_reward,
        "reason": reason,
    }
