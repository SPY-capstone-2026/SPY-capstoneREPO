"""
소셜(친구) 서비스.

정책
- 친구 요청은 상대 닉네임으로 보낸다. 닉네임이 없는 유저는 검색/요청 대상이 아니다.
- 두 사람 사이의 관계 행은 방향과 무관하게 최대 1개(Friendship.pair_key 유니크).
- 상대가 이미 나에게 요청을 보낸 상태에서 내가 요청하면 → 바로 친구가 된다(자동 수락).
- 거절/취소/친구 삭제는 행을 지운다(다시 요청 가능).
- 공개 프로필은 로그인한 누구나 볼 수 있고, 금융 데이터는 담지 않는다(serializers.serialize_public_user).
"""
import re
from collections import defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy import func
from sqlmodel import Session, select, or_

from models import User, Friendship, ShopItem, UserInventory, DailyChallenge
from services.time_utils import kst_now_naive

FRIEND_PENDING = "PENDING"
FRIEND_ACCEPTED = "ACCEPTED"

NICKNAME_MIN_LEN = 2
NICKNAME_MAX_LEN = 12
_NICKNAME_RE = re.compile(r"^[가-힣A-Za-z0-9_]+$")


# ----------------------------------------
# 닉네임
# ----------------------------------------
def normalize_nickname(raw: Optional[str]) -> str:
    """앞뒤 공백 제거 후 검증. 한글/영문/숫자/밑줄 2~12자."""
    nickname = (raw or "").strip()
    if not (NICKNAME_MIN_LEN <= len(nickname) <= NICKNAME_MAX_LEN):
        raise HTTPException(
            status_code=400,
            detail=f"닉네임은 {NICKNAME_MIN_LEN}~{NICKNAME_MAX_LEN}자로 입력해 주세요",
        )
    if not _NICKNAME_RE.match(nickname):
        raise HTTPException(
            status_code=400, detail="닉네임은 한글, 영문, 숫자, 밑줄(_)만 쓸 수 있어요"
        )
    return nickname


def find_user_by_nickname(session: Session, nickname: str) -> Optional[User]:
    return session.exec(select(User).where(User.nickname == nickname)).first()


# ----------------------------------------
# 공통 조회
# ----------------------------------------
def make_pair_key(user_a: str, user_b: str) -> str:
    return "|".join(sorted([user_a, user_b]))


def get_friendship_between(session: Session, user_a: str, user_b: str) -> Optional[Friendship]:
    return session.exec(
        select(Friendship).where(Friendship.pair_key == make_pair_key(user_a, user_b))
    ).first()


def friendship_status_for(viewer_id: str, target_id: str, friendship: Optional[Friendship]) -> str:
    """viewer 입장에서 본 관계: SELF | FRIEND | REQUEST_SENT | REQUEST_RECEIVED | NONE"""
    if viewer_id == target_id:
        return "SELF"
    if friendship is None:
        return "NONE"
    if friendship.status == FRIEND_ACCEPTED:
        return "FRIEND"
    return "REQUEST_SENT" if friendship.requester_id == viewer_id else "REQUEST_RECEIVED"


def get_equipped_items_map(session: Session, user_ids: List[str]) -> Dict[str, List[ShopItem]]:
    """여러 유저의 장착 아이템을 한 번에 조회 (친구 목록에서 N+1 쿼리 방지)."""
    result: Dict[str, List[ShopItem]] = defaultdict(list)
    if not user_ids:
        return result

    rows = session.exec(
        select(UserInventory, ShopItem)
        .join(ShopItem, ShopItem.item_id == UserInventory.item_id)
        .where(UserInventory.user_id.in_(user_ids))
        .where(UserInventory.is_equipped == True)
        .order_by(ShopItem.category, ShopItem.name)
    ).all()

    for inventory, item in rows:
        result[inventory.user_id].append(item)
    return result


def _get_users_map(session: Session, user_ids: List[str]) -> Dict[str, User]:
    if not user_ids:
        return {}
    users = session.exec(select(User).where(User.user_id.in_(user_ids))).all()
    return {u.user_id: u for u in users}


