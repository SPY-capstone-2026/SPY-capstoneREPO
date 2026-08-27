from typing import Optional
from sqlmodel import Session, select
from fastapi import HTTPException
from models import User, ShopItem, UserInventory, PointTransaction


def get_active_shop_items(session: Session, category: Optional[str] = None):
    """구매 가능하고 활성화된 상점 아이템 목록. category로 필터링 가능."""
    query = (
        select(ShopItem)
        .where(ShopItem.is_purchasable == True)
        .where(ShopItem.is_active == True)
    )

    if category:
        query = query.where(ShopItem.category == category)

    return session.exec(query).all()


def get_user_inventory(session: Session, user_id: str):
    """유저가 보유한 아이템 목록을, 각 아이템의 상세정보와 함께 반환."""
    inventory_rows = session.exec(
        select(UserInventory).where(UserInventory.user_id == user_id)
    ).all()

    result = []
    for row in inventory_rows:
        item = session.get(ShopItem, row.item_id)
        result.append((row, item))

    return result


def purchase_item(session: Session, user: User, item_id: str) -> dict:
    """
    상점 아이템 구매 처리.

    체크 순서:
    1. 아이템 존재 + 활성 여부       -> 404
    2. 구매 가능 아이템인지          -> 400 (마일스톤 전용 지급템은 구매 불가)
    3. 비반복 아이템 중복 보유 여부   -> 409
    4. 포인트 충분한지               -> 400

    성공 시: 포인트 차감 + PointTransaction 기록 + UserInventory 추가를
    하나의 세션에서 원자적으로 처리.
    """
    item = session.get(ShopItem, item_id)

    if not item or not item.is_active:
        raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다")

    if not item.is_purchasable or item.price is None:
        raise HTTPException(
            status_code=400,
            detail="구매할 수 없는 아이템입니다 (레벨업 전용 지급 아이템일 수 있어요)",
        )

    if not item.is_repeatable:
        existing = session.exec(
            select(UserInventory)
            .where(UserInventory.user_id == user.user_id)
            .where(UserInventory.item_id == item_id)
        ).first()

        if existing:
            raise HTTPException(status_code=409, detail="이미 보유한 아이템입니다")

    if user.current_points < item.price:
        raise HTTPException(
            status_code=400,
            detail=(
                f"포인트가 부족합니다 "
                f"(보유 {user.current_points}P / 필요 {item.price}P)"
            ),
        )

    user.current_points -= item.price

    session.add(PointTransaction(
        user_id=user.user_id,
        amount=-item.price,
        reason="SHOP_PURCHASE",
        reference_id=item.item_id,
        balance_after=user.current_points,
    ))

    inventory_row = UserInventory(
        user_id=user.user_id,
        item_id=item.item_id,
        acquired_type="PURCHASED",
    )
    session.add(inventory_row)
    session.add(user)
    session.commit()
    session.refresh(user)
    session.refresh(inventory_row)

    return {
        "purchased_item": item,
        "inventory_id": inventory_row.id,
        "current_points": user.current_points,
    }


def set_item_equipped(session: Session, user: User, item_id: str, equip: bool) -> UserInventory:
    """보유 중인 아이템의 장착 상태를 변경."""
    inventory_row = session.exec(
        select(UserInventory)
        .where(UserInventory.user_id == user.user_id)
        .where(UserInventory.item_id == item_id)
    ).first()

    if not inventory_row:
        raise HTTPException(status_code=404, detail="보유하지 않은 아이템입니다")

    inventory_row.is_equipped = equip
    session.add(inventory_row)
    session.commit()
    session.refresh(inventory_row)

    return inventory_row
