import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  Check,
  Search,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react-native';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppLoadingState } from '@/components/AppLoadingState';
import { AppScreenHeader } from '@/components/AppScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import {
  getCurrentUser,
  updateCurrentUser,
} from '@/services/authService';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getFriendRequests,
  getFriends,
  rejectFriendRequest,
  searchUserByNickname,
  sendFriendRequest,
} from '@/services/socialApi';
import type {
  FriendRequest,
  MeResponse,
  PublicProfile,
  PublicUser,
} from '@/types/api';

type SocialSection = 'friends' | 'requests';

function displayName(user: Pick<PublicUser, 'nickname'>) {
  return user.nickname?.trim() || '이름 없음';
}

export default function SocialScreen() {
  const { showToast } = useToast();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [section, setSection] = useState<SocialSection>('friends');
  const [isLoading, setIsLoading] = useState(true);

  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);

  const [searchVisible, setSearchVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<PublicProfile | null>(null);

  const loadPage = useCallback(async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      setMe(user);

      if (!user.nickname) {
        setNicknameDraft('');
        setFriends([]);
        setReceived([]);
        setSent([]);
        return;
      }

      const [friendsResult, receivedResult, sentResult] =
        await Promise.all([
          getFriends(),
          getFriendRequests('received'),
          getFriendRequests('sent'),
        ]);

      setFriends(friendsResult.data ?? []);
      setReceived(receivedResult.data ?? []);
      setSent(sentResult.data ?? []);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '친구 정보를 불러오지 못했어요.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadPage();
    }, [loadPage])
  );

  const requestCount = received.length + sent.length;

  const saveNickname = async () => {
    const nickname = nicknameDraft.trim();
    if (!nickname) {
      showToast('닉네임을 입력해 주세요.');
      return;
    }

    try {
      setNicknameSaving(true);
      const updated = await updateCurrentUser({ nickname });
      setMe(updated);
      showToast('닉네임을 설정했어요.');
      await loadPage();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '닉네임을 저장하지 못했어요.'
      );
    } finally {
      setNicknameSaving(false);
    }
  };

  const runSearch = async () => {
    if (!query.trim()) {
      showToast('찾을 닉네임을 입력해 주세요.');
      return;
    }

    try {
      setSearching(true);
      const response = await searchUserByNickname(query);
      setResult(response.data);
    } catch (error) {
      setResult(null);
      showToast(
        error instanceof Error
          ? error.message
          : '검색 결과가 없어요.'
      );
    } finally {
      setSearching(false);
    }
  };

  const requestFriend = async (profile: PublicProfile) => {
    if (!profile.nickname) return;

    try {
      setSearching(true);
      const response = await sendFriendRequest(profile.nickname);
      if (response.data.auto_accepted) {
        showToast('친구가 되었어요.');
      } else {
        showToast('친구 요청을 보냈어요.');
      }
      const refreshed = await searchUserByNickname(profile.nickname);
      setResult(refreshed.data);
      await loadPage();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '친구 요청을 보내지 못했어요.'
      );
      try {
        const refreshed = await searchUserByNickname(profile.nickname);
        setResult(refreshed.data);
      } catch {}
    } finally {
      setSearching(false);
    }
  };

  const accept = async (item: FriendRequest) => {
    try {
      await acceptFriendRequest(item.request_id);
      showToast('친구가 되었어요.');
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '요청을 처리하지 못했어요.'
      );
    }
    await loadPage();
  };

  const reject = async (item: FriendRequest) => {
    try {
      await rejectFriendRequest(item.request_id);
      showToast('친구 요청을 거절했어요.');
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '요청을 처리하지 못했어요.'
      );
    }
    await loadPage();
  };

  const cancel = async (item: FriendRequest) => {
    try {
      await cancelFriendRequest(item.request_id);
      showToast('친구 요청을 취소했어요.');
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '요청을 처리하지 못했어요.'
      );
    }
    await loadPage();
  };

  if (isLoading && !me) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingWrap}>
          <AppLoadingState compact />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <AppScreenHeader
          label="SOCIAL"
          title="친구"
          Icon={UsersRound}
          ActionIcon={UserPlus}
          actionLabel="친구 찾기"
          onActionPress={() => setSearchVisible(true)}
        />

        {!me?.nickname ? (
          <GlassCard style={styles.nicknameCard}>
            <Text style={styles.cardTitle}>먼저 닉네임을 정해 주세요</Text>
            <Text style={styles.cardDescription}>
              친구는 닉네임으로 서로를 찾을 수 있어요.
            </Text>

            <TextInput
              value={nicknameDraft}
              onChangeText={setNicknameDraft}
              maxLength={12}
              autoCapitalize="none"
              placeholder="2~12자 닉네임"
              placeholderTextColor={colors.mutedText}
              style={styles.input}
            />

            <Pressable
              disabled={nicknameSaving}
              onPress={saveNickname}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {nicknameSaving ? '저장 중' : '닉네임 설정'}
              </Text>
            </Pressable>
          </GlassCard>
        ) : (
          <>
            <GlassCard style={styles.myCard}>
              <Text style={styles.myLabel}>내 닉네임</Text>
              <Text style={styles.myNickname}>{me.nickname}</Text>
              <Text style={styles.myMeta}>Lv.{me.current_level}</Text>
            </GlassCard>

            <View style={styles.tabs}>
              <Pressable
                onPress={() => setSection('friends')}
                style={[
                  styles.tab,
                  section === 'friends' && styles.tabActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    section === 'friends' && styles.tabTextActive,
                  ]}
                >
                  친구 {friends.length}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSection('requests')}
                style={[
                  styles.tab,
                  section === 'requests' && styles.tabActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    section === 'requests' && styles.tabTextActive,
                  ]}
                >
                  요청 {requestCount}
                </Text>
              </Pressable>
            </View>

            {section === 'friends' ? (
              friends.length > 0 ? (
                friends.map((friend) => (
                  <Pressable
                    key={friend.user_id}
                    onPress={() =>
                      router.push({
                        pathname: '/social/[userId]',
                        params: { userId: friend.user_id },
                      })
                    }
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <GlassCard style={styles.friendCard}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {displayName(friend).slice(0, 1)}
                        </Text>
                      </View>

                      <View style={styles.friendCopy}>
                        <Text style={styles.friendName}>
                          {displayName(friend)}
                        </Text>
                        <Text style={styles.friendMeta}>
                          Lv.{friend.current_level} · 장착 아이템{' '}
                          {friend.equipped_items.length}개
                        </Text>
                      </View>

                      <Text style={styles.roomLink}>방 보기</Text>
                    </GlassCard>
                  </Pressable>
                ))
              ) : (
                <GlassCard style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>
                    아직 친구가 없어요.
                  </Text>
                  <Text style={styles.emptyText}>
                    닉네임을 검색해 친구 요청을 보내 보세요.
                  </Text>
                </GlassCard>
              )
            ) : (
              <>
                <Text style={styles.sectionTitle}>받은 요청</Text>
                {received.length > 0 ? (
                  received.map((item) => (
                    <GlassCard key={item.request_id} style={styles.requestCard}>
                      <View style={styles.friendCopy}>
                        <Text style={styles.friendName}>
                          {displayName(item.user)}
                        </Text>
                        <Text style={styles.friendMeta}>
                          Lv.{item.user.current_level}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => reject(item)}
                        style={styles.smallGhostButton}
                      >
                        <X size={15} color={colors.subText} strokeWidth={2.5} />
                      </Pressable>
                      <Pressable
                        onPress={() => accept(item)}
                        style={styles.smallStrongButton}
                      >
                        <Check
                          size={15}
                          color={colors.backgroundWhite}
                          strokeWidth={2.8}
                        />
                      </Pressable>
                    </GlassCard>
                  ))
                ) : (
                  <Text style={styles.inlineEmpty}>받은 요청이 없어요.</Text>
                )}

                <Text style={styles.sectionTitle}>보낸 요청</Text>
                {sent.length > 0 ? (
                  sent.map((item) => (
                    <GlassCard key={item.request_id} style={styles.requestCard}>
                      <View style={styles.friendCopy}>
                        <Text style={styles.friendName}>
                          {displayName(item.user)}
                        </Text>
                        <Text style={styles.friendMeta}>응답 대기 중</Text>
                      </View>
                      <Pressable
                        onPress={() => cancel(item)}
                        style={styles.cancelRequestButton}
                      >
                        <Text style={styles.cancelRequestText}>취소</Text>
                      </Pressable>
                    </GlassCard>
                  ))
                ) : (
                  <Text style={styles.inlineEmpty}>보낸 요청이 없어요.</Text>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={searchVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSearchVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>친구 찾기</Text>
              <Pressable onPress={() => setSearchVisible(false)}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                placeholder="정확한 닉네임 입력"
                placeholderTextColor={colors.mutedText}
                onSubmitEditing={runSearch}
                style={[styles.input, styles.searchInput]}
              />
              <Pressable
                disabled={searching}
                onPress={runSearch}
                style={styles.searchButton}
              >
                <Search size={17} color={colors.backgroundWhite} />
              </Pressable>
            </View>

            {result ? (
              <View style={styles.searchResult}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(result.nickname || '이').slice(0, 1)}
                  </Text>
                </View>
                <View style={styles.friendCopy}>
                  <Text style={styles.friendName}>
                    {result.nickname || '이름 없음'}
                  </Text>
                  <Text style={styles.friendMeta}>
                    Lv.{result.current_level}
                  </Text>
                </View>

                {result.friendship_status === 'NONE' ? (
                  <Pressable
                    disabled={searching}
                    onPress={() => requestFriend(result)}
                    style={styles.resultButton}
                  >
                    <Text style={styles.resultButtonText}>친구 요청</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.statusText}>
                    {result.friendship_status === 'SELF'
                      ? '내 프로필'
                      : result.friendship_status === 'FRIEND'
                        ? '친구'
                        : result.friendship_status === 'REQUEST_SENT'
                          ? '요청 보냄'
                          : '받은 요청 있음'}
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 112,
  },
  nicknameCard: { backgroundColor: colors.butterPale },
  cardTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  cardDescription: {
    marginTop: 4,
    marginBottom: 14,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.subText,
  },
  input: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: colors.text,
  },
  primaryButton: {
    marginTop: 10,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.backgroundWhite,
  },
  myCard: { backgroundColor: colors.butterPale },
  myLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  myNickname: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  myMeta: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 10,
    color: colors.subText,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 4,
    backgroundColor: colors.ink,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.backgroundWhite },
  tabText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.gray400,
  },
  tabTextActive: { color: colors.text },
  friendCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.butterSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  friendCopy: { flex: 1 },
  friendName: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  friendMeta: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    color: colors.subText,
  },
  roomLink: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  emptyCard: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  emptyText: {
    marginTop: 5,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    color: colors.subText,
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 5,
    marginBottom: 8,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  requestCard: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  smallGhostButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallStrongButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRequestButton: {
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  cancelRequestText: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.subText,
  },
  inlineEmpty: {
    marginBottom: 14,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    color: colors.mutedText,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(33,27,22,0.32)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.backgroundWhite,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: { flex: 1 },
  searchButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResult: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.butterPale,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultButton: {
    borderRadius: 12,
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  resultButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.backgroundWhite,
  },
  statusText: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  pressed: { opacity: 0.7 },
});
