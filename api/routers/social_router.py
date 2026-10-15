from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session

from models import engine
from auth import get_current_user_id
from schemas import FriendRequestCreateRequest
from serializers import serialize_public_user, serialize_friend_request
from services.social_service import (
    find_user_by_nickname,
    get_friendship_between,
    friendship_status_for,
    get_equipped_items_map,
    send_friend_request,
    list_friend_requests,
    accept_friend_request,
    reject_friend_request,
    cancel_friend_request,
    list_friends,
    remove_friend,
    get_public_profile,
)

router = APIRouter()


def _profile_payload(user, equipped_items, friendship_status):
    data = serialize_public_user(user, equipped_items)
    data["friendship_status"] = friendship_status
    return data


# [소셜 1] 닉네임으로 유저 찾기 (정확히 일치하는 1명)
@router.get("/users/search")
def search_user_api(nickname: str, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        target = find_user_by_nickname(session, nickname.strip())
        if target is None:
            raise HTTPException(status_code=404, detail="해당 닉네임의 사용자를 찾을 수 없습니다")

        friendship = get_friendship_between(session, user_id, target.user_id)
        equipped = get_equipped_items_map(session, [target.user_id])
        return {
            "status": "success",
            "data": _profile_payload(
                target,
                equipped.get(target.user_id, []),
                friendship_status_for(user_id, target.user_id, friendship),
            ),
        }


# [소셜 2] 공개 프로필 (캐릭터·레벨·장착 상태, 금융 데이터 없음)
@router.get("/users/{target_user_id}/profile")
def get_public_profile_api(target_user_id: str, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        result = get_public_profile(session, user_id, target_user_id)
        return {
            "status": "success",
            "data": _profile_payload(
                result["user"], result["equipped_items"], result["friendship_status"]
            ),
        }


# [소셜 3] 친구 요청 보내기 (상대가 이미 나에게 요청했다면 바로 친구가 됨)
@router.post("/friends/requests")
def send_friend_request_api(
    req: FriendRequestCreateRequest,
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        result = send_friend_request(session, user_id, req.nickname)
        target = result["target"]
        equipped = get_equipped_items_map(session, [target.user_id])
        return {
            "status": "success",
            "data": {
                **serialize_friend_request(
                    result["friendship"], user_id, target, equipped.get(target.user_id, [])
                ),
                "auto_accepted": result["auto_accepted"],
            },
        }


# [소셜 4] 친구 요청 목록 (direction=received 기본 | sent)
@router.get("/friends/requests")
def list_friend_requests_api(
    direction: str = "received",
    user_id: str = Depends(get_current_user_id),
):
    with Session(engine) as session:
        rows = list_friend_requests(session, user_id, direction)
        return {
            "status": "success",
            "count": len(rows),
            "data": [
                serialize_friend_request(f, user_id, other, equipped)
                for f, other, equipped in rows
            ],
        }


# [소셜 5] 받은 요청 수락
@router.post("/friends/requests/{request_id}/accept")
def accept_friend_request_api(request_id: str, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        friendship = accept_friend_request(session, user_id, request_id)
        return {
            "status": "success",
            "data": {"request_id": friendship.id, "status": friendship.status},
        }


# [소셜 6] 받은 요청 거절
@router.post("/friends/requests/{request_id}/reject")
def reject_friend_request_api(request_id: str, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        reject_friend_request(session, user_id, request_id)
        return {"status": "success", "data": {"request_id": request_id}}


# [소셜 7] 보낸 요청 취소
@router.delete("/friends/requests/{request_id}")
def cancel_friend_request_api(request_id: str, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        cancel_friend_request(session, user_id, request_id)
        return {"status": "success", "data": {"request_id": request_id}}


# [소셜 8] 친구 목록
@router.get("/friends")
def list_friends_api(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        rows = list_friends(session, user_id)
        return {
            "status": "success",
            "count": len(rows),
            "data": [serialize_public_user(u, equipped) for u, equipped in rows],
        }


# [소셜 9] 친구 삭제
@router.delete("/friends/{friend_user_id}")
def remove_friend_api(friend_user_id: str, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        remove_friend(session, user_id, friend_user_id)
        return {"status": "success", "data": {"user_id": friend_user_id}}
