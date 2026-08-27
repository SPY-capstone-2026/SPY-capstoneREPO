from models import User, DailyChallenge, UserCategorySetting, Transaction, ShopItem, UserInventory


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
