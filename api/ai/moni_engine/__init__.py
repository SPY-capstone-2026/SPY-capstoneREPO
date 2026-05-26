"""
Moni AI Engine
==============

소비 예측 및 데일리 챌린지 생성 엔진.

Backend integration:
    from moni_engine.engine import get_today_challenge

    result = get_today_challenge(
        transactions_df=transactions_df,
        user_profile=user_profile,
        category_settings_df=category_settings_df,
        target_date=date(2026, 5, 14),
    )
"""

from moni_engine.engine import get_today_challenges, get_today_challenge

__all__ = ["get_today_challenges", "get_today_challenge"]
__version__ = "0.2.0"
