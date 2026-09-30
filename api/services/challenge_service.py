from datetime import date, datetime


def make_fallback_challenge(user_id: str, target_date: date):
    return {
        "user_id": user_id,
        "category_name": "카페",
        "challenge_date": target_date,
        "challenge_type": "제한형",
        "challenge_text": "오늘은 카페 지출을 한 번만 줄여보세요.",
        "difficulty": "Easy",
        "status": "PENDING",
        "xp_reward": 10,
        "ai_metadata": {
            "model_version": "fallback-v1",
            "generated_at": datetime.now().isoformat(),
            "budget_limit": 30000,
            "month_to_date_actual": 0,
            "predicted_remaining_spend": 0,
            "predicted_monthly_spend": 0,
            "budget_pressure": 1,
            "evaluated_categories": [
                {
                    "category_name": "카페",
                    "budget_pressure": 1,
                    "budget_limit": 30000,
                    "predicted_monthly_spend": 0,
                    "rank": 1,
                }
            ],
        },
    }
