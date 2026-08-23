"""
Moni 통합 시드 스크립트
=======================
기존 seed_db.py + seed_shop_items.py를 하나로 합친 파일입니다.
앞으로 시드 데이터를 수정할 땐 이 파일 하나만 고치면 됩니다.

실행:
    cd api
    source venv/bin/activate
    python seed_all.py

⚠️ 주의:
    .env의 DATABASE_URL이 가리키는 DB가 통째로 초기화(전체 삭제 후 재삽입)됩니다.
    로컬 sqlite인지 Supabase(운영)인지 실행 전에 반드시 확인하세요.
    (이 스크립트는 DB에 직접 접속해서 미리 확인해주지 않습니다 — 실행 전 Supabase
     Table Editor에서 현재 데이터를 한 번 훑어보는 걸 추천합니다.)
"""

import pandas as pd
from datetime import date, time
from sqlmodel import Session, select

from models import (
    engine,
    create_db_and_tables,
    User,
    Transaction,
    UserCategorySetting,
    Category,
    DailyChallenge,
    AIDailyFeature,
    PointTransaction,
    ShopItem,
    UserInventory,
)
from auth import hash_password

# ----------------------------------------
# 설정 (수정은 여기서)
# ----------------------------------------
# 거래 내역(수천 건)만 CSV 유지, 나머지는 규모가 작아 아래 리스트로 직접 관리합니다.
# CSV는 api/ 루트에 직접 저장되도록 변경 (generate_seed.py 출력 경로와 일치)
CSV_DIR = "."

# 비밀번호는 여기 지정한 값으로 전부 해시 생성됩니다. 로그인 테스트 시 이 비밀번호를 쓰면 됩니다.
DEFAULT_PASSWORD = "moni1234"


# 유저 시드 데이터 — 대학생 페르소나로 변경
# ⚠️ user_id는 generate_seed.py에서 거래내역을 생성할 때 쓴 USER_ID와 반드시 일치해야
#    합니다. 다르면 seed_all.py 실행 시 FK(외래키) 제약 위반 에러가 납니다.
USERS_SEED = [
    {
        "user_id": "user-office-001",  # generate_seed.py의 USER_ID와 동일한지 꼭 확인
        "email": "student@moni.app",
        "income_type": "STUDENT",
        "payday": 1,  # 용돈 받는 날 등으로 활용 (정기 수입 없으면 임의값)
        "spend_profile": "IMPULSIVE",  # 시험기간 충동소비 패턴 반영
        "valid_data_start_date": None,
        "total_xp": 0,
        "current_level": 1,
        "current_points": 0,
    },
]

# 카테고리별 예산 설정 시드 — 대학생 예산 규모로 조정, 교통 항목 추가
# ⚠️ alert_threshold는 0~1 소수(비율)가 아니라 1~100 정수(퍼센트)입니다.
CATEGORY_SETTINGS_SEED = [
    {
        "user_id": "user-office-001",
        "category_name": "카페",
        "budget_limit": 80000,
        "is_daily_challenge": True,
        "alert_threshold": 80,
    },
    {
        "user_id": "user-office-001",
        "category_name": "식비",
        "budget_limit": 300000,
        "is_daily_challenge": True,
        "alert_threshold": 90,
    },
    {
        "user_id": "user-office-001",
        "category_name": "의류",
        "budget_limit": 100000,
        "is_daily_challenge": True,
        "alert_threshold": 80,
    },
    {
        "user_id": "user-office-001",
        "category_name": "화장품",
        "budget_limit": 60000,
        "is_daily_challenge": True,
        "alert_threshold": 80,
    },
    {
        "user_id": "user-office-001",
        "category_name": "교통",
        "budget_limit": 50000,
        "is_daily_challenge": False,
        "alert_threshold": 90,
    },
]


# ----------------------------------------
# 1. 기존 데이터 전체 초기화
#    (FK 참조 관계상 자식 테이블 -> 부모 테이블 순서로 삭제해야 함)
# ----------------------------------------
def reset_all_tables(session: Session):
    tables_in_delete_order = [
        UserInventory,  # user, shopitem을 참조
        PointTransaction,  # user를 참조
        DailyChallenge,  # user를 참조
        AIDailyFeature,  # user를 참조
        Transaction,  # user를 참조
        UserCategorySetting,  # user를 참조
        ShopItem,  # 참조 없음 (UserInventory가 먼저 삭제되어야 안전)
        Category,  # 참조 없음
        User,  # 다른 테이블이 참조하는 부모 -> 반드시 마지막에 삭제
    ]

    for table in tables_in_delete_order:
        rows = session.exec(select(table)).all()
        for row in rows:
            session.delete(row)

    session.commit()
    print("🗑️  기존 데이터 전체 초기화 완료")


# ----------------------------------------
# 2. 유저 삽입 (비밀번호는 실제 해시로 생성)
# ----------------------------------------
def seed_users(session: Session):
    for item in USERS_SEED:
        user = User(
            user_id=item["user_id"],
            email=item["email"],
            password_hash=hash_password(
                DEFAULT_PASSWORD
            ),  # 더미 문자열이 아닌 실제 해시
            income_type=item.get("income_type"),
            payday=item.get("payday"),
            spend_profile=item.get("spend_profile"),
            valid_data_start_date=item.get("valid_data_start_date"),
            total_xp=item.get("total_xp", 0),
            current_level=item.get("current_level", 1),
            current_points=item.get("current_points", 0),
        )
        session.add(user)

    session.commit()
    print(f"✅ 유저 {len(USERS_SEED)}명 삽입 완료 (비밀번호: '{DEFAULT_PASSWORD}')")


