import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Check, Pencil, Plus, ReceiptText, Settings2, Trash2, X } from 'lucide-react-native';
import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/services/apiClient';
import { CsvImportCard } from '@/components/CsvImportCard';
import { TransactionDatePicker } from '@/components/TransactionDatePicker';
import { palette, ui } from '@/constants/moniTheme';
import type { ApiCategorySetting, ApiTransaction, CategoriesResponse, TransactionsResponse } from '@/types/api';

type Draft = { tx_date: string; amount: string; merchant_name: string; final_category: string };
type BudgetDraft = { budget_limit: string; alert_threshold: string; is_daily_challenge: boolean };
function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number); const dt = new Date(Date.UTC(y,m-1,d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m-1 && dt.getUTCDate() === d;
}
const money = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const parseAmount = (s: string) => Number(s.replace(/[,\s₩원]/g,''));

export default function TransactionsScreen() {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [categories, setCategories] = useState<ApiCategorySetting[]>([]);
  const [section, setSection] = useState<'spend' | 'budget'>('spend');
  const [draft, setDraft] = useState<Draft>({tx_date:today(),amount:'',merchant_name:'',final_category:''});
  const [editing, setEditing] = useState<ApiTransaction | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({tx_date:today(),amount:'',merchant_name:'',final_category:''});
  const [budgetCategory, setBudgetCategory] = useState<ApiCategorySetting | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<BudgetDraft>({budget_limit:'',alert_threshold:'80',is_daily_challenge:true});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([
        apiRequest<TransactionsResponse>({path:'/transactions',method:'GET',auth:true}),
        apiRequest<CategoriesResponse>({path:'/categories',method:'GET',auth:true}),
      ]);
      setTransactions(t.data || []); setCategories(c.data || []);
      setDraft(old => ({...old, final_category:old.final_category || c.data?.[0]?.category_name || ''}));
    } catch(error) { showToast(error instanceof Error ? error.message : '지출 정보를 불러오지 못했어요.'); }
    finally { setLoading(false); }
  }, [showToast]);
  useFocusEffect(useCallback(() => {void load();}, [load]));
  const sorted = useMemo(() => [...transactions].sort((a,b) => `${b.tx_date} ${b.tx_time || ''}`.localeCompare(`${a.tx_date} ${a.tx_time || ''}`)), [transactions]);
  const spendByCategory = useMemo(() => {
    const totals = new Map<string,number>(); const month = today().slice(0,7);
    transactions.filter(t=>t.tx_date.startsWith(month)).forEach(t=>totals.set(t.final_category,(totals.get(t.final_category)||0)+t.amount));
    return totals;
  }, [transactions]);
  const validate = (value: Draft) => {
    const amount = parseAmount(value.amount);
    if (!validDate(value.tx_date) || !Number.isInteger(amount) || amount <= 0 || !value.merchant_name.trim() || !value.final_category) {
      showToast('날짜·금액·결제처·카테고리를 확인해 주세요.'); return null;
    }
    return {tx_date:value.tx_date,amount,merchant_name:value.merchant_name.trim(),final_category:value.final_category,is_user_corrected:true};
  };
  const create = async () => {
    if (saving) return; const body = validate(draft); if (!body) return;
    try { setSaving(true); await apiRequest({path:'/transactions',method:'POST',body,auth:true});
      setDraft(old=>({...old,amount:'',merchant_name:''})); showToast('지출을 기록했어요.'); await load();
    } catch(error) { showToast(error instanceof Error ? error.message : '지출 등록에 실패했어요.'); }
    finally { setSaving(false); }
  };
  const saveEdit = async () => {
    if (!editing || saving) return; const body = validate(editDraft); if (!body) return;
    try { setSaving(true); await apiRequest({path:`/transactions/${encodeURIComponent(editing.tx_id)}`,method:'PATCH',body,auth:true});
      setEditing(null); showToast('지출을 수정했어요.'); await load();
    } catch(error) { showToast(error instanceof Error ? error.message : '지출 수정에 실패했어요.'); }
    finally { setSaving(false); }
  };
  const performDelete = async (entry: ApiTransaction) => {
    if (deleting) return;
    try { setDeleting(entry.tx_id); await apiRequest({path:`/transactions/${encodeURIComponent(entry.tx_id)}`,method:'DELETE',auth:true});
      showToast('지출을 삭제했어요.'); await load();
    } catch(error) { showToast(error instanceof Error ? error.message : '지출 삭제에 실패했어요.'); }
    finally { setDeleting(null); }
  };
  const deleteEntry = (entry: ApiTransaction) => {
    const msg = `${entry.merchant_name} · ${money(entry.amount)} 내역을 삭제할까요?`;
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(msg)) void performDelete(entry); }
    else Alert.alert('지출 삭제', msg, [{text:'취소',style:'cancel'}, {text:'삭제',style:'destructive',onPress:()=>void performDelete(entry)}]);
  };
  const editBudget = (category: ApiCategorySetting) => {
    setBudgetCategory(category);
    setBudgetDraft({budget_limit:String(category.budget_limit),alert_threshold:String(category.alert_threshold),is_daily_challenge:category.is_daily_challenge});
  };
  const saveBudget = async () => {
    if (!budgetCategory || saving) return;
    const budget = parseAmount(budgetDraft.budget_limit); const threshold = Number(budgetDraft.alert_threshold);
    if (!Number.isInteger(budget) || budget < 0 || !Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
      showToast('월 예산은 0원 이상, 알림 기준은 0~100%로 입력해 주세요.'); return;
    }
    try { setSaving(true); await apiRequest({path:`/categories/${encodeURIComponent(budgetCategory.id)}`,method:'PATCH',auth:true,
      body:{budget_limit:budget,alert_threshold:threshold,is_daily_challenge:budgetDraft.is_daily_challenge}});
      setBudgetCategory(null); showToast('예산을 수정했어요.'); await load();
    } catch(error) { showToast(error instanceof Error ? error.message : '예산 수정에 실패했어요.'); }
    finally { setSaving(false); }
  };
  const categoryPills = (value: string, update: (name: string) => void) => <View style={[ui.rowWrap,{marginBottom:12}]}>
    {categories.map(c=><Pressable key={c.id} onPress={()=>update(c.category_name)} style={value===c.category_name?ui.button:ui.secondary}>
      <Text style={ui.buttonText}>{c.category_name}</Text>
    </Pressable>)}
  </View>;
  return <View style={ui.screen}>
    <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
      <Text style={ui.title}>소비 기록</Text>
      <Text style={ui.subtitle}>직접 입력하거나 CSV를 등록해 예산과 예측에 반영해요.</Text>
      <CsvImportCard categories={categories.map(c=>c.category_name)} onImported={load}/>
      <View style={ui.card}>
        <View style={ui.row}><Plus size={18} color={palette.ink}/><Text style={ui.heading}>새 지출</Text></View>
        <Text style={ui.muted}>날짜</Text>
        <TransactionDatePicker value={draft.tx_date} onChange={tx_date=>setDraft(old=>({...old,tx_date}))}/>
        <Text style={ui.muted}>금액 (원)</Text>
        <TextInput style={ui.input} keyboardType="numeric" value={draft.amount} onChangeText={amount=>setDraft(old=>({...old,amount}))} placeholder="예: 4500"/>
        <Text style={ui.muted}>결제처</Text>
        <TextInput style={ui.input} value={draft.merchant_name} onChangeText={merchant_name=>setDraft(old=>({...old,merchant_name}))} placeholder="예: 카페"/>
        <Text style={ui.muted}>카테고리</Text>{categoryPills(draft.final_category, final_category=>setDraft(old=>({...old,final_category})))}
        <Pressable disabled={saving} style={ui.button} onPress={()=>void create()}><View style={ui.row}><Check size={17} color={palette.ink}/><Text style={ui.buttonText}>{saving?'저장 중':'기록하기'}</Text></View></Pressable>
      </View>
      <View style={[ui.row,{marginVertical:10}]}>
        <Pressable style={section==='spend'?ui.button:ui.secondary} onPress={()=>setSection('spend')}><Text style={ui.buttonText}>최근 지출</Text></Pressable>
        <Pressable style={section==='budget'?ui.button:ui.secondary} onPress={()=>setSection('budget')}><Text style={ui.buttonText}>항목별 예산</Text></Pressable>
      </View>
      {loading && <Text style={ui.muted}>불러오는 중...</Text>}
      {section==='spend' ? sorted.length ? sorted.slice(0,100).map(item=><View key={item.tx_id} style={ui.card}>
        <View style={[ui.row,{justifyContent:'space-between'}]}><View style={{flex:1}}>
          <Text style={ui.heading}>{item.merchant_name}</Text>
          <Text style={ui.muted}>{item.tx_date} · {item.final_category}</Text>
        </View><Text style={[ui.heading,{marginBottom:0}]}>{money(item.amount)}</Text></View>
        <View style={[ui.row,{marginTop:12,justifyContent:'flex-end'}]}>
          <Pressable style={ui.secondary} onPress={()=>{setEditing(item);setEditDraft({tx_date:item.tx_date,amount:String(item.amount),merchant_name:item.merchant_name,final_category:item.final_category});}}>
            <View style={ui.row}><Pencil size={14} color={palette.ink}/><Text style={ui.buttonText}>수정</Text></View></Pressable>
          <Pressable disabled={Boolean(deleting)} style={ui.secondary} onPress={()=>deleteEntry(item)}>
            <View style={ui.row}><Trash2 size={14} color={palette.danger}/><Text style={ui.dangerText}>삭제</Text></View></Pressable>
        </View>
      </View>) : <View style={ui.card}><Text style={ui.muted}>아직 기록된 지출이 없어요.</Text></View>
      : categories.length ? categories.map(category=>{
        const spent = spendByCategory.get(category.category_name) || 0;
        const ratio = category.budget_limit ? spent / category.budget_limit : 0;
        return <View key={category.id} style={ui.card}>
          <View style={[ui.row,{justifyContent:'space-between'}]}><View style={{flex:1}}><Text style={ui.heading}>{category.category_name}</Text>
            <Text style={ui.muted}>{money(spent)} / {money(category.budget_limit)} · {Math.round(ratio*100)}% 사용</Text></View>
            <Pressable style={ui.secondary} onPress={()=>editBudget(category)}><Settings2 size={19} color={palette.ink}/></Pressable>
          </View>
          <View style={{height:9,backgroundColor:palette.border,borderRadius:7,marginTop:14,overflow:'hidden'}}>
            <View style={{width:`${Math.min(100,Math.max(0,ratio*100))}%` as `${number}%`,height:'100%',backgroundColor:ratio>1?palette.danger:palette.butter}}/>
          </View>
          <Text style={[ui.muted,{marginTop:8}]}>{ratio>1?'예산 초과: 예산 재설정을 검토해 주세요.':category.is_daily_challenge?'데일리 챌린지 대상':'챌린지 제외'}</Text>
        </View>;
      }) : <View style={ui.card}><Text style={ui.muted}>설정된 카테고리가 없어요.</Text></View>}
    </ScrollView>
    <Modal transparent animationType="fade" visible={Boolean(editing)} onRequestClose={()=>setEditing(null)}>
      <View style={{flex:1,justifyContent:'center',backgroundColor:'#0009',padding:16}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.card,{maxWidth:540,width:'100%',alignSelf:'center'}]}>
        <View style={[ui.row,{justifyContent:'space-between'}]}><Text style={ui.heading}>지출 수정</Text><Pressable onPress={()=>setEditing(null)}><X color={palette.ink} size={20}/></Pressable></View>
        <Text style={ui.muted}>날짜</Text><TransactionDatePicker value={editDraft.tx_date} onChange={tx_date=>setEditDraft(old=>({...old,tx_date}))}/>
        <Text style={ui.muted}>금액</Text><TextInput keyboardType="numeric" style={ui.input} value={editDraft.amount} onChangeText={amount=>setEditDraft(old=>({...old,amount}))}/>
        <Text style={ui.muted}>결제처</Text><TextInput style={ui.input} value={editDraft.merchant_name} onChangeText={merchant_name=>setEditDraft(old=>({...old,merchant_name}))}/>
        <Text style={ui.muted}>카테고리</Text>{categoryPills(editDraft.final_category,final_category=>setEditDraft(old=>({...old,final_category})))}
        <Pressable style={ui.button} disabled={saving} onPress={()=>void saveEdit()}><Text style={ui.buttonText}>저장</Text></Pressable>
      </ScrollView></View>
    </Modal>
    <Modal transparent animationType="fade" visible={Boolean(budgetCategory)} onRequestClose={()=>setBudgetCategory(null)}>
      <View style={{flex:1,justifyContent:'center',backgroundColor:'#0009',padding:16}}><View style={[ui.card,{maxWidth:540,width:'100%',alignSelf:'center'}]}>
        <View style={[ui.row,{justifyContent:'space-between'}]}><Text style={ui.heading}>{budgetCategory?.category_name} 예산 설정</Text><Pressable onPress={()=>setBudgetCategory(null)}><X color={palette.ink} size={20}/></Pressable></View>
        <Text style={ui.muted}>월 예산 (원)</Text><TextInput style={ui.input} value={budgetDraft.budget_limit} keyboardType="numeric" onChangeText={budget_limit=>setBudgetDraft(old=>({...old,budget_limit}))}/>
        <Text style={ui.muted}>알림 기준 (0~100%)</Text><TextInput style={ui.input} value={budgetDraft.alert_threshold} keyboardType="numeric" onChangeText={alert_threshold=>setBudgetDraft(old=>({...old,alert_threshold}))}/>
        <View style={[ui.row,{justifyContent:'space-between',marginVertical:10}]}><Text style={ui.text}>데일리 챌린지에 포함</Text>
          <Switch value={budgetDraft.is_daily_challenge} onValueChange={is_daily_challenge=>setBudgetDraft(old=>({...old,is_daily_challenge}))}/></View>
        <Pressable style={ui.button} disabled={saving} onPress={()=>void saveBudget()}><Text style={ui.buttonText}>설정 저장</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}