def _get_request_for_me(session: Session, request_id: str, me_id: str, role: str) -> Friendship:
    """role='addressee'(받은 요청) | 'requester'(보낸 요청). 내 요청이 아니면 존재 자체를 숨기고 404."""
    friendship = session.get(Friendship, request_id)
    owner = None
    if friendship is not None:
        owner = friendship.addressee_id if role == "addressee" else friendship.requester_id
    if friendship is None or owner != me_id or friendship.status != FRIEND_PENDING:
        raise HTTPException(status_code=404, detail="친구 요청을 찾을 수 없습니다")
    return friendship


# ----------------------------------------
# 친구 요청
# ----------------------------------------
def send_friend_request(session: Session, me_id: str, nickname: str) -> dict:
    """
    반환: {"friendship": Friendship, "target": User, "auto_accepted": bool}
    400 자기 자신 / 404 닉네임 없음 / 409 이미 친구·이미 보낸 요청
    """
    target = find_user_by_nickname(session, (nickname or "").strip())
    if target is None:
        raise HTTPException(status_code=404, detail="해당 닉네임의 사용자를 찾을 수 없습니다")
    if target.user_id == me_id:
        raise HTTPException(status_code=400, detail="자기 자신에게는 친구 요청을 보낼 수 없습니다")

    existing = get_friendship_between(session, me_id, target.user_id)
    if existing is not None:
        if existing.status == FRIEND_ACCEPTED:
            raise HTTPException(status_code=409, detail="이미 친구입니다")
        if existing.requester_id == me_id:
            raise HTTPException(status_code=409, detail="이미 친구 요청을 보냈습니다")
        # 상대가 먼저 나에게 요청해 둔 상태 → 서로 원하는 것이므로 바로 수락
        existing.status = FRIEND_ACCEPTED
        existing.responded_at = kst_now_naive()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return {"friendship": existing, "target": target, "auto_accepted": True}

    friendship = Friendship(
        requester_id=me_id,
        addressee_id=target.user_id,
        pair_key=make_pair_key(me_id, target.user_id),
        status=FRIEND_PENDING,
        created_at=kst_now_naive(),
    )
    session.add(friendship)
    try:
        session.commit()
    except IntegrityError:
        # 같은 순간 상대도 나에게 요청했거나 같은 요청이 중복 전송된 경우
        session.rollback()
        raise HTTPException(
            status_code=409, detail="이미 친구 요청이 있습니다. 목록을 새로고침해 주세요"
        )
    session.refresh(friendship)
    return {"friendship": friendship, "target": target, "auto_accepted": False}


def list_friend_requests(session: Session, me_id: str, direction: str = "received"):
    """반환: [(Friendship, 상대 User, 상대 장착 아이템 목록)] 최신순"""
    if direction not in ("received", "sent"):
        raise HTTPException(status_code=400, detail="direction 은 received 또는 sent 입니다")

    column = Friendship.addressee_id if direction == "received" else Friendship.requester_id
    requests = session.exec(
        select(Friendship)
        .where(column == me_id)
        .where(Friendship.status == FRIEND_PENDING)
        .order_by(Friendship.created_at.desc())
    ).all()

    other_ids = [
        f.requester_id if direction == "received" else f.addressee_id for f in requests
    ]
    users = _get_users_map(session, other_ids)
    equipped = get_equipped_items_map(session, other_ids)
    return [
        (f, users[oid], equipped.get(oid, []))
        for f, oid in zip(requests, other_ids)
        if oid in users
    ]


def accept_friend_request(session: Session, me_id: str, request_id: str) -> Friendship:
    friendship = _get_request_for_me(session, request_id, me_id, role="addressee")
    friendship.status = FRIEND_ACCEPTED
    friendship.responded_at = kst_now_naive()
    session.add(friendship)
    try:
        session.commit()
    except StaleDataError:
        # 수락하는 사이 상대가 요청을 취소한 경우
        session.rollback()
        raise HTTPException(status_code=404, detail="친구 요청을 찾을 수 없습니다")
    session.refresh(friendship)
    return friendship


def reject_friend_request(session: Session, me_id: str, request_id: str) -> None:
    friendship = _get_request_for_me(session, request_id, me_id, role="addressee")
    session.delete(friendship)
    session.commit()


def cancel_friend_request(session: Session, me_id: str, request_id: str) -> None:
    friendship = _get_request_for_me(session, request_id, me_id, role="requester")
    session.delete(friendship)
    session.commit()