# ----------------------------------------
# 3. 거래 내역 삽입
# ----------------------------------------
def seed_transactions(session: Session):
    transactions_df = pd.read_csv(f"{CSV_DIR}/seed_transactions.csv")

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
    print(f"✅ 거래 내역 {len(transactions_df)}건 삽입 완료")


# ----------------------------------------
# 4. 카테고리별 예산 설정 삽입
# ----------------------------------------
def seed_category_settings(session: Session):
    for item in CATEGORY_SETTINGS_SEED:
        cat = UserCategorySetting(
            user_id=item["user_id"],
            category_name=item["category_name"],
            budget_limit=item["budget_limit"],
            is_daily_challenge=item.get("is_daily_challenge", False),
            alert_threshold=item.get("alert_threshold", 80),
        )
        session.add(cat)

    session.commit()
    print(f"✅ 카테고리 설정 {len(CATEGORY_SETTINGS_SEED)}건 삽입 완료")


# ----------------------------------------
# 5. 카테고리 마스터 삽입
# ----------------------------------------
def seed_master_categories(session: Session):
    master_categories = [
        {
            "name": "카페",
            "icon": "coffee",
            "color": "#A0522D",
            "parent_category": "식품",
        },
        {
            "name": "식비",
            "icon": "restaurant",
            "color": "#FF6B35",
            "parent_category": "식품",
        },
        {
            "name": "의류",
            "icon": "checkroom",
            "color": "#9B59B6",
            "parent_category": "쇼핑",
        },
        {
            "name": "화장품",
            "icon": "face",
            "color": "#E91E63",
            "parent_category": "쇼핑",
        },
        {
            "name": "가전",
            "icon": "devices",
            "color": "#2196F3",
            "parent_category": "생활",
        },
        {
            "name": "교통",
            "icon": "directions_bus",
            "color": "#4CAF50",
            "parent_category": "이동",
        },
    ]

    for cat in master_categories:
        session.add(Category(**cat))

    session.commit()
    print(f"✅ 카테고리 마스터 {len(master_categories)}개 삽입 완료")


# ----------------------------------------
# 6. 상점 아이템 삽입 (구매용 + 마일스톤 전용)
#    ※ 이 부분이 seed_shop_items.py를 흡수한 부분입니다.
# ----------------------------------------
def seed_shop_items(session: Session):
    purchasable_items = [
        {"name": "리본", "category": "ACCESSORY", "price": 30, "rarity": "COMMON"},
        {
            "name": "동그란 안경",
            "category": "ACCESSORY",
            "price": 50,
            "rarity": "COMMON",
        },
        {"name": "미니 모자", "category": "ACCESSORY", "price": 80, "rarity": "COMMON"},
        {"name": "캐주얼 후드티", "category": "SKIN", "price": 150, "rarity": "COMMON"},
        {"name": "파자마 세트", "category": "SKIN", "price": 200, "rarity": "COMMON"},
        {"name": "정장 세트", "category": "SKIN", "price": 250, "rarity": "RARE"},
        {
            "name": "화분 세트",
            "category": "FURNITURE",
            "price": 180,
            "rarity": "COMMON",
        },
        {
            "name": "아늑한 소파",
            "category": "FURNITURE",
            "price": 200,
            "rarity": "COMMON",
        },
        {
            "name": "책상 & 스탠드",
            "category": "FURNITURE",
            "price": 250,
            "rarity": "COMMON",
        },
        {"name": "침대", "category": "FURNITURE", "price": 350, "rarity": "RARE"},
        {
            "name": "아침 방 배경",
            "category": "BACKGROUND",
            "price": 400,
            "rarity": "RARE",
        },
        {
            "name": "밤하늘 배경",
            "category": "BACKGROUND",
            "price": 500,
            "rarity": "RARE",
        },
        {
            "name": "카페 테마 배경",
            "category": "BACKGROUND",
            "price": 600,
            "rarity": "RARE",
        },
        {"name": "골드 정장", "category": "SKIN", "price": 1200, "rarity": "EPIC"},
        {
            "name": "우주 테마 배경",
            "category": "BACKGROUND",
            "price": 1500,
            "rarity": "EPIC",
        },
    ]

    milestone_items = [
        {"name": "첫 가구 세트", "category": "FURNITURE", "unlock_level": 5},
        {"name": "은색 왕관", "category": "ACCESSORY", "unlock_level": 10},
        {"name": "특별 커스텀 정장", "category": "SKIN", "unlock_level": 15},
        {"name": "오로라 배경", "category": "BACKGROUND", "unlock_level": 20},
    ]

    for item in purchasable_items:
        session.add(
            ShopItem(
                name=item["name"],
                category=item["category"],
                price=item["price"],
                rarity=item["rarity"],
                is_purchasable=True,
            )
        )

    for item in milestone_items:
        session.add(
            ShopItem(
                name=item["name"],
                category=item["category"],
                unlock_level=item["unlock_level"],
                is_purchasable=False,
                price=None,
            )
        )

    session.commit()
    print(
        f"✅ 상점 아이템 삽입 완료 "
        f"(구매용 {len(purchasable_items)}개 + 마일스톤 {len(milestone_items)}개)"
    )


# ----------------------------------------
# 실행
# ----------------------------------------
def run():
    create_db_and_tables()

    with Session(engine) as session:
        reset_all_tables(session)
        seed_users(session)
        seed_transactions(session)
        seed_category_settings(session)
        seed_master_categories(session)
        seed_shop_items(session)

    print("🎉 전체 시드 데이터 삽입 완료!")
    print(
        f"   로그인 테스트: USERS_SEED에 등록된 이메일 / 비밀번호 '{DEFAULT_PASSWORD}'"
    )


if __name__ == "__main__":
    run()
