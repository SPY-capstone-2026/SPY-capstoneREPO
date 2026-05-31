import { useMemo, useState } from 'react';
import {
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
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowDownToLine,
  Edit3,
  PencilLine,
  Plus,
  ReceiptText,
  Target,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react-native';

import { AnimatedButton } from '@/components/AnimatedButton';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { AppScreenHeader } from '@/components/AppScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { GlassCard } from '@/components/GlassCard';
import { JellySegmentedControl } from '@/components/JellySegmentedControl';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import {
  mockCategorySettings,
  mockTodayChallenge,
  mockTransactions,
} from '@/constants/mockAiResult';
import type { CategorySetting, Transaction } from '@/constants/mockTypes';
import { useToast } from '@/contexts/ToastContext';
import { formatWon, sortEvaluatedCategories } from '@/utils/aiFormat';
import {
  getBudgetBg,
  getBudgetColor,
  getBudgetLabel,
  getBudgetSignalText,
  getBudgetTone,
  getFriendlyBudgetMessage,
} from '@/utils/budgetStatus';
import { getCategoryMeta } from '@/utils/categoryMeta';

const importedTransactions: Transaction[] = [
  {
    tx_id: 'tx-import-001',
    user_id: 'user-demo-001',
    tx_date: '2026-05-15',
    tx_time: '09:40',
    amount: 3500,
    merchant_name: '컴포즈커피',
    mydata_category: '식비',
    final_category: '카페',
    is_user_corrected: false,
  },
  {
    tx_id: 'tx-import-002',
    user_id: 'user-demo-001',
    tx_date: '2026-05-15',
    tx_time: '21:10',
    amount: 6200,
    merchant_name: 'GS25',
    mydata_category: '편의점',
    final_category: '식비',
    is_user_corrected: false,
  },
];

function formatAmountInput(value: string) {
  const onlyNumber = value.replace(/[^0-9]/g, '');

  if (!onlyNumber) {
    return '';
  }

  return Number(onlyNumber).toLocaleString('ko-KR');
}

function parseAmountInput(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

export default function TransactionsScreen() {
  const mission = mockTodayChallenge;
  const { showToast } = useToast();

  const evaluatedCategories = sortEvaluatedCategories(
    mission.ai_metadata.evaluated_categories
  );

  const [transactions, setTransactions] =
    useState<Transaction[]>(mockTransactions);

  const [categories, setCategories] =
    useState<CategorySetting[]>(mockCategorySettings);

  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(
    null
  );

  const [merchant, setMerchant] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState(
    mockCategorySettings[0].category_name
  );

  const selectedCategory = categories[selectedCategoryIndex];
  const selectedCategoryMeta = getCategoryMeta(selectedCategory.category_name);
  const SelectedCategoryIcon = selectedCategoryMeta.Icon;

  const selectedEvaluation = evaluatedCategories.find(
    (item) => item.category_name === selectedCategory.category_name
  );

  const recentTransactions = useMemo(
    () => transactions.slice(0, 6),
    [transactions]
  );

  const totalAmount = useMemo(
    () => transactions.reduce((sum, item) => sum + item.amount, 0),
    [transactions]
  );

  const selectedActualSpend = useMemo(
    () =>
      transactions
        .filter(
          (transaction) =>
            transaction.final_category === selectedCategory.category_name
        )
        .reduce((sum, item) => sum + item.amount, 0),
    [selectedCategory.category_name, transactions]
  );

  const missionCategoryCount = useMemo(
    () => categories.filter((item) => item.is_daily_challenge).length,
    [categories]
  );

  const selectedPressure =
    selectedEvaluation?.budget_pressure ??
    (selectedCategory.budget_limit > 0
      ? selectedActualSpend / selectedCategory.budget_limit
      : 0);

  const selectedPressureTone = getBudgetTone(selectedPressure);
  const selectedPressureColor = getBudgetColor(selectedPressure);
  const selectedPressureBg = getBudgetBg(selectedPressure);
  const selectedPressureLabel = getBudgetLabel(selectedPressure);

  const handleSelectCategory = (index: number) => {
    setSelectedCategoryIndex(index);
    setCategory(categories[index].category_name);
  };

  const openAddModal = () => {
    setEditingTransactionId(null);
    setMerchant('');
    setAmountInput('');
    setCategory(selectedCategory.category_name);
    setIsModalVisible(true);
  };

  const openEditModal = (transaction: Transaction) => {
    setEditingTransactionId(transaction.tx_id);
    setMerchant(transaction.merchant_name);
    setAmountInput(formatAmountInput(String(transaction.amount)));
    setCategory(transaction.final_category);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setEditingTransactionId(null);
    setMerchant('');
    setAmountInput('');
    setCategory(selectedCategory.category_name);
  };

  const handleChangeAmount = (value: string) => {
    setAmountInput(formatAmountInput(value));
  };

  const handleSaveTransaction = () => {
    if (!merchant.trim()) {
      showToast('결제처를 입력해 주세요.');
      return;
    }

    if (!amountInput.trim()) {
      showToast('금액을 입력해 주세요.');
      return;
    }

    const numericAmount = parseAmountInput(amountInput);

    if (!numericAmount) {
      showToast('금액을 숫자로 입력해 주세요.');
      return;
    }

    if (editingTransactionId) {
      setTransactions((prev) =>
        prev.map((item) =>
          item.tx_id === editingTransactionId
            ? {
                ...item,
                merchant_name: merchant.trim(),
                amount: numericAmount,
                final_category: category,
                is_user_corrected: true,
              }
            : item
        )
      );

      showToast('지출 내역이 수정됐어요.');
    } else {
      const newTransaction: Transaction = {
        tx_id: `manual-${Date.now()}`,
        user_id: selectedCategory.user_id,
        tx_date: mission.challenge_date,
        tx_time: '오늘',
        amount: numericAmount,
        merchant_name: merchant.trim(),
        mydata_category: '직접 입력',
        final_category: category,
        is_user_corrected: true,
      };

      setTransactions((prev) => [newTransaction, ...prev]);
      showToast(`${category}에 ${formatWon(numericAmount)} 지출이 추가됐어요.`);
    }

    const nextIndex = categories.findIndex(
      (item) => item.category_name === category
    );

    if (nextIndex >= 0) {
      setSelectedCategoryIndex(nextIndex);
    }

    closeModal();
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    Alert.alert(
      '지출 삭제',
      `${transaction.merchant_name} 지출을 삭제할까요?`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            setTransactions((prev) =>
              prev.filter((item) => item.tx_id !== transaction.tx_id)
            );
            showToast('지출 내역을 삭제했어요.');
          },
        },
      ]
    );
  };

  const handleImportTransactions = () => {
    const existingIds = new Set(transactions.map((item) => item.tx_id));
    const nextImported = importedTransactions.filter(
      (item) => !existingIds.has(item.tx_id)
    );

    if (nextImported.length === 0) {
      showToast('이미 최신 내역을 불러왔어요.');
      return;
    }

    setTransactions((prev) => [...nextImported, ...prev]);
    showToast(`${nextImported.length}건의 지출 내역을 불러왔어요.`);
  };

  const toggleDailyMission = (categoryId: string) => {
    const wasIncluded = selectedCategory.is_daily_challenge;

    setCategories((prev) =>
      prev.map((item) =>
        item.id === categoryId
          ? {
              ...item,
              is_daily_challenge: !item.is_daily_challenge,
            }
          : item
      )
    );

    showToast(
      wasIncluded
        ? `${selectedCategory.category_name} 항목을 미션에서 제외했어요.`
        : `${selectedCategory.category_name} 항목을 미션에 포함했어요.`
    );
  };

  const renderTransactionCard = (transaction: Transaction, delay: number) => {
    const transactionMeta = getCategoryMeta(transaction.final_category);
    const TransactionIcon = transactionMeta.Icon;

    return (
      <GlassCard key={transaction.tx_id} delay={delay} tone="soft">
        <View style={styles.transactionRow}>
          <View style={styles.receiptIconBubble}>
            <TransactionIcon size={20} color={colors.text} strokeWidth={2.8} />
          </View>

          <View style={styles.transactionMain}>
            <View style={styles.transactionTitleRow}>
              <Text style={styles.merchant}>{transaction.merchant_name}</Text>

              <Text style={styles.transactionAmount}>
                {formatWon(transaction.amount)}
              </Text>
            </View>

            <Text style={styles.meta}>
              {transaction.tx_date} {transaction.tx_time}
            </Text>

            <View style={styles.badgeRow}>
              <Text style={styles.categoryBadge}>
                {transaction.final_category}
              </Text>

              {transaction.is_user_corrected ? (
                <Text style={styles.correctedBadge}>직접 수정</Text>
              ) : (
                <Text style={styles.rawBadge}>기본 분류</Text>
              )}
            </View>

            <View style={styles.transactionActionRow}>
              <Pressable
                style={styles.transactionActionButton}
                onPress={() => openEditModal(transaction)}
              >
                <Edit3 size={14} color={colors.butterBrown} strokeWidth={2.8} />
                <Text style={styles.transactionActionText}>수정</Text>
              </Pressable>

              <Pressable
                style={styles.transactionActionButton}
                onPress={() => handleDeleteTransaction(transaction)}
              >
                <Trash2 size={14} color={colors.dangerText} strokeWidth={2.8} />
                <Text
                  style={[
                    styles.transactionActionText,
                    styles.deleteActionText,
                  ]}
                >
                  삭제
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </GlassCard>
    );
  };

  return (
    <LinearGradient
      colors={['#FFF8D8', '#FFFBF0', '#FFFFFF']}
      style={styles.gradient}
    >
      <View style={styles.backgroundOrbLarge} />
      <View style={styles.backgroundOrbSmall} />
      <View style={styles.backgroundOrbTiny} />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <AppScreenHeader
          label="SPENDING"
          title="지출을 빠르게 기록하고 확인하세요."
          description="가장 자주 쓰는 지출 추가와 최근 내역을 먼저 보여드립니다."
          Icon={ReceiptText}
        />

        <GlassCard delay={80} tone="butter" style={styles.actionCard}>
          <View style={styles.actionTopRow}>
            <View>
              <Text style={styles.cardLabel}>이번 달 기록된 지출</Text>
              <Text style={styles.totalAmount}>{formatWon(totalAmount)}</Text>
            </View>

            <View style={styles.walletBubble}>
              <WalletCards size={27} color={colors.text} strokeWidth={2.8} />
            </View>
          </View>

          <View style={styles.actionButtonRow}>
            <Pressable style={styles.primaryActionButton} onPress={openAddModal}>
              <View style={styles.actionIconBubble}>
                <Plus size={21} color={colors.text} strokeWidth={2.8} />
              </View>

              <View style={styles.actionTextBox}>
                <Text style={styles.actionTitle}>지출 추가</Text>
                <Text style={styles.actionDescription}>방금 쓴 돈 기록</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.secondaryActionButton}
              onPress={handleImportTransactions}
            >
              <View style={styles.actionIconBubble}>
                <ArrowDownToLine
                  size={21}
                  color={colors.text}
                  strokeWidth={2.8}
                />
              </View>

              <View style={styles.actionTextBox}>
                <Text style={styles.actionTitle}>내역 불러오기</Text>
                <Text style={styles.actionDescription}>카드 지출 가져오기</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.summaryLine}>
            <View style={styles.summaryItem}>
              <ReceiptText size={15} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.summaryText}>{transactions.length}건 기록</Text>
            </View>

            <View style={styles.summaryItem}>
              <Target size={15} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.summaryText}>
                미션 포함 {missionCategoryCount}개
              </Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>최근 지출</Text>
          <Text style={styles.sectionSubtitle}>
            최근 내역만 보여드립니다. 잘못된 항목은 바로 수정할 수 있습니다.
          </Text>
        </View>

        {recentTransactions.length === 0 ? (
          <GlassCard delay={160} tone="soft">
            <EmptyState
              title="아직 지출 기록이 없어요."
              description="오늘 쓴 돈을 하나만 기록해도 리포트와 미션이 더 정확해집니다."
              actionLabel="지출 추가하기"
              onAction={openAddModal}
              Icon={PencilLine}
            />
          </GlassCard>
        ) : (
          recentTransactions.map((transaction, index) =>
            renderTransactionCard(transaction, 160 + index * 50)
          )
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>항목별 예산 상태</Text>
          <Text style={styles.sectionSubtitle}>
            확인할 항목을 선택하면 예산 흐름만 간단히 보여드립니다.
          </Text>
        </View>

        <JellySegmentedControl
          items={categories.map((item) => item.category_name)}
          selectedIndex={selectedCategoryIndex}
          onChange={handleSelectCategory}
        />

        <GlassCard delay={420} tone="butter" style={styles.categoryCard}>
          <View style={styles.categoryTopRow}>
            <View style={styles.categoryIconBubble}>
              <SelectedCategoryIcon
                size={27}
                color={colors.text}
                strokeWidth={2.8}
              />
            </View>

            <View style={styles.categoryTitleBox}>
              <Text style={styles.cardLabel}>선택한 항목</Text>
              <Text style={styles.categoryTitle}>
                {selectedCategory.category_name}
              </Text>
              <Text style={styles.categoryDescription}>
                {selectedCategoryMeta.description}
              </Text>
            </View>

            <View
              style={[
                styles.rateBadge,
                {
                  backgroundColor: selectedPressureBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.rateBadgeText,
                  {
                    color: selectedPressureColor,
                  },
                ]}
              >
                {selectedPressureLabel}
              </Text>
            </View>
          </View>

          <View style={styles.categoryMetricList}>
            <View style={styles.categoryMetricItem}>
              <Text style={styles.metricLabel}>월 예산</Text>
              <Text style={styles.metricValue}>
                {formatWon(selectedCategory.budget_limit)}
              </Text>
            </View>

            <View style={styles.categoryMetricItem}>
              <Text style={styles.metricLabel}>기록된 지출</Text>
              <Text style={styles.metricValue}>
                {formatWon(selectedActualSpend)}
              </Text>
            </View>

            <View style={styles.categoryMetricItem}>
              <Text style={styles.metricLabel}>월말 예상</Text>
              <Text style={styles.metricValue}>
                {selectedEvaluation
                  ? formatWon(selectedEvaluation.predicted_monthly_spend)
                  : '기록 부족'}
              </Text>
            </View>
          </View>

          <View style={styles.progressInfoRow}>
            <Text style={styles.progressLabel}>예산 사용 예상</Text>
            <Text
              style={[
                styles.progressValue,
                {
                  color: selectedPressureColor,
                },
              ]}
            >
              {getBudgetSignalText(selectedPressure)}
            </Text>
          </View>

          <AnimatedProgressBar
            progress={selectedPressure}
            tone={selectedPressureTone}
          />

          <Text style={styles.categoryStatusText}>
            {getFriendlyBudgetMessage(selectedPressure)}
          </Text>

          <View style={styles.challengeSwitchBox}>
            <View style={styles.switchTextBox}>
              <Text style={styles.switchTitle}>오늘의 미션에 포함</Text>
              <Text style={styles.switchDescription}>
                줄이고 싶은 항목이라면 켜두세요.
              </Text>
            </View>

            <Switch
              value={selectedCategory.is_daily_challenge}
              onValueChange={() => toggleDailyMission(selectedCategory.id)}
              thumbColor={
                selectedCategory.is_daily_challenge
                  ? colors.butterStrong
                  : '#F4F4F4'
              }
              trackColor={{
                true: colors.butterSoft,
                false: colors.gray200,
              }}
            />
          </View>
        </GlassCard>
      </ScrollView>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingTransactionId ? '지출 수정' : '지출 추가'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  결제처, 금액, 항목만 입력하면 됩니다.
                </Text>
              </View>

              <Pressable style={styles.modalCloseButton} onPress={closeModal}>
                <X size={20} color={colors.text} strokeWidth={2.8} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>결제처</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 스타벅스"
              placeholderTextColor={colors.mutedText}
              value={merchant}
              onChangeText={setMerchant}
            />

            <Text style={styles.inputLabel}>금액</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 5,800"
              placeholderTextColor={colors.mutedText}
              keyboardType="number-pad"
              value={amountInput}
              onChangeText={handleChangeAmount}
            />

            <Text style={styles.inputLabel}>항목</Text>
            <View style={styles.categoryChipGrid}>
              {categories.map((item) => {
                const isSelected = category === item.category_name;
                const categoryMeta = getCategoryMeta(item.category_name);
                const CategoryIcon = categoryMeta.Icon;

                return (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.selectedCategoryChip,
                    ]}
                    onPress={() => setCategory(item.category_name)}
                  >
                    <CategoryIcon
                      size={16}
                      color={isSelected ? colors.text : colors.butterBrown}
                      strokeWidth={2.8}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.selectedCategoryChipText,
                      ]}
                    >
                      {item.category_name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <AnimatedButton
              title={editingTransactionId ? '수정 완료' : '추가하기'}
              onPress={handleSaveTransaction}
              style={styles.modalButton}
            />

            <AnimatedButton
              title="닫기"
              variant="ghost"
              onPress={closeModal}
              style={styles.modalSecondaryButton}
            />
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  backgroundOrbLarge: {
    position: 'absolute',
    top: -90,
    right: -80,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 201, 76, 0.28)',
  },
  backgroundOrbSmall: {
    position: 'absolute',
    top: 220,
    left: -64,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
  },
  backgroundOrbTiny: {
    position: 'absolute',
    top: 520,
    right: 34,
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 240, 184, 0.38)',
  },
  container: {
    padding: 20,
    paddingBottom: 128,
  },
  actionCard: {
    backgroundColor: 'rgba(255,248,216,0.42)',
  },
  actionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 8,
  },
  totalAmount: {
    fontFamily: typography.fontFamily,
    fontSize: 34,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.8,
  },
  walletBubble: {
    width: 58,
    height: 58,
    borderRadius: 23,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonRow: {
    gap: 10,
    marginBottom: 14,
  },
  primaryActionButton: {
    minHeight: 72,
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: colors.butterStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  secondaryActionButton: {
    minHeight: 72,
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  actionDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  summaryLine: {
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  summaryText: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 21,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  transactionRow: {
    flexDirection: 'row',
    gap: 13,
  },
  receiptIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionMain: {
    flex: 1,
  },
  transactionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  merchant: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  transactionAmount: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  meta: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.butterPale,
    color: colors.butterBrown,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
  },
  correctedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.successBg,
    color: colors.successText,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
  },
  rawBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    color: colors.subText,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
  },
  transactionActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  transactionActionButton: {
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 11,
    backgroundColor: 'rgba(255, 247, 214, 0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  transactionActionText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  deleteActionText: {
    color: colors.dangerText,
  },
  categoryCard: {
    marginTop: 16,
    backgroundColor: 'rgba(255,248,216,0.42)',
  },
  categoryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  categoryIconBubble: {
    width: 62,
    height: 62,
    borderRadius: 24,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitleBox: {
    flex: 1,
  },
  categoryTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 25,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  categoryDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    color: colors.subText,
  },
  rateBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  rateBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
  },
  categoryMetricList: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
    gap: 9,
    marginBottom: 14,
  },
  categoryMetricItem: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  metricValue: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  progressLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '800',
    color: colors.subText,
  },
  progressValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
  },
  categoryStatusText: {
    marginTop: 12,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  challengeSwitchBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  switchTextBox: {
    flex: 1,
  },
  switchTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  switchDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    padding: 22,
    borderRadius: 30,
    backgroundColor: '#FFFBF0',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 23,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.butterBrown,
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: 16,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: colors.text,
    marginBottom: 14,
  },
  categoryChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  categoryChip: {
    height: 40,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 247, 214, 0.72)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedCategoryChip: {
    backgroundColor: colors.butterStrong,
    borderColor: 'rgba(215, 169, 0, 0.22)',
  },
  categoryChipText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  selectedCategoryChipText: {
    color: colors.text,
  },
  modalButton: {
    marginTop: 2,
  },
  modalSecondaryButton: {
    marginTop: 10,
  },
});