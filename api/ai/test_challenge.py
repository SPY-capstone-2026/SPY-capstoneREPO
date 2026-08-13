# test_challenge.py
import pandas as pd
from datetime import date
from moni_engine.engine import get_today_challenges

# seed 데이터 경로는 네 프로젝트에 맞게 수정
tx = pd.read_csv("seed_data/seed_transactions.csv")
users = pd.read_csv("seed_data/seed_users.csv")
cats = pd.read_csv("seed_data/seed_category_settings.csv")
up = users.iloc[0].to_dict()

results = get_today_challenges(tx, up, cats, date(2025, 11, 15))

print(f"생성된 챌린지: {len(results)}개\n")
for c in results:
    m = c["ai_metadata"]
    print(f"[{c['category_name']}] {c['challenge_type']} | XP {c['xp_reward']}")
    print(f"  문구: {c['challenge_text']}")
    print(f"  한도: {m.get('daily_limit'):,}원 | 문구출처: {m.get('text_source')}")
    print(f"  limit_source: {m.get('limit_source')}")
    print()