# ----------------------------------------
# 친구 목록 / 삭제
# ----------------------------------------
def list_friends(session: Session, me_id: str):
    """반환: [(User, 장착 아이템 목록)] 레벨 높은 순 → 닉네임 순"""
    friendships = session.exec(
        select(Friendship)
        .where(Friendship.status == FRIEND_ACCEPTED)
        .where(or_(Friendship.requester_id == me_id, Friendship.addressee_id == me_id))
    ).all()

    friend_ids = [
        f.addressee_id if f.requester_id == me_id else f.requester_id for f in friendships
    ]
    users = _get_users_map(session, friend_ids)
    equipped = get_equipped_items_map(session, friend_ids)

    friends = [users[fid] for fid in friend_ids if fid in users]
    friends.sort(key=lambda u: (-u.current_level, u.nickname or "\uffff"))
    return [(u, equipped.get(u.user_id, [])) for u in friends]


def remove_friend(session: Session, me_id: str, friend_user_id: str) -> None:
    friendship = get_friendship_between(session, me_id, friend_user_id)
    if friendship is None or friendship.status != FRIEND_ACCEPTED or friend_user_id == me_id:
        raise HTTPException(status_code=404, detail="친구 관계가 아닙니다")
    session.delete(friendship)
    session.commit()


# ----------------------------------------
# 공개 프로필
# ----------------------------------------
def get_public_profile(session: Session, viewer_id: str, target_user_id: str) -> dict:
    """반환: {"user": User, "equipped_items": [...], "friendship_status": str}"""
    target = session.get(User, target_user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

    friendship = get_friendship_between(session, viewer_id, target_user_id)
    equipped = get_equipped_items_map(session, [target_user_id])
    return {
        "user": target,
        "equipped_items": equipped.get(target_user_id, []),
        "friendship_status": friendship_status_for(viewer_id, target_user_id, friendship),
    }


# ----------------------------------------
# 친구 랭킹 (나 + 친구, 챌린지 달성 개수 순)
# 공개하는 값은 '달성 개수'뿐이다. 어떤 카테고리 챌린지였는지, 실패/미도전 개수는 내보내지 않는다.
# ----------------------------------------
RANKING_PERIODS = ("week", "month", "all")


def ranking_range(period: str, today: date) -> Tuple[Optional[date], Optional[date]]:
    """week = 이번 주 월~일, month = 이번 달 1일~말일, all = 전체 (KST 기준 today)."""
    if period == "week":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)
    if period == "month":
        start = today.replace(day=1)
        next_month = (start + timedelta(days=32)).replace(day=1)
        return start, next_month - timedelta(days=1)
    if period == "all":
        return None, None
    raise HTTPException(status_code=400, detail="period 는 week, month, all 중 하나입니다")


def get_friend_ranking(session: Session, me_id: str, period: str, today: date) -> dict:
    """
    반환: {"start": date|None, "end": date|None,
           "entries": [{"rank", "user", "equipped_items", "completed_count", "is_me"}, ...]}
    정렬: 달성 개수 많은 순 → 레벨 높은 순 → 닉네임 순. 달성 개수가 같으면 같은 순위(1, 1, 3 ...).
    """
    start, end = ranking_range(period, today)

    friend_ids = [u.user_id for u, _ in list_friends(session, me_id)]
    member_ids = [me_id] + friend_ids
    users = _get_users_map(session, member_ids)
    equipped = get_equipped_items_map(session, member_ids)

    query = (
        select(DailyChallenge.user_id, func.count())
        .where(DailyChallenge.user_id.in_(member_ids))
        .where(DailyChallenge.status == "SUCCESS")
    )
    if start is not None:
        query = query.where(DailyChallenge.challenge_date >= start)
        query = query.where(DailyChallenge.challenge_date <= end)
    counts = dict(session.exec(query.group_by(DailyChallenge.user_id)).all())

    members = [users[uid] for uid in member_ids if uid in users]
    members.sort(key=lambda u: (-counts.get(u.user_id, 0), -u.current_level, u.nickname or "\uffff"))

    entries = []
    previous_count, previous_rank = None, 0
    for index, user in enumerate(members, start=1):
        count = int(counts.get(user.user_id, 0))
        rank = previous_rank if count == previous_count else index
        previous_count, previous_rank = count, rank
        entries.append({
            "rank": rank,
            "user": user,
            "equipped_items": equipped.get(user.user_id, []),
            "completed_count": count,
            "is_me": user.user_id == me_id,
        })
    return {"start": start, "end": end, "entries": entries}
