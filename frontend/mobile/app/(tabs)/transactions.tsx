import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  CalendarDays,
  Check,
  Pencil,
  Plus,
  ReceiptText,
  Settings2,
  Tag,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreenHeader } from '@/components/AppScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/services/apiClient';
import type {
  ApiCategorySetting,
  ApiTransaction,
  CategoriesResponse,
  CreateTransactionResponse,
  DeleteTransactionResponse,
  TransactionsResponse,
  UpdateCategoryResponse,
  UpdateTransactionResponse,
} from '@/types/api';
import { formatWon } from '@/utils/aiFormat';

type ContentTab = 'recent' | 'budget';

type TransactionDraft = {
  tx_date: string;
  amount: string;
  merchant_name: string;
  final_category: string;
};

type BudgetDraft = {
  budget_limit: string;
  alert_threshold: string;
  is_daily_challenge: boolean;
};

function todayParam() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentMonthPrefix() {
  return todayParam().slice(0, 7);
}

function formatDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${Number(match[2])}월 ${Number(match[3])}일`;
}

function progressWidth(ratio: number) {
  const percent = Math.min(Math.max(ratio * 100, 0), 100);
  return `${percent}%` as `${number}%`;
}

export default function TransactionsScreen() {
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [categories, setCategories] = useState<ApiCategorySetting[]>([]);
  const [activeTab, setActiveTab] = useState<ContentTab>('budget');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [createDraft, setCreateDraft] = useState<TransactionDraft>({
    tx_date: todayParam(),
    amount: '',
    merchant_name: '',
    final_category: '',
  });

  const [editingTransaction, setEditingTransaction] =
    useState<ApiTransaction | null>(null);
  const [editDraft, setEditDraft] = useState<TransactionDraft>({
    tx_date: todayParam(),
    amount: '',
    merchant_name: '',
    final_category: '',
  });

  const [editingCategory, setEditingCategory] =
    useState<ApiCategorySetting | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<BudgetDraft>({
    budget_limit: '',
    alert_threshold: '0.8',
    is_daily_challenge: true,
  });

  const loadPage = useCallback(async () => {
    try {
      setIsLoading(true);

      const [txResult, categoryResult] = await Promise.all([
        apiRequest<TransactionsResponse>({
          path: '/transactions',
          method: 'GET',
          auth: true,
        }),
        apiRequest<CategoriesResponse>({
          path: '/categories',
          method: 'GET',
          auth: true,
        }),
      ]);

      const nextTransactions = txResult.data ?? [];
      const nextCategories = categoryResult.data ?? [];

      setTransactions(nextTransactions);
      setCategories(nextCategories);
      setCreateDraft((current) => ({
        ...current,
        final_category:
          current.final_category ||
          nextCategories[0]?.category_name ||
          '',
      }));
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '지출 정보를 불러오지 못했어요.'
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

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => {
          const left = `${a.tx_date} ${a.tx_time ?? ''}`;
          const right = `${b.tx_date} ${b.tx_time ?? ''}`;
          return right.localeCompare(left);
        })
        .slice(0, 30),
    [transactions]
  );

  const monthSpendByCategory = useMemo(() => {
    const month = currentMonthPrefix();
    const map = new Map<string, number>();

    transactions.forEach((transaction) => {
      if (!transaction.tx_date.startsWith(month)) return;

      map.set(
        transaction.final_category,
        (map.get(transaction.final_category) ?? 0) +
          transaction.amount
      );
    });

    return map;
  }, [transactions]);

  const createTransaction = async () => {
    const amount = Number(createDraft.amount.replace(/,/g, ''));

    if (
      !createDraft.tx_date ||
      !createDraft.merchant_name.trim() ||
      !createDraft.final_category ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      showToast('날짜, 금액, 결제처, 카테고리를 확인해 주세요.');
      return;
    }

    try {
      setIsSaving(true);

      await apiRequest<CreateTransactionResponse>({
        path: '/transactions',
        method: 'POST',
        auth: true,
        body: {
          tx_date: createDraft.tx_date,
          amount,
          merchant_name: createDraft.merchant_name.trim(),
          final_category: createDraft.final_category,
          is_user_corrected: true,
        },
      });

      setCreateDraft((current) => ({
        ...current,
        amount: '',
        merchant_name: '',
      }));
      showToast('지출을 기록했어요.');
      await loadPage();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '지출을 저장하지 못했어요.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openTransactionEdit = (transaction: ApiTransaction) => {
    setEditingTransaction(transaction);
    setEditDraft({
      tx_date: transaction.tx_date,
      amount: String(transaction.amount),
      merchant_name: transaction.merchant_name,
      final_category: transaction.final_category,
    });
  };

  const saveTransactionEdit = async () => {
    if (!editingTransaction) return;

    const amount = Number(editDraft.amount.replace(/,/g, ''));

    if (
      !editDraft.tx_date ||
      !editDraft.merchant_name.trim() ||
      !editDraft.final_category ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      showToast('수정할 지출 정보를 확인해 주세요.');
      return;
    }

    try {
      setIsSaving(true);

      await apiRequest<UpdateTransactionResponse>({
        path: `/transactions/${editingTransaction.tx_id}`,
        method: 'PATCH',
        auth: true,
        body: {
          tx_date: editDraft.tx_date,
          amount,
          merchant_name: editDraft.merchant_name.trim(),
          final_category: editDraft.final_category,
          is_user_corrected: true,
        },
      });

      setEditingTransaction(null);
      showToast('지출을 수정했어요.');
      await loadPage();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '지출을 수정하지 못했어요.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTransaction = (transaction: ApiTransaction) => {
    Alert.alert(
      '지출 삭제',
      `${transaction.merchant_name} 지출 기록을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest<DeleteTransactionResponse>({
                path: `/transactions/${transaction.tx_id}`,
                method: 'DELETE',
                auth: true,
              });
              showToast('지출 기록을 삭제했어요.');
              await loadPage();
            } catch (error) {
              showToast(
                error instanceof Error
                  ? error.message
                  : '지출을 삭제하지 못했어요.'
              );
            }
          },
        },
      ]
    );
  };

  const openBudgetEdit = (category: ApiCategorySetting) => {
    setEditingCategory(category);
    setBudgetDraft({
      budget_limit: String(category.budget_limit),
      alert_threshold: String(category.alert_threshold),
      is_daily_challenge: category.is_daily_challenge,
    });
  };

  const saveBudgetEdit = async () => {
    if (!editingCategory) return;

    const budget = Number(budgetDraft.budget_limit.replace(/,/g, ''));
    const threshold = Number(budgetDraft.alert_threshold);

    if (
      !Number.isFinite(budget) ||
      budget < 0 ||
      !Number.isFinite(threshold) ||
      threshold < 0
    ) {
      showToast('예산과 알림 기준을 확인해 주세요.');
      return;
    }

    try {
      setIsSaving(true);

      await apiRequest<UpdateCategoryResponse>({
        path: `/categories/${editingCategory.id}`,
        method: 'PATCH',
        auth: true,
        body: {
          budget_limit: budget,
          alert_threshold: threshold,
          is_daily_challenge: budgetDraft.is_daily_challenge,
        },
      });

      setEditingCategory(null);
      showToast('예산 설정을 저장했어요.');
      await loadPage();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : '예산 설정을 저장하지 못했어요.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppScreenHeader
          label="SPEND"
          title="지출 기록"
          Icon={ReceiptText}
        />

        <GlassCard style={styles.createCard}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardTitleIcon}>
              <Plus
                size={18}
                color={colors.butterDeep}
                strokeWidth={2.6}
              />
            </View>
            <Text style={styles.cardTitle}>새 지출</Text>
          </View>

          <View style={styles.formGrid}>
            <View style={[styles.field, styles.gridField]}>
              <Text style={styles.fieldLabel}>날짜</Text>
              <View style={styles.inputWithIcon}>
                <CalendarDays
                  size={16}
                  color={colors.mutedText}
                  strokeWidth={2.2}
                />
                <TextInput
                  value={createDraft.tx_date}
                  onChangeText={(value) =>
                    setCreateDraft((current) => ({
                      ...current,
                      tx_date: value,
                    }))
                  }
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.mutedText}
                  style={styles.inputFlex}
                />
              </View>
            </View>

            <View style={[styles.field, styles.gridField]}>
              <Text style={styles.fieldLabel}>금액</Text>
              <TextInput
                value={createDraft.amount}
                onChangeText={(value) =>
                  setCreateDraft((current) => ({
                    ...current,
                    amount: value,
                  }))
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.mutedText}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>결제처</Text>
            <TextInput
              value={createDraft.merchant_name}
              onChangeText={(value) =>
                setCreateDraft((current) => ({
                  ...current,
                  merchant_name: value,
                }))
              }
              placeholder="예: 편의점"
              placeholderTextColor={colors.mutedText}
              style={styles.input}
            />
          </View>

          <View style={styles.categoryField}>
            <Text style={styles.fieldLabel}>카테고리</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChips}
            >
              {categories.map((category) => {
                const selected =
                  createDraft.final_category === category.category_name;

                return (
                  <Pressable
                    key={category.id}
                    onPress={() =>
                      setCreateDraft((current) => ({
                        ...current,
                        final_category: category.category_name,
                      }))
                    }
                    style={[
                      styles.categoryChip,
                      selected && styles.categoryChipActive,
                    ]}
                  >
                    <Tag
                      size={10}
                      color={
                        selected
                          ? colors.butterDeep
                          : colors.mutedText
                      }
                      strokeWidth={2.3}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        selected && styles.categoryChipTextActive,
                      ]}
                    >
                      {category.category_name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Pressable
            disabled={isSaving}
            onPress={createTransaction}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              isSaving && styles.disabled,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator
                size="small"
                color={colors.text}
              />
            ) : (
              <>
                <Check
                  size={17}
                  color={colors.text}
                  strokeWidth={2.7}
                />
                <Text style={styles.primaryButtonText}>
                  기록하기
                </Text>
              </>
            )}
          </Pressable>
        </GlassCard>

        <View style={styles.tabs}>
          <Pressable
            onPress={() => setActiveTab('budget')}
            style={[
              styles.tab,
              activeTab === 'budget' && styles.tabActive,
            ]}
          >
            <WalletCards
              size={16}
              color={
                activeTab === 'budget'
                  ? colors.text
                  : colors.mutedText
              }
              strokeWidth={2.4}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'budget' && styles.tabTextActive,
              ]}
            >
              항목별 예산 상태
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('recent')}
            style={[
              styles.tab,
              activeTab === 'recent' && styles.tabActive,
            ]}
          >
            <ReceiptText
              size={16}
              color={
                activeTab === 'recent'
                  ? colors.text
                  : colors.mutedText
              }
              strokeWidth={2.4}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'recent' && styles.tabTextActive,
              ]}
            >
              최근 지출
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator
              size="small"
              color={colors.butterDeep}
            />
          </View>
        ) : activeTab === 'recent' ? (
          <View style={styles.list}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction) => (
                <GlassCard
                  key={transaction.tx_id}
                  style={styles.transactionCard}
                >
                  <View style={styles.transactionMain}>
                    <View style={styles.transactionCopy}>
                      <Text style={styles.merchant}>
                        {transaction.merchant_name}
                      </Text>
                      <Text style={styles.transactionMeta}>
                        {formatDate(transaction.tx_date)} ·{' '}
                        {transaction.final_category}
                      </Text>
                    </View>

                    <Text style={styles.amount}>
                      {formatWon(transaction.amount)}
                    </Text>
                  </View>

                  <View style={styles.rowActions}>
                    <Pressable
                      onPress={() => openTransactionEdit(transaction)}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Pencil
                        size={14}
                        color={colors.text}
                        strokeWidth={2.4}
                      />
                      <Text style={styles.secondaryButtonText}>
                        수정
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => deleteTransaction(transaction)}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Trash2
                        size={14}
                        color={colors.dangerText}
                        strokeWidth={2.4}
                      />
                      <Text style={styles.deleteButtonText}>
                        삭제
                      </Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ))
            ) : (
              <GlassCard style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  기록된 지출이 없어요.
                </Text>
              </GlassCard>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {categories.length > 0 ? (
              categories.map((category) => {
                const spent =
                  monthSpendByCategory.get(category.category_name) ?? 0;
                const ratio =
                  category.budget_limit > 0
                    ? spent / category.budget_limit
                    : 0;
                const isOver = ratio > 1;

                return (
                  <GlassCard
                    key={category.id}
                    style={styles.budgetCard}
                  >
                    <View style={styles.budgetTop}>
                      <View>
                        <Text style={styles.budgetCategory}>
                          {category.category_name}
                        </Text>
                        <Text style={styles.budgetAmount}>
                          {formatWon(spent)} /{' '}
                          {formatWon(category.budget_limit)}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => openBudgetEdit(category)}
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Settings2
                          size={17}
                          color={colors.text}
                          strokeWidth={2.4}
                        />
                      </Pressable>
                    </View>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          isOver && styles.progressFillDanger,
                          {
                            width: progressWidth(ratio),
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.budgetBottom}>
                      <Text
                        style={[
                          styles.budgetRatio,
                          isOver && styles.budgetRatioDanger,
                        ]}
                      >
                        {Math.round(ratio * 100)}% 사용
                      </Text>
                      <Text style={styles.budgetFlag}>
                        {category.is_daily_challenge
                          ? '챌린지 대상'
                          : '챌린지 제외'}
                      </Text>
                    </View>
                  </GlassCard>
                );
              })
            ) : (
              <GlassCard style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  표시할 예산 설정이 없어요.
                </Text>
              </GlassCard>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(editingTransaction)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingTransaction(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>지출 수정</Text>
              <Pressable
                onPress={() => setEditingTransaction(null)}
                style={styles.modalClose}
              >
                <X size={18} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>날짜</Text>
            <TextInput
              value={editDraft.tx_date}
              onChangeText={(value) =>
                setEditDraft((current) => ({
                  ...current,
                  tx_date: value,
                }))
              }
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>금액</Text>
            <TextInput
              value={editDraft.amount}
              onChangeText={(value) =>
                setEditDraft((current) => ({
                  ...current,
                  amount: value,
                }))
              }
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>결제처</Text>
            <TextInput
              value={editDraft.merchant_name}
              onChangeText={(value) =>
                setEditDraft((current) => ({
                  ...current,
                  merchant_name: value,
                }))
              }
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>카테고리</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChips}
            >
              {categories.map((category) => {
                const selected =
                  editDraft.final_category === category.category_name;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() =>
                      setEditDraft((current) => ({
                        ...current,
                        final_category: category.category_name,
                      }))
                    }
                    style={[
                      styles.categoryChip,
                      selected && styles.categoryChipActive,
                    ]}
                  >
                    <Tag
                      size={10}
                      color={
                        selected
                          ? colors.butterDeep
                          : colors.mutedText
                      }
                      strokeWidth={2.3}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        selected && styles.categoryChipTextActive,
                      ]}
                    >
                      {category.category_name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              disabled={isSaving}
              onPress={saveTransactionEdit}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>저장</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(editingCategory)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCategory(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory?.category_name ?? ''} 예산
              </Text>
              <Pressable
                onPress={() => setEditingCategory(null)}
                style={styles.modalClose}
              >
                <X size={18} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>월 예산</Text>
            <TextInput
              value={budgetDraft.budget_limit}
              onChangeText={(value) =>
                setBudgetDraft((current) => ({
                  ...current,
                  budget_limit: value,
                }))
              }
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>알림 기준</Text>
            <TextInput
              value={budgetDraft.alert_threshold}
              onChangeText={(value) =>
                setBudgetDraft((current) => ({
                  ...current,
                  alert_threshold: value,
                }))
              }
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchTitle}>데일리 챌린지</Text>
                <Text style={styles.switchMeta}>
                  이 카테고리를 챌린지 생성 대상으로 사용
                </Text>
              </View>

              <Switch
                value={budgetDraft.is_daily_challenge}
                onValueChange={(value) =>
                  setBudgetDraft((current) => ({
                    ...current,
                    is_daily_challenge: value,
                  }))
                }
                trackColor={{
                  false: colors.gray300,
                  true: colors.butterSoft,
                }}
                thumbColor={colors.surface}
              />
            </View>

            <Pressable
              disabled={isSaving}
              onPress={saveBudgetEdit}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>저장</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 112,
  },
  createCard: {
    padding: 18,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 16,
  },
  cardTitleIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  formGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    marginBottom: 12,
  },
  gridField: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    marginBottom: 6,
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: colors.subText,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: colors.text,
    marginBottom: 12,
  },
  inputWithIcon: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    gap: 7,
  },
  inputFlex: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: colors.text,
  },
  categoryField: {
    marginTop: 2,
    marginBottom: 14,
  },
  categoryChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 4,
    paddingVertical: 2,
  },
  categoryChip: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'flex-start',
    minHeight: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryChipActive: {
    borderColor: colors.butterSoft,
    backgroundColor: colors.butterPale,
  },
  categoryChipText: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    color: colors.subText,
  },
  categoryChipTextActive: {
    color: colors.text,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: colors.butterStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    backgroundColor: colors.surfaceMuted,
    marginTop: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabActive: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '800',
    color: colors.mutedText,
  },
  tabTextActive: {
    color: colors.text,
  },
  list: {
    gap: 0,
  },
  transactionCard: {
    padding: 15,
  },
  transactionMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  transactionCopy: {
    flex: 1,
    minWidth: 0,
  },
  merchant: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  transactionMeta: {
    marginTop: 4,
    fontFamily: typography.fontFamily,
    fontSize: 10,
    color: colors.subText,
  },
  amount: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  rowActions: {
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 7,
  },
  secondaryButton: {
    minHeight: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.text,
  },
  deleteButton: {
    minHeight: 32,
    borderRadius: 10,
    backgroundColor: colors.dangerBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  deleteButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.dangerText,
  },
  budgetCard: {
    padding: 15,
  },
  budgetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 11,
  },
  budgetCategory: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  budgetAmount: {
    marginTop: 4,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    color: colors.subText,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.butterStrong,
  },
  progressFillDanger: {
    backgroundColor: '#D66A61',
  },
  budgetBottom: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  budgetRatio: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.butterDeep,
  },
  budgetRatioDanger: {
    color: colors.dangerText,
  },
  budgetFlag: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    color: colors.subText,
  },
  loadingState: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    color: colors.subText,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    minHeight: 62,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  switchMeta: {
    marginTop: 3,
    maxWidth: 320,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    color: colors.subText,
  },
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.55,
  },
});
