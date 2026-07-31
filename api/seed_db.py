import pandas as pd
from sqlmodel import Session, select
from models import engine, create_db_and_tables, User, Transaction, UserCategorySetting, Category, DailyChallenge
from datetime import date, time

# 기존 데이터 전체 초기화
with Session(engine) as session:
    for t in session.exec(select(DailyChallenge)).all():
        session.delete(t)
    for t in session.exec(select(Transaction)).all():
        session.delete(t)
    for c in session.exec(select(UserCategorySetting)).all():
        session.delete(c)
    for c in session.exec(select(Category)).all():
        session.delete(c)
    for u in session.exec(select(User)).all():
        session.delete(u)
    session.commit()
    print("🗑️ 기존 데이터 초기화 완료")

create_db_and_tables()

users_df = pd.read_csv("ai/seed_data/seed_users.csv")
transactions_df = pd.read_csv("ai/seed_data/seed_transactions.csv")
categories_df = pd.read_csv("ai/seed_data/seed_category_settings.csv")

with Session(engine) as session:
    # 유저 삽입
    for _, row in users_df.iterrows():
        user = User(
            user_id=row["user_id"],
            email=row["email"],
            password_hash="seed_hashed_password",
            income_type=row.get("income_type"),
            payday=int(row["payday"]) if pd.notna(row.get("payday")) else None,
            spend_profile=row.get("spend_profile"),
            valid_data_start_date=(
                date.fromisoformat(row["valid_data_start_date"])
                if pd.notna(row.get("valid_data_start_date"))
                else None
            ),
            total_xp=int(row.get("total_xp", 0)),
            current_level=int(row.get("current_level", 1)),
        )
        session.add(user)
    session.commit()
    print("✅ 유저 삽입 완료")

    # 트랜잭션 삽입
    for _, row in transactions_df.iterrows():
        tx = Transaction(
            user_id=row["user_id"],
            tx_date=date.fromisoformat(str(row["tx_date"])),
            tx_time=time.fromisoformat(str(row["tx_time"])),
            amount=int(row["amount"]),
            merchant_name=str(row["merchant_name"]),
            mydata_category=str(row["mydata_category"]),
            final_category=str(row["final_category"]),
            is_user_corrected=bool(row.get("is_user_corrected", False)),
        )
        session.add(tx)
    session.commit()
    print("✅ 트랜잭션 삽입 완료")

    # 카테고리 설정 삽입
    for _, row in categories_df.iterrows():
        cat = UserCategorySetting(
            user_id=row["user_id"],
            category_name=str(row["category_name"]),
            budget_limit=int(row["budget_limit"]),
            is_daily_challenge=bool(row.get("is_daily_challenge", False)),
            alert_threshold=int(row.get("alert_threshold", 80)),
        )
        session.add(cat)
    session.commit()
    print("✅ 카테고리 설정 삽입 완료")

    # 카테고리 마스터 삽입
    master_categories = [
        {"name": "카페", "icon": "coffee", "color": "#A0522D", "parent_category": "식품"},
        {"name": "식비", "icon": "restaurant", "color": "#FF6B35", "parent_category": "식품"},
        {"name": "의류", "icon": "checkroom", "color": "#9B59B6", "parent_category": "쇼핑"},
        {"name": "화장품", "icon": "face", "color": "#E91E63", "parent_category": "쇼핑"},
        {"name": "가전", "icon": "devices", "color": "#2196F3", "parent_category": "생활"},
        {"name": "교통", "icon": "directions_bus", "color": "#4CAF50", "parent_category": "이동"},
    ]
    for cat in master_categories:
        session.add(Category(**cat))
    session.commit()
    print("✅ 카테고리 마스터 삽입 완료")

print("🎉 seed 데이터 DB 삽입 완료!")