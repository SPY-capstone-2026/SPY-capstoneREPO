from sqlmodel import Session, select

from models import ShopItem, engine


PURCHASABLE_ITEMS = [
    # CHARACTER
    {"name": "민트 컬러", "category": "CHARACTER", "price": 30, "rarity": "COMMON"},
    {"name": "코랄 컬러", "category": "CHARACTER", "price": 30, "rarity": "COMMON"},
    {"name": "딥블루 컬러", "category": "CHARACTER", "price": 30, "rarity": "COMMON"},
    {"name": "골드 컬러", "category": "CHARACTER", "price": 500, "rarity": "EPIC"},

    # ACCESSORY
    {"name": "리본", "category": "ACCESSORY", "price": 30, "rarity": "COMMON"},
    {"name": "머리핀", "category": "ACCESSORY", "price": 30, "rarity": "COMMON"},
    {"name": "미니 모자", "category": "ACCESSORY", "price": 60, "rarity": "COMMON"},
    {"name": "왕관", "category": "ACCESSORY", "price": 90, "rarity": "RARE"},
    {"name": "체크 스카프", "category": "ACCESSORY", "price": 55, "rarity": "COMMON"},
    {"name": "별 목걸이", "category": "ACCESSORY", "price": 80, "rarity": "RARE"},
    {"name": "토끼 머리띠", "category": "ACCESSORY", "price": 95, "rarity": "RARE"},

    # WALLPAPER
    {"name": "베이지 무지 벽지", "category": "WALLPAPER", "price": 40, "rarity": "COMMON"},
    {"name": "스트라이프 벽지", "category": "WALLPAPER", "price": 70, "rarity": "COMMON"},
    {"name": "우드패널 벽지", "category": "WALLPAPER", "price": 130, "rarity": "RARE"},
    {"name": "플로럴 벽지", "category": "WALLPAPER", "price": 160, "rarity": "RARE"},
    {"name": "갤럭시 벽지", "category": "WALLPAPER", "price": 900, "rarity": "EPIC"},
    {"name": "도트 벽지", "category": "WALLPAPER", "price": 90, "rarity": "COMMON"},
    {"name": "구름 벽지", "category": "WALLPAPER", "price": 150, "rarity": "RARE"},

    # FLOORING
    {"name": "원목 바닥", "category": "FLOORING", "price": 40, "rarity": "COMMON"},
    {"name": "타일 바닥", "category": "FLOORING", "price": 60, "rarity": "COMMON"},
    {"name": "카펫 바닥", "category": "FLOORING", "price": 100, "rarity": "RARE"},
    {"name": "대리석 바닥", "category": "FLOORING", "price": 180, "rarity": "RARE"},
    {"name": "체커 바닥", "category": "FLOORING", "price": 120, "rarity": "RARE"},

    # FURNITURE
    {"name": "화분", "category": "FURNITURE", "price": 50, "rarity": "COMMON"},
    {"name": "스탠드 조명", "category": "FURNITURE", "price": 70, "rarity": "COMMON"},
    {"name": "책장", "category": "FURNITURE", "price": 140, "rarity": "COMMON"},
    {"name": "소파", "category": "FURNITURE", "price": 190, "rarity": "RARE"},
    {"name": "책상 & 의자 세트", "category": "FURNITURE", "price": 230, "rarity": "RARE"},
    {"name": "침대", "category": "FURNITURE", "price": 300, "rarity": "RARE"},
    {"name": "골드 프레임 침대", "category": "FURNITURE", "price": 1000, "rarity": "EPIC"},
    {"name": "낮은 테이블", "category": "FURNITURE", "price": 120, "rarity": "COMMON"},
    {"name": "쿠션 의자", "category": "FURNITURE", "price": 150, "rarity": "RARE"},

    # DECOR
    {"name": "액자", "category": "DECOR", "price": 25, "rarity": "COMMON"},
    {"name": "캔들", "category": "DECOR", "price": 25, "rarity": "COMMON"},
    {"name": "쿠션 세트", "category": "DECOR", "price": 50, "rarity": "COMMON"},
    {"name": "벽시계", "category": "DECOR", "price": 60, "rarity": "COMMON"},
    {"name": "미니 어항", "category": "DECOR", "price": 110, "rarity": "RARE"},
    {"name": "별 조명", "category": "DECOR", "price": 75, "rarity": "COMMON"},
    {"name": "책 더미", "category": "DECOR", "price": 45, "rarity": "COMMON"},

    # THEME
    {"name": "카페 감성 풀세트", "category": "THEME", "price": 1200, "rarity": "EPIC"},
    {"name": "우주 테마 풀세트", "category": "THEME", "price": 1500, "rarity": "EPIC"},
]

OBSOLETE_ITEM_NAMES = {
    "동그란 안경",
}

MILESTONE_ITEMS = [
    {"name": "첫 화분", "category": "FURNITURE", "unlock_level": 5},
    {"name": "스페셜 벽지 조각", "category": "WALLPAPER", "unlock_level": 10},
    {"name": "스페셜 바닥재 조각", "category": "FLOORING", "unlock_level": 15},
    {"name": "프리미엄 소파", "category": "FURNITURE", "unlock_level": 20},
]


def seed_shop_items(session: Session):
    existing = {
        item.name: item
        for item in session.exec(select(ShopItem)).all()
    }

    added = 0

    # 이미 로컬/개발 DB에 들어간 삭제 대상 상품은 관계 데이터 보존을 위해
    # 행을 지우지 않고 비활성화합니다.
    for name in OBSOLETE_ITEM_NAMES:
        obsolete = existing.get(name)
        if obsolete is not None and hasattr(obsolete, "is_active"):
            obsolete.is_active = False

    for item in PURCHASABLE_ITEMS:
        if item["name"] in existing:
            continue

        session.add(
            ShopItem(
                name=item["name"],
                category=item["category"],
                price=item["price"],
                rarity=item["rarity"],
                is_purchasable=True,
            )
        )
        added += 1

    for item in MILESTONE_ITEMS:
        if item["name"] in existing:
            continue

        session.add(
            ShopItem(
                name=item["name"],
                category=item["category"],
                unlock_level=item["unlock_level"],
                is_purchasable=False,
                price=None,
            )
        )
        added += 1

    session.commit()
    return added


if __name__ == "__main__":
    with Session(engine) as session:
        added = seed_shop_items(session)

    print(f"Shop seed complete: {added} item(s) added.")
