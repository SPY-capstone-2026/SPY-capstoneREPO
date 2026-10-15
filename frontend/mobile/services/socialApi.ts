import { apiRequest } from '@/services/apiClient';
import type {
  DeleteFriendResponse,
  FriendRequestActionResponse,
  FriendRequestResponse,
  FriendRequestsResponse,
  FriendsResponse,
  PublicProfileResponse,
} from '@/types/api';

export async function searchUserByNickname(nickname: string) {
  return apiRequest<PublicProfileResponse>({
    path: `/users/search?nickname=${encodeURIComponent(nickname.trim())}`,
    method: 'GET',
    auth: true,
  });
}

export async function getPublicProfile(userId: string) {
  return apiRequest<PublicProfileResponse>({
    path: `/users/${encodeURIComponent(userId)}/profile`,
    method: 'GET',
    auth: true,
  });
}

export async function sendFriendRequest(nickname: string) {
  return apiRequest<FriendRequestResponse>({
    path: '/friends/requests',
    method: 'POST',
    body: { nickname: nickname.trim() },
    auth: true,
  });
}

export async function getFriendRequests(
  direction: 'received' | 'sent' = 'received'
) {
  return apiRequest<FriendRequestsResponse>({
    path: `/friends/requests?direction=${direction}`,
    method: 'GET',
    auth: true,
  });
}

export async function acceptFriendRequest(requestId: string) {
  return apiRequest<FriendRequestActionResponse>({
    path: `/friends/requests/${encodeURIComponent(requestId)}/accept`,
    method: 'POST',
    auth: true,
  });
}

export async function rejectFriendRequest(requestId: string) {
  return apiRequest<FriendRequestActionResponse>({
    path: `/friends/requests/${encodeURIComponent(requestId)}/reject`,
    method: 'POST',
    auth: true,
  });
}

export async function cancelFriendRequest(requestId: string) {
  return apiRequest<FriendRequestActionResponse>({
    path: `/friends/requests/${encodeURIComponent(requestId)}`,
    method: 'DELETE',
    auth: true,
  });
}

export async function getFriends() {
  return apiRequest<FriendsResponse>({
    path: '/friends',
    method: 'GET',
    auth: true,
  });
}

export async function deleteFriend(userId: string) {
  return apiRequest<DeleteFriendResponse>({
    path: `/friends/${encodeURIComponent(userId)}`,
    method: 'DELETE',
    auth: true,
  });
}
