from sqlmodel import Session, select
from models import User, ShopItem, UserInventory, PointTransaction, DailyChallenge

# XP 곡선: 레벨 N → N+1 필요 XP = 30 + 10 × (N-1)
XP_BASE = 30
XP_INCREMENT = 10
MAX_LEVEL = 50

# 포인트 보상
LEVEL_UP_POINTS = 50
MILESTONE_INTERVAL = 5  # 5의 배수 레벨마다
MILESTONE_BONUS_POINTS = 100  # 일반 50 + 추가 100 = 총 150


def xp_required_for_level(level: int) -> int:
    """현재 레벨에서 다음 레벨로 가는 데 필요한 XP"""
    return XP_BASE + XP_INCREMENT * (level - 1)


def calculate_level_from_xp(total_xp: int) -> int:
    """누적 total_xp를 기준으로 현재 레벨을 계산 (매번 재계산 방식)"""
    level = 1
    remaining = total_xp
    while level < MAX_LEVEL:
        needed = xp_required_for_level(level)
        if remaining < needed:
            break
        remaining -= needed
        level += 1
    return level


def process_challenge_completion(session: Session, user: User, xp_reward: int) -> dict:
    """
    챌린지 완료 시 호출.
    XP를 적립하고, 레벨업이 발생했으면 포인트를 지급하고 로그를 남긴다.
    반환값은 그대로 DailyChallenge.reward_snapshot에 저장해서,
    나중에 완료 취소 시 정확히 되돌리는 데 쓴다.
    """
    old_level = user.current_level
    user.total_xp += xp_reward

    new_level = calculate_level_from_xp(user.total_xp)
    levels_gained = list(range(old_level + 1, new_level + 1))

    total_points_earned = 0
    unlocked_items = []
    unlocked_item_ids = []

    for level in levels_gained:
        points = LEVEL_UP_POINTS
        reason = "LEVEL_UP"

        if level % MILESTONE_INTERVAL == 0:
            points += MILESTONE_BONUS_POINTS
            reason = "MILESTONE_BONUS"

            milestone_item = session.exec(
                select(ShopItem)
                .where(ShopItem.is_purchasable == False)
                .where(ShopItem.unlock_level == level)
            ).first()

            if milestone_item:
                session.add(
                    UserInventory(
                        user_id=user.user_id,
                        item_id=milestone_item.item_id,
                        acquired_type="LEVEL_REWARD",
                    )
                )
                unlocked_items.append(milestone_item.name)
                unlocked_item_ids.append(milestone_item.item_id)

        user.current_points += points
        total_points_earned += points

        session.add(
            PointTransaction(
                user_id=user.user_id,
                amount=points,
                reason=reason,
                reference_id=str(level),
                balance_after=user.current_points,
            )
        )

    user.current_level = new_level
    session.add(user)
    session.commit()
    session.refresh(user)

    return {
        "leveled_up": len(levels_gained) > 0,
        "old_level": old_level,
        "new_level": new_level,
        "points_earned": total_points_earned,
        "current_points": user.current_points,
        "unlocked_items": unlocked_items,
        "unlocked_item_ids": unlocked_item_ids,
    }


def reverse_challenge_completion(
    session: Session, user: User, challenge: DailyChallenge
) -> dict:
    """
    챌린지 완료 취소 시 호출.
    challenge.reward_snapshot에 저장된 값을 기준으로 XP/포인트/마일스톤 아이템을
    정확히 되돌린다. (재계산이 아니라 '완료 당시 실제로 지급된 양'을 그대로 회수)
    """
    snapshot = challenge.reward_snapshot

    # XP는 항상 total_xp 기준 재계산으로 롤백 (source of truth가 total_xp이므로 안전)
    user.total_xp = max(0, user.total_xp - challenge.xp_reward)
    user.current_level = calculate_level_from_xp(user.total_xp)

    if not snapshot:
        # 이 기능 도입 이전에 완료된 챌린지라 스냅샷이 없는 경우 -> XP만 롤백
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"points_reversed": 0, "items_removed": [], "snapshot_found": False}

    points_to_reverse = snapshot.get("points_earned", 0)
    user.current_points = max(0, user.current_points - points_to_reverse)

    session.add(
        PointTransaction(
            user_id=user.user_id,
            amount=-points_to_reverse,
            reason="COMPLETION_CANCELLED",
            reference_id=str(challenge.challenge_id),
            balance_after=user.current_points,
        )
    )

    removed_items = []
    for item_id in snapshot.get("unlocked_item_ids", []):
        inventory_row = session.exec(
            select(UserInventory)
            .where(UserInventory.user_id == user.user_id)
            .where(UserInventory.item_id == item_id)
            .where(UserInventory.acquired_type == "LEVEL_REWARD")
        ).first()
        if inventory_row:
            session.delete(inventory_row)
            removed_items.append(item_id)

    session.add(user)
    session.commit()
    session.refresh(user)

    return {
        "points_reversed": points_to_reverse,
        "items_removed": removed_items,
        "snapshot_found": True,
    }
