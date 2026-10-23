import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Settings2, WalletCards, X } from 'lucide-react-native';

import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/services/apiClient';
import { palette, ui } from '@/constants/moniTheme';
import type { ApiCategorySetting, ApiTransaction, CategoriesResponse, TransactionsResponse } from '@/types/api';

type BudgetDraft = {
  budget_limit: string;
  alert_threshold: string;
  is_daily_challenge: boolean;
};
const won = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const monthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function BudgetScreen() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<ApiCategorySetting[]>([]);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ApiCategorySetting | null>(null);
  const [draft, setDraft] = useState<BudgetDraft>({ budget_limit: '', alert_threshold: '80', is_daily_challenge: true });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [categoryResult, transactionResult] = await Promise.all([
        apiRequest<CategoriesResponse>({ path: '/categories', method: 'GET', auth: true }),
        apiRequest<TransactionsResponse>({ path: '/transactions', method: 'GET', auth: true }),
      ]);
      setCategories(categoryResult.data ?? []);
      setTransactions(transactionResult.data ?? []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '예산 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const monthSpend = useMemo(() => {
    const spent = new Map<string, number>();
    const currentMonth = monthKey();
    for (const tx of transactions) {
      if (!tx.tx_date.startsWith(currentMonth)) continue;
      spent.set(tx.final_category, (spent.get(tx.final_category) ?? 0) + tx.amount);
    }
    return spent;
  }, [transactions]);

  const openEditor = (category: ApiCategorySetting) => {
    setEditing(category);
    setDraft({
      budget_limit: String(category.budget_limit),
      alert_threshold: String(category.alert_threshold),
      is_daily_challenge: category.is_daily_challenge,
    });
  };

  const save = async () => {
    if (!editing || saving) return;
    const budget = Number(draft.budget_limit.replace(/[,\s]/g, ''));
    const threshold = Number(draft.alert_threshold);
    if (!Number.isSafeInteger(budget) || budget < 0 || !Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
      showToast('월 예산은 0원 이상, 알림 기준은 0~100% 정수로 입력해 주세요.');
      return;
    }
    try {
      setSaving(true);
      await apiRequest({
        path: `/categories/${encodeURIComponent(editing.id)}`,
        method: 'PATCH',
        auth: true,
        body: { budget_limit: budget, alert_threshold: threshold, is_daily_challenge: draft.is_daily_challenge },
      });
      setEditing(null);
      showToast('예산 설정을 저장했어요.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '예산 설정을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        <Text style={ui.title}>예산 관리</Text>
        <Text style={ui.subtitle}>이번 달 카테고리별 소비를 확인하고 예산을 조정하세요.</Text>
        {loading ? <Text style={ui.muted}>예산 정보를 불러오는 중...</Text> : null}
        {categories.length === 0 && !loading ? <View style={ui.card}><Text style={ui.muted}>설정된 예산이 없어요.</Text></View> : null}
        {categories.map((category) => {
          const spend = monthSpend.get(category.category_name) ?? 0;
          const ratio = category.budget_limit > 0 ? spend / category.budget_limit : spend > 0 ? 1 : 0;
          const exceeded = category.budget_limit > 0 ? spend > category.budget_limit : spend > 0;
          return (
            <View key={category.id} style={ui.card}>
              <View style={[ui.row, { justifyContent: 'space-between' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={ui.heading}>{category.category_name}</Text>
                  <Text style={ui.muted}>{won(spend)} / {won(category.budget_limit)}</Text>
                </View>
                <Pressable style={ui.secondary} onPress={() => openEditor(category)} accessibilityLabel={`${category.category_name} 예산 수정`}>
                  <Settings2 size={20} color={palette.ink} />
                </Pressable>
              </View>
              <View style={{ height: 9, marginTop: 13, backgroundColor: palette.border, borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${Math.min(100, Math.max(0, ratio * 100))}%` as `${number}%`, backgroundColor: exceeded ? palette.danger : palette.butter }} />
              </View>
              <Text style={[ui.muted, { marginTop: 8 }]}>
                {exceeded ? '예산을 초과했어요. 예산 재설정을 검토해 주세요.' : `${Math.round(ratio * 100)}% 사용`}
              </Text>
              <View style={[ui.row, { marginTop: 8 }]}>
                <WalletCards size={15} color={palette.muted} />
                <Text style={ui.muted}>알림 {category.alert_threshold}% · {category.is_daily_challenge ? '챌린지 대상' : '챌린지 제외'}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0009', padding: 16 }}>
          <View style={[ui.card, { width: '100%', maxWidth: 540, alignSelf: 'center' }]}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.heading}>{editing?.category_name ?? ''} 예산 설정</Text>
              <Pressable onPress={() => setEditing(null)} accessibilityLabel="닫기"><X size={20} color={palette.ink} /></Pressable>
            </View>
            <Text style={ui.muted}>월 예산 (원)</Text>
            <TextInput style={ui.input} keyboardType="numeric" value={draft.budget_limit} onChangeText={(v) => setDraft((old) => ({ ...old, budget_limit: v }))} />
            <Text style={ui.muted}>알림 기준 (0~100%)</Text>
            <TextInput style={ui.input} keyboardType="numeric" value={draft.alert_threshold} onChangeText={(v) => setDraft((old) => ({ ...old, alert_threshold: v }))} />
            <View style={[ui.row, { justifyContent: 'space-between', marginVertical: 12 }]}>
              <Text style={ui.text}>데일리 챌린지 대상</Text>
              <Switch value={draft.is_daily_challenge} onValueChange={(v) => setDraft((old) => ({ ...old, is_daily_challenge: v }))} />
            </View>
            <Pressable style={ui.button} disabled={saving} onPress={() => void save()}><Text style={ui.buttonText}>{saving ? '저장 중...' : '설정 저장'}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
