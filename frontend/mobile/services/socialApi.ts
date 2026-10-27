import { apiRequest } from '@/services/apiClient';

export type PublicItem = {
  item_id: string; name: string; image_url: string | null;
  category: string; rarity: string;
};
export type PublicUser = {
  user_id: string; nickname: string | null; current_level: number;
  total_xp: number; character: PublicItem | null; equipped_items: PublicItem[];
};
export type PublicProfile = PublicUser & {
  friendship_status: 'SELF' | 'NONE' | 'FRIEND' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | string;
};
export type FriendRequest = {
  request_id: string; direction: string; status: string;
  created_at: string | null; user: PublicUser;
};
export type FriendRequestResult = FriendRequest & { auto_accepted: boolean };
export type ListResponse<T> = { status: string; count: number; data: T[] };
export type DataResponse<T> = { status: string; data: T };

export const searchUserByNickname = (nickname: string) => apiRequest<DataResponse<PublicProfile>>({
  path: `/users/search?nickname=${encodeURIComponent(nickname.trim())}`, method: 'GET', auth: true,
});
export const getPublicProfile = (id: string) => apiRequest<DataResponse<PublicProfile>>({
  path: `/users/${encodeURIComponent(id)}/profile`, method: 'GET', auth: true,
});
export const getFriends = () => apiRequest<ListResponse<PublicUser>>({ path: '/friends', method: 'GET', auth: true });
export const getFriendRequests = (direction: 'sent' | 'received') => apiRequest<ListResponse<FriendRequest>>({
  path: `/friends/requests?direction=${direction}`, method: 'GET', auth: true,
});
export const sendFriendRequest = (nickname: string) => apiRequest<DataResponse<FriendRequestResult>>({
  path: '/friends/requests', method: 'POST', auth: true, body: { nickname: nickname.trim() },
});
export const acceptFriendRequest = (id: string) => apiRequest<DataResponse<{request_id: string}>>({
  path: `/friends/requests/${encodeURIComponent(id)}/accept`, method: 'POST', auth: true,
});
export const rejectFriendRequest = (id: string) => apiRequest<DataResponse<{request_id: string}>>({
  path: `/friends/requests/${encodeURIComponent(id)}/reject`, method: 'POST', auth: true,
});
export const cancelFriendRequest = (id: string) => apiRequest<DataResponse<{request_id: string}>>({
  path: `/friends/requests/${encodeURIComponent(id)}`, method: 'DELETE', auth: true,
});
export const deleteFriend = (id: string) => apiRequest<DataResponse<{user_id: string}>>({
  path: `/friends/${encodeURIComponent(id)}`, method: 'DELETE', auth: true,
});
