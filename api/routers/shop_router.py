from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session

from models import engine, User
from auth import get_current_user_id
from schemas import InventoryEquipRequest
from serializers import serialize_shop_item, serialize_inventory_item
from services.shop_service import (
    get_active_shop_items,
    get_user_inventory,
    purchase_item,
    set_item_equipped,
)

router = APIRouter()


# [상점 1] 구매 가능한 아이템 목록 조회
@router.get("/shop/items")
def get_shop_items_api(
    category: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        items = get_active_shop_items(session, category=category)

        return {
            "status": "success",
            "count": len(items),
            "data": [serialize_shop_item(item) for item in items],
        }


# [상점 2] 아이템 구매 (포인트 차감)
@router.post("/shop/purchase/{item_id}")
def purchase_shop_item_api(
    item_id: str,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        result = purchase_item(session, user, item_id)

        return {
            "status": "success",
            "data": {
                "item": serialize_shop_item(result["purchased_item"]),
                "current_points": result["current_points"],
            },
        }


# [상점 3] 내가 보유한 아이템 목록 조회
@router.get("/shop/inventory")
def get_my_inventory_api(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        rows = get_user_inventory(session, user_id)

        return {
            "status": "success",
            "count": len(rows),
            "data": [
                serialize_inventory_item(inventory, item) for inventory, item in rows
            ],
        }


# [상점 4] 보유 아이템 장착/해제 (캐릭터 상태 변경)
@router.patch("/shop/inventory/{item_id}/equip")
def equip_inventory_item_api(
    item_id: str,
    req: InventoryEquipRequest,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        user = session.get(User, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

        inventory_row = set_item_equipped(session, user, item_id, req.equip)

        return {
            "status": "success",
            "data": serialize_inventory_item(inventory_row),
        }
