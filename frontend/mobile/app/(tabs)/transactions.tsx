import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Check, Pencil, Plus, ReceiptText, Settings2, Trash2, X } from 'lucide-react-native';
import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/services/apiClient';
import { CsvImportCard } from '@/components/CsvImportCard';
import { TransactionDatePicker } from '@/components/TransactionDatePicker';
import { palette, useMoniUi } from '@/constants/moniTheme';
import { useMoniTheme } from '@/contexts/MoniThemeContext';
import type { ApiCategorySetting, CategoriesResponse, TransactionsResponse } from '@/types/api';
import type { TransactionWithImport } from '@/types/transactionImport';

type Draft = { tx_date: string; amount: string; merchant_name: string; final_category: string; memo: string };
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
  const { theme } = useMoniTheme();
  const themedUi = useMoniUi();
  const [transactions, setTransactions] = useState<TransactionWithImport[]>([]);
  const [categories, setCategories] = useState<ApiCategorySetting[]>([]);
  const [section, setSection] = useState<'spend' | 'budget'>('spend');
  const [draft, setDraft] = useState<Draft>({tx_date:today(),amount:'',merchant_name:'',final_category:'',memo:''});
  const [editing, setEditing] = useState<TransactionWithImport | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({tx_date:today(),amount:'',merchant_name:'',final_category:'',memo:''});
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
      setTransactions((t.data || []) as TransactionWithImport[]); setCategories(c.data || []);
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
    if (!validDate(value.tx_date) || !Number.isInteger(amount) || amount <= 0 || !value.merchant_name.trim()) {
      showToast('날짜·금액·결제처·카테고리를 확인해 주세요.'); return null;
    }
    return {tx_date:value.tx_date,amount,merchant_name:value.merchant_name.trim(),final_category:value.final_category,memo:value.memo.trim(),is_user_corrected:Boolean(value.final_category)};
  };
  const create = async () => {
    if (saving) return; const body = validate(draft); if (!body) return;
    try { setSaving(true); await apiRequest({path:'/transactions',method:'POST',body,auth:true});
      setDraft(old=>({...old,amount:'',merchant_name:'',memo:''})); showToast('지출을 기록했어요.'); await load();
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
  const performDelete = async (entry: TransactionWithImport) => {
    if (deleting) return;
    try { setDeleting(entry.tx_id); await apiRequest({path:`/transactions/${encodeURIComponent(entry.tx_id)}`,method:'DELETE',auth:true});
      showToast('지출을 삭제했어요.'); await load();
    } catch(error) { showToast(error instanceof Error ? error.message : '지출 삭제에 실패했어요.'); }
    finally { setDeleting(null); }
  };
  const deleteEntry = (entry: TransactionWithImport) => {
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
  const categoryPills = (value: string, update: (name: string) => void, autoAllowed=false) => <View style={[themedUi.rowWrap,{marginBottom:12}]}>
    {autoAllowed&&<Pressable onPress={()=>update('')} style={[value===''?themedUi.button:themedUi.secondary,value===''&&{backgroundColor:theme.accent}]}><Text style={themedUi.buttonText}>자동 분류</Text></Pressable>}
    {categories.map(c=><Pressable key={c.id} onPress={()=>update(c.category_name)} style={[value===c.category_name?themedUi.button:themedUi.secondary,value===c.category_name&&{backgroundColor:theme.accent}]}>
      <Text style={themedUi.buttonText}>{c.category_name}</Text>
    </Pressable>)}
  </View>;
  return <View style={themedUi.screen}>
    <ScrollView contentContainerStyle={themedUi.scroll} keyboardShouldPersistTaps="handled">
      <Text style={themedUi.title}>소비 기록</Text>
      <Text style={themedUi.subtitle}>새 지출을 기록하거나 CSV·엑셀 파일을 등록할 수 있어요.</Text>
      <View style={[themedUi.card,{backgroundColor:theme.surface}]}>
        <View style={themedUi.row}><Plus size={18} color={palette.ink}/><Text style={themedUi.heading}>새 지출</Text></View>
        <Text style={themedUi.muted}>날짜</Text>
        <TransactionDatePicker value={draft.tx_date} onChange={tx_date=>setDraft(old=>({...old,tx_date}))}/>
        <Text style={themedUi.muted}>금액 (원)</Text>
        <TextInput style={themedUi.input} keyboardType="numeric" value={draft.amount} onChangeText={amount=>setDraft(old=>({...old,amount}))} placeholder="예: 4500"/>
        <Text style={themedUi.muted}>결제처</Text>
        <TextInput style={themedUi.input} value={draft.merchant_name} onChangeText={merchant_name=>setDraft(old=>({...old,merchant_name}))} placeholder="예: 카페"/>
        <Text style={themedUi.muted}>카테고리</Text>{categoryPills(draft.final_category, final_category=>setDraft(old=>({...old,final_category})),true)}
        <Text style={themedUi.muted}>메모 (선택)</Text><TextInput style={themedUi.input} value={draft.memo} onChangeText={memo=>setDraft(old=>({...old,memo}))} placeholder="메모를 입력해 주세요"/>
        <Pressable disabled={saving} style={[themedUi.button,{backgroundColor:theme.accent}]} onPress={()=>void create()}><View style={themedUi.row}><Check size={17} color={palette.ink}/><Text style={themedUi.buttonText}>{saving?'저장 중':'기록하기'}</Text></View></Pressable>
      </View>
      <CsvImportCard categories={categories.map(c=>c.category_name)} onImported={load}/>
      <View style={[themedUi.row,{marginVertical:10,flexWrap:'wrap'}]}>
        <Pressable style={[section==='spend'?themedUi.button:themedUi.secondary,section==='spend'&&{backgroundColor:theme.accent}]} onPress={()=>setSection('spend')}><Text style={themedUi.buttonText}>최근 지출</Text></Pressable>
        <Pressable style={[section==='budget'?themedUi.button:themedUi.secondary,section==='budget'&&{backgroundColor:theme.accent}]} onPress={()=>setSection('budget')}><Text style={themedUi.buttonText}>항목별 예산</Text></Pressable>
      </View>
      {loading && <Text style={themedUi.muted}>불러오는 중...</Text>}
      {section==='spend' ? sorted.length ? sorted.slice(0,100).map(item=><View key={item.tx_id} style={themedUi.card}>
        <View style={[themedUi.row,{justifyContent:'space-between'}]}><View style={{flex:1}}>
          <Text style={themedUi.heading}>{item.merchant_name}</Text>
          <Text style={themedUi.muted}>{item.tx_date} · {item.final_category}{item.is_imported?' · 파일 등록':''}</Text>
          {item.memo?<Text style={[themedUi.muted,{marginTop:4}]}>{item.memo}</Text>:null}
        </View><Text style={[themedUi.heading,{marginBottom:0}]}>{money(item.amount)}</Text></View>
        <View style={[themedUi.row,{marginTop:12,justifyContent:'flex-end'}]}>
          <Pressable style={themedUi.secondary} onPress={()=>{setEditing(item);setEditDraft({tx_date:item.tx_date,amount:String(item.amount),merchant_name:item.merchant_name,final_category:item.final_category,memo:item.memo??''});}}>
            <View style={themedUi.row}><Pencil size={14} color={palette.ink}/><Text style={themedUi.buttonText}>수정</Text></View></Pressable>
          <Pressable disabled={Boolean(deleting)} style={themedUi.secondary} onPress={()=>deleteEntry(item)}>
            <View style={themedUi.row}><Trash2 size={14} color={theme.deep}/><Text style={themedUi.dangerText}>삭제</Text></View></Pressable>
        </View>
      </View>) : <View style={themedUi.card}><Text style={themedUi.muted}>아직 기록된 지출이 없어요.</Text></View>
      : categories.length ? categories.map(category=>{
        const spent = spendByCategory.get(category.category_name) || 0;
        const ratio = category.budget_limit ? spent / category.budget_limit : 0;
        return <View key={category.id} style={themedUi.card}>
          <View style={[themedUi.row,{justifyContent:'space-between'}]}><View style={{flex:1}}><Text style={themedUi.heading}>{category.category_name}</Text>
            <Text style={themedUi.muted}>{money(spent)} / {money(category.budget_limit)} · {Math.round(ratio*100)}% 사용</Text></View>
            <Pressable style={themedUi.secondary} onPress={()=>editBudget(category)}><Settings2 size={19} color={palette.ink}/></Pressable>
          </View>
          <View style={{height:9,backgroundColor:theme.soft,borderRadius:7,marginTop:14,overflow:'hidden'}}>
            <View style={{width:`${Math.min(100,Math.max(0,ratio*100))}%` as `${number}%`,height:'100%',backgroundColor:theme.accent}}/>
          </View>
          <Text style={[themedUi.muted,{marginTop:8}]}>{ratio>1?'예산 초과: 예산 재설정을 검토해 주세요.':category.is_daily_challenge?'데일리 챌린지 대상':'챌린지 제외'}</Text>
        </View>;
      }) : <View style={themedUi.card}><Text style={themedUi.muted}>설정된 카테고리가 없어요.</Text></View>}
    </ScrollView>
    <Modal transparent animationType="fade" visible={Boolean(editing)} onRequestClose={()=>setEditing(null)}>
      <View style={{flex:1,justifyContent:'center',backgroundColor:'#0009',padding:16}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[themedUi.card,{maxWidth:540,width:'100%',alignSelf:'center'}]}>
        <View style={[themedUi.row,{justifyContent:'space-between'}]}><Text style={themedUi.heading}>지출 수정</Text><Pressable onPress={()=>setEditing(null)}><X color={palette.ink} size={20}/></Pressable></View>
        <Text style={themedUi.muted}>날짜</Text><TransactionDatePicker value={editDraft.tx_date} onChange={tx_date=>setEditDraft(old=>({...old,tx_date}))}/>
        <Text style={themedUi.muted}>금액</Text><TextInput keyboardType="numeric" style={themedUi.input} value={editDraft.amount} onChangeText={amount=>setEditDraft(old=>({...old,amount}))}/>
        <Text style={themedUi.muted}>결제처</Text><TextInput style={themedUi.input} value={editDraft.merchant_name} onChangeText={merchant_name=>setEditDraft(old=>({...old,merchant_name}))}/>
        <Text style={themedUi.muted}>카테고리</Text>{categoryPills(editDraft.final_category,final_category=>setEditDraft(old=>({...old,final_category})))}
        <Text style={themedUi.muted}>메모 (선택)</Text><TextInput style={themedUi.input} value={editDraft.memo} onChangeText={memo=>setEditDraft(old=>({...old,memo}))} placeholder="내용을 지우면 메모가 삭제됩니다"/>
        <Pressable style={[themedUi.button,{backgroundColor:theme.accent}]} disabled={saving} onPress={()=>void saveEdit()}><Text style={themedUi.buttonText}>저장</Text></Pressable>
      </ScrollView></View>
    </Modal>
    <Modal transparent animationType="fade" visible={Boolean(budgetCategory)} onRequestClose={()=>setBudgetCategory(null)}>
      <View style={{flex:1,justifyContent:'center',backgroundColor:'#0009',padding:16}}><View style={[themedUi.card,{maxWidth:540,width:'100%',alignSelf:'center'}]}>
        <View style={[themedUi.row,{justifyContent:'space-between'}]}><Text style={themedUi.heading}>{budgetCategory?.category_name} 예산 설정</Text><Pressable onPress={()=>setBudgetCategory(null)}><X color={palette.ink} size={20}/></Pressable></View>
        <Text style={themedUi.muted}>월 예산 (원)</Text><TextInput style={themedUi.input} value={budgetDraft.budget_limit} keyboardType="numeric" onChangeText={budget_limit=>setBudgetDraft(old=>({...old,budget_limit}))}/>
        <Text style={themedUi.muted}>알림 기준 (0~100%)</Text><TextInput style={themedUi.input} value={budgetDraft.alert_threshold} keyboardType="numeric" onChangeText={alert_threshold=>setBudgetDraft(old=>({...old,alert_threshold}))}/>
        <View style={[themedUi.row,{justifyContent:'space-between',marginVertical:10}]}><Text style={themedUi.text}>데일리 챌린지에 포함</Text>
          <Switch trackColor={{false:theme.soft,true:theme.accent}} thumbColor={'#FFFFFF'} value={budgetDraft.is_daily_challenge} onValueChange={is_daily_challenge=>setBudgetDraft(old=>({...old,is_daily_challenge}))}/></View>
        <Pressable style={[themedUi.button,{backgroundColor:theme.accent}]} disabled={saving} onPress={()=>void saveBudget()}><Text style={themedUi.buttonText}>설정 저장</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}
