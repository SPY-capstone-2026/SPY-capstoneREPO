"""
llm_client.py
=============

챌린지 문구를 LLM(GPT)으로 생성하는 모듈.

책임:
- 규칙이 정한 한도/유형/맥락을 받아 자연스러운 문구 생성
- 호출 실패/타임아웃 시 규칙 기반 문구로 폴백
- 테스트 시 LLM 호출을 건너뛰는 모드 지원 (MONI_SKIP_LLM=1)

금액 계산은 하지 않는다. 이미 정해진 한도를 "표현"만 한다.

환경변수:
    OPENAI_API_KEY : GPT API 키 (필수, 없으면 폴백)
    MONI_SKIP_LLM  : "1"이면 LLM 호출 건너뛰고 폴백 (테스트용)
    MONI_LLM_MODEL : 사용할 모델 (기본 gpt-4.1-mini)
"""

from __future__ import annotations

import os

from moni_engine.challenge import rule_based_text


# 기본 모델 (환경변수로 덮어쓸 수 있음)
DEFAULT_MODEL = "gpt-4.1-mini"
# 호출 타임아웃 (초)
REQUEST_TIMEOUT = 10
# 생성 문구 최대 토큰
MAX_TOKENS = 100


# ------------------------------------------------------------
# 프롬프트 (임시본 - 추후 튜닝 예정)
# ------------------------------------------------------------
def _build_prompt(
    category_name: str,
    challenge_type: str,
    daily_limit: int,
    context_label: str,
) -> str:
    """LLM에 넘길 프롬프트. 금액 계산은 시키지 않고 표현만 요청."""
    if challenge_type == "금지형" or daily_limit <= 0:
        goal = f"오늘은 {category_name}에 지출하지 않는 것이 목표야"
        limit_rule = "- 지출 금액을 언급하지 말고, 오늘은 쉬어가자는 뉘앙스로 (0원이라는 표현은 쓰지 말 것)"
    else:
        goal = f"오늘 {category_name} 지출 한도는 {daily_limit:,}원이야"
        limit_rule = f"- 정해진 한도 금액({daily_limit:,}원)을 문장에 자연스럽게 포함할 것"

    return f'''너는 사용자의 소비 습관을 함께 응원하는 다정한 친구 같은 코치야.
오늘 실천할 작은 제안을 한 문장으로 건네줘.
네가 제안하는 문장은 오늘 사용자가 수행할 챌린지의 형태로 제공될 것이란 점을 고려해줘.

[오늘의 목표]
{goal}

[맥락]
- {context_label}

[말투 규칙]
- 친구가 편하게 건네는 말처럼 자연스럽게
- 명령("~하세요", "~해야 해")이 아니라 제안하는 어투로
{limit_rule}
- 예산 총액이나 퍼센트 같은 다른 숫자는 넣지 말 것
- 죄책감이나 압박을 주지 말 것. 실패해도 괜찮다는 여유로운 톤
- 이모지, 따옴표 없이. 한 문장. 25자 안팎

[이런 건 피해줘]
- 명령조 (~하세요, ~해야 한다)
- 숫자 나열식 (예산 10만원 중 7만원을 썼으니...)
- 죄책감 유발 (또 과소비하셨네요)

문구만 출력해줘.'''


# ------------------------------------------------------------
# 문구 생성 (핵심 진입점)
# ------------------------------------------------------------
def generate_challenge_text(
    category_name: str,
    challenge_type: str,
    daily_limit: int,
    context_label: str,
) -> dict:
    """
    챌린지 문구를 생성한다.

    Returns
    -------
    dict {
        "challenge_text": str,
        "text_source": "llm" | "rule_fallback",
    }
    """
    fallback = {
        "challenge_text": rule_based_text(category_name, challenge_type, daily_limit),
        "text_source": "rule_fallback",
    }

    # 테스트 모드: LLM 건너뛰고 폴백
    if os.getenv("MONI_SKIP_LLM") == "1":
        return fallback

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return fallback

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, timeout=REQUEST_TIMEOUT)
        model = os.getenv("MONI_LLM_MODEL", DEFAULT_MODEL)
        prompt = _build_prompt(category_name, challenge_type, daily_limit, context_label)

        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=MAX_TOKENS,
            temperature=0.8,
        )
        text = resp.choices[0].message.content.strip()

        # 빈 응답 방어
        if not text:
            return fallback

        return {"challenge_text": text, "text_source": "llm"}

    except Exception:
        # 네트워크/인증/타임아웃 등 모든 실패 → 폴백
        return fallback
