"""
시간 헬퍼 — 챌린지 '대상 날짜'와 자정 검증은 모두 한국 시간(KST) 기준.

Render 서버는 기본 UTC라서 date.today() / datetime.now()를 그대로 쓰면
KST 00:00~09:00 사이에는 '어제' 날짜가 나온다. 챌린지 날짜 판정에 쓰는 코드는
반드시 이 모듈의 kst_today()를 사용한다.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")


def kst_now() -> datetime:
    """KST 기준 현재 시각 (timezone-aware)."""
    return datetime.now(KST)


def kst_today() -> date:
    """KST 기준 오늘 날짜."""
    return kst_now().date()


def kst_now_naive() -> datetime:
    """
    KST 기준 현재 시각 (tzinfo 제거).
    DB의 DateTime 컬럼은 timezone 없는 타입이라, 저장할 땐 KST 시계값 그대로 넣는다.
    """
    return kst_now().replace(tzinfo=None)
