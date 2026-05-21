import sys
sys.path.append('..')
sys.path.append('../ai')

import pandas as pd
from sqlmodel import Session
from models import engine, create_db_and_tables, User, Transaction, UserCategorySetting
from datetime import datetime, date, time

create_db_and_tables()

users_df = pd.read_csv('../ai/seed_data/seed_users.csv')
transactions_df = pd.read_csv('../ai/seed_data/seed_transactions.csv')
categories_df = pd.read_csv('../ai/seed_data/seed_category_settings.csv')

with Session(engine) as session:
    # 유저 삽입
    for _, row in users_df.iterrows():
        existing = session.get(User, row['user_id'])
        if not existing:
            user = User(
                user_id=row['user_id'],
                email=row['email'],
                password_hash="seed_hashed_password",
                income_type=row.get('income_type'),
                payday=int(row['payday']) if pd.notna(row.get('payday')) else None,
                spend_profile=row.get('spend_profile'),
                valid_data_start_date=date.fromisoformat(row['valid_data_start_date']) if pd.notna(row.get('valid_data_start_date')) else None,
                total_xp=int(row.get('total_xp', 0)),
                current_level=int(row.get('current_level', 1)),
            )
            session.add(user)
    session.commit()
    print("✅ 유저 삽입 완료")

    # 트랜잭션 삽입
    for _, row in transactions_df.iterrows():
        tx = Transaction(
            user_id=row['user_id'],
            tx_date=date.fromisoformat(str(row['tx_date'])),
            tx_time=time.fromisoformat(str(row['tx_time'])),
            amount=int(row['amount']),
            merchant_name=str(row['merchant_name']),
            mydata_category=str(row['mydata_category']),
            final_category=str(row['final_category']),
            is_user_corrected=bool(row.get('is_user_corrected', False)),
        )
        session.add(tx)
    session.commit()
    print("✅ 트랜잭션 삽입 완료")

    # 카테고리 설정 삽입
    for _, row in categories_df.iterrows():
        cat = UserCategorySetting(
            user_id=row['user_id'],
            category_name=str(row['category_name']),
            budget_limit=int(row['budget_limit']),
            is_daily_challenge=bool(row.get('is_daily_challenge', False)),
            alert_threshold=int(row.get('alert_threshold', 80)),
        )
        session.add(cat)
    session.commit()
    print("✅ 카테고리 설정 삽입 완료")

print("🎉 seed 데이터 DB 삽입 완료!")