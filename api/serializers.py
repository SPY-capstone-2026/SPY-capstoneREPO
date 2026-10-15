from models import (
    User,
    DailyChallenge,
    UserCategorySetting,
    Transaction,
    ShopItem,
    UserInventory,
    BudgetChangeLog,
    Friendship,
)


def serialize_user_progress(user: User):
    return {
        "user_id": user.user_id,
        "total_xp": user.total_xp,
        "current_level": user.current_level,
        "current_points": user.current_points,
    }


def serialize_user_profile(user: User):
    return {
        "user_id": user.user_id,
        "email": user.email,
        "nickname": user.nickname,
        "income_type": user.income_type,
        "payday": user.payday,
        "spend_profile": user.spend_profile,
        "total_xp": user.total_xp,
        "current_level": user.current_level,
        "current_points": user.current_points,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def serialize_challenge(challenge: DailyChallenge):
    return {
        "challenge_id": challenge.challenge_id,
        "user_id": challenge.user_id,
        "category_name": challenge.category_name,
        "challenge_date": challenge.challenge_date.isoformat(),
        "challenge_type": challenge.challenge_type,
        "challenge_text": challenge.challenge_text,
        "difficulty": challenge.difficulty,
        "status": challenge.status,
        "xp_reward": challenge.xp_reward,
        "ai_metadata": challenge.ai_metadata,
        "reward_snapshot": challenge.reward_snapshot,
        "completed_at": (
            challenge.completed_at.isoformat() if challenge.completed_at else None
        ),
        "verification_result": challenge.verification_result,
    }


def serialize_category_setting(setting: UserCategorySetting):
    return {
        "id": setting.id,
        "user_id": setting.user_id,
        "category_name": setting.category_name,
        "budget_limit": setting.budget_limit,
        "is_daily_challenge": setting.is_daily_challenge,
        "alert_threshold": setting.alert_threshold,
    }


def serialize_transaction(transaction: Transaction):
    return {
        "tx_id": transaction.tx_id,
        "user_id": transaction.user_id,
        "tx_date": transaction.tx_date.isoformat(),
        "tx_time": (
            transaction.tx_time.strftime("%H:%M") if transaction.tx_time else None
        ),
        "amount": transaction.amount,
        "merchant_name": transaction.merchant_name,
        "mydata_category": transaction.mydata_category,
        "final_category": transaction.final_category,
        "is_user_corrected": transaction.is_user_corrected,
    }


def serialize_shop_item(item: ShopItem):
    return {
        "item_id": item.item_id,
        "name": item.name,
        "description": item.description,
        "category": item.category,
        "price": item.price,
        "image_url": item.image_url,
        "is_purchasable": item.is_purchasable,
        "is_repeatable": item.is_repeatable,
        "rarity": item.rarity,
        "unlock_level": item.unlock_level,
    }


def serialize_inventory_item(inventory: UserInventory, item: ShopItem = None):
    return {
        "id": inventory.id,
        "item_id": inventory.item_id,
        "item": serialize_shop_item(item) if item else None,
        "acquired_type": inventory.acquired_type,
        "is_equipped": inventory.is_equipped,
        "acquired_at": (
            inventory.acquired_at.isoformat() if inventory.acquired_at else None
        ),
    }


def serialize_budget_change(log: BudgetChangeLog):
    """
    예산 변경 이력 한 건. 리포트에 '언제, 어느 카테고리, 얼마 -> 얼마'로 표시하고,
    AI 총평(report.py)에도 같은 dict 를 넘긴다. (AI 쪽은 DB 객체가 아니라 dict 만 읽는다)
    키 이름(category_name/old_limit/new_limit/changed_at)은 AI FIELD MAP 과 맞춰져 있으므로 바꾸지 말 것.
    """
    return {
        "category_name": log.category_name,
        "old_limit": log.old_limit,
        "new_limit": log.new_limit,
        "direction": "증액" if log.new_limit > log.old_limit else "감액",
        "changed_at": log.changed_at.isoformat() if log.changed_at else None,
    }


# ----------------------------------------
# 소셜 (다른 사람에게 보이는 정보)
# ⚠ 금융/개인 정보(email, income_type, payday, spend_profile, current_points,
#   거래·예산·챌린지 내용)는 절대 넣지 않는다. 필드를 추가할 땐 이 원칙부터 확인.
# ----------------------------------------
def serialize_public_item(item: ShopItem):
    return {
        "item_id": item.item_id,
        "name": item.name,
        "category": item.category,
        "image_url": item.image_url,
        "rarity": item.rarity,
    }


def serialize_public_user(user: User, equipped_items=None):
    equipped_items = equipped_items or []
    character = next((i for i in equipped_items if i.category == "CHARACTER"), None)
    return {
        "user_id": user.user_id,
        "nickname": user.nickname,
        "current_level": user.current_level,
        "total_xp": user.total_xp,
        "character": serialize_public_item(character) if character else None,
        "equipped_items": [serialize_public_item(i) for i in equipped_items],
    }


def serialize_friend_request(friendship: Friendship, me_id: str, other_user: User, equipped_items=None):
    return {
        "request_id": friendship.id,
        "direction": "SENT" if friendship.requester_id == me_id else "RECEIVED",
        "status": friendship.status,
        "created_at": friendship.created_at.isoformat() if friendship.created_at else None,
        "user": serialize_public_user(other_user, equipped_items),
    }
