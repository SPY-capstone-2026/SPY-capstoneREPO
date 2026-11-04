import { useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronUp, FileSpreadsheet, Upload, X } from 'lucide-react-native';
import { useToast } from '@/contexts/ToastContext';
import { palette, useMoniUi } from '@/constants/moniTheme';
import { useMoniTheme } from '@/contexts/MoniThemeContext';
import { confirmTransactionImport, previewTransactionFile } from '@/services/transactionImportApi';
import type { ImportPreview, PreviewRow } from '@/types/transactionImport';

type Props = { categories: string[]; onImported: () => Promise<void> | void };
const money = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

/** UI name is retained for compatibility with existing transactions.tsx imports. */
export function CsvImportCard({ categories, onImported }: Props) {
  const { showToast } = useToast();
  const { theme } = useMoniTheme();
  const themedUi = useMoniUi();
  const [fileName,setFileName] = useState('');
  const [preview,setPreview] = useState<ImportPreview|null>(null);
  const [excludedOpen,setExcludedOpen] = useState(false);
  const [categoryOpen,setCategoryOpen] = useState<string|null>(null);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const busy = useRef(false);
  const allowed = useMemo(()=>new Set(categories),[categories.join('\u0000')]);
  const selected = preview?.rows.filter(row=>row.selected)??[];
  const missingCategory = selected.some(row=>!row.final_category || !allowed.has(row.final_category));

  const chooseFile = () => {
    if (Platform.OS!=='web') { showToast('현재 파일 등록은 웹에서 사용할 수 있습니다.'); return; }
    if (busy.current) return;
    const doc=(globalThis as {document?:Document}).document;
    if(!doc){showToast('파일 선택을 지원하지 않는 환경입니다.');return;}
    const input=doc.createElement('input');
    input.type='file'; input.accept='.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.onchange=()=>{
      const file=input.files?.item(0);
      if(!file)return;
      if(file.size>15*1024*1024){showToast('파일은 최대 15MB까지 선택할 수 있습니다.');return;}
      if(!/\.(csv|xlsx|xls)$/i.test(file.name)){showToast('CSV 또는 Excel 파일을 선택해 주세요.');return;}
      void (async()=>{
        try {
          busy.current=true;setLoading(true);
          const result=await previewTransactionFile(file);
          // A suggestion not in the user's actual categories is intentionally not auto-selected.
          setPreview({ ...result, rows:result.rows.map(row=>({
            ...row,final_category:allowed.has(row.final_category)?row.final_category:'',
          })) });
          setFileName(file.name);
          setExcludedOpen(false);setCategoryOpen(null);
        } catch(error) {showToast(error instanceof Error?error.message:'파일 내용을 확인하지 못했습니다.');}
        finally {busy.current=false;setLoading(false);}
      })();
    };
    input.click();
  };
  const update = (key:string, fn:(row:PreviewRow)=>PreviewRow) => setPreview(old=>old?{
    ...old,rows:old.rows.map(row=>row.key===key?fn(row):row),
  }:old);
  const confirm=async()=>{
    if(!preview||!selected.length||missingCategory||busy.current)return;
    try {
      busy.current=true;setSaving(true);
      const result=await confirmTransactionImport(preview,selected);
      setPreview(null);setFileName('');
      try {await onImported();} catch {showToast('등록은 완료됐지만 목록 새로고침에 실패했습니다.');return;}
      showToast(`${result.imported}건 등록 · 중복 ${result.duplicateSkipped}건 건너뜀`);
    } catch(error) {showToast(error instanceof Error?error.message:'거래내역 등록에 실패했습니다.');}
    finally {busy.current=false;setSaving(false);}
  };
  return <>
    <Pressable accessibilityRole="button" disabled={loading||saving} onPress={chooseFile} style={[themedUi.card,styles.entry,{backgroundColor:theme.subtle}]}>
      <FileSpreadsheet size={22} color={theme.deep}/>
      <View style={{flex:1}}>
        <Text style={[themedUi.heading,{marginBottom:3}]}>파일로 소비내역 등록</Text>
        <Text style={themedUi.muted}>엑셀 · CSV</Text>
      </View>
      <Upload color={theme.deep} size={19}/>
    </Pressable>
    {loading&&<Text style={[themedUi.muted,{marginBottom:12}]}>파일을 분석하고 있습니다...</Text>}
    <Modal visible={preview!==null} transparent animationType="fade" onRequestClose={()=>!saving&&setPreview(null)}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={[themedUi.row,{justifyContent:'space-between',marginBottom:5}]}>
            <View style={{flex:1,minWidth:0}}><Text style={themedUi.heading} numberOfLines={1}>{fileName}</Text><Text style={themedUi.muted}>등록 전 내용을 확인하세요.</Text></View>
            <Pressable disabled={saving} onPress={()=>setPreview(null)} accessibilityLabel="미리보기 닫기"><X size={21} color={palette.ink}/></Pressable>
          </View>
          <View style={[themedUi.row,{marginBottom:12,flexWrap:'wrap'}]}>
            <Text style={themedUi.muted}>선택 {selected.length}건</Text>
            <Text style={themedUi.muted}>제외 {preview?.excluded.length??0}건</Text>
            {preview?.duplicateCount? <Text style={themedUi.muted}>중복 {preview.duplicateCount}건</Text>:null}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:16}} showsVerticalScrollIndicator={false}>
            {preview?.rows.length ? preview.rows.map(row=><View key={row.key} style={[styles.rowCard,{backgroundColor:row.selected?theme.soft:theme.surface}]}>
              <View style={[themedUi.row,{alignItems:'flex-start'}]}>
                <Pressable onPress={()=>update(row.key,r=>({...r,selected:!r.selected}))} accessibilityRole="checkbox" accessibilityState={{checked:row.selected}}
                  style={[styles.checkbox,{backgroundColor:row.selected?theme.accent:theme.soft}]}>
                  {row.selected&&<Check size={16} color={palette.ink} strokeWidth={3}/>}</Pressable>
                <View style={{flex:1,minWidth:0}}>
                  <Text style={[themedUi.text,{fontWeight:'700'}]}>{row.merchant_name || '거래처 정보 없음'}</Text>
                  <Text style={themedUi.muted}>{row.tx_date}{row.tx_time?` · ${row.tx_time}`:''}</Text>
                  {row.memo?<Text style={[themedUi.muted,{marginTop:4}]}>{row.memo}</Text>:null}
                </View>
                <Text style={[themedUi.text,{fontWeight:'800'}]}>{money(row.amount)}</Text>
              </View>
              <View style={{marginLeft:38,marginTop:9}}>
                <Pressable onPress={()=>setCategoryOpen(categoryOpen===row.key?null:row.key)} style={[styles.categoryChip,{backgroundColor:row.final_category?theme.soft:theme.subtle}]}>
                  <Text style={[themedUi.buttonText,{color:theme.deep}]}>{row.final_category||'카테고리 선택 필요'}</Text>
                  <ChevronDown size={15} color={theme.deep}/>
                </Pressable>
                {categoryOpen===row.key&&<View style={[themedUi.rowWrap,{marginTop:8}]}>
                  {categories.map(category=><Pressable key={category} onPress={()=>{update(row.key,r=>({...r,final_category:category}));setCategoryOpen(null);}}
                    style={[styles.categoryChip,{backgroundColor:row.final_category===category?theme.accent:theme.subtle}]}>
                    <Text style={themedUi.buttonText}>{category}</Text>
                  </Pressable>)}
                </View>}
                {row.suggested_category&&<Text style={[themedUi.muted,{marginTop:6}]}>추천: {row.suggested_category}</Text>}
              </View>
            </View>) : <Text style={[themedUi.muted,{marginBottom:12}]}>등록 가능한 지출 내역이 없습니다.</Text>}
            {preview?.excluded.length ? <View style={{marginTop:12}}>
              <Pressable onPress={()=>setExcludedOpen(v=>!v)} style={[themedUi.row,{justifyContent:'space-between',backgroundColor:theme.soft,padding:12,borderRadius:13}]}>
                <Text style={themedUi.heading}>제외된 항목 {preview.excluded.length}건</Text>
                {excludedOpen?<ChevronUp size={18} color={palette.ink}/>:<ChevronDown size={18} color={palette.ink}/>}
              </Pressable>
              {excludedOpen&&preview.excluded.map(item=><View key={`${item.key}:${item.sourceIndex}`} style={{paddingVertical:9,paddingHorizontal:5}}>
                <Text style={themedUi.text}>{item.merchant_name||`${item.sourceIndex}행`}{item.amount?` · ${money(item.amount)}`:''}</Text>
                <Text style={[themedUi.muted,{color:theme.deep}]}>{item.reason}</Text>
              </View>)}
            </View>:null}
          </ScrollView>
          {missingCategory&&<Text style={[themedUi.dangerText,{marginBottom:8}]}>선택한 거래의 카테고리를 모두 지정해 주세요.</Text>}
          <View style={[themedUi.row,{justifyContent:'flex-end'}]}>
            <Pressable disabled={saving} onPress={()=>setPreview(null)} style={themedUi.secondary}><Text style={themedUi.buttonText}>닫기</Text></Pressable>
            <Pressable disabled={!selected.length||missingCategory||saving} onPress={()=>void confirm()}
              style={[themedUi.button,{backgroundColor:theme.accent,opacity:(!selected.length||missingCategory||saving)?0.4:1,flexShrink:1}]}>
              <Text style={themedUi.buttonText}>{saving?'등록 중':`${selected.length}건 등록`}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}
const styles=StyleSheet.create({
  entry:{flexDirection:'row',alignItems:'center',gap:13},
  backdrop:{flex:1,justifyContent:'center',backgroundColor:'#0009',padding:12},
  modal:{width:'100%',maxWidth:720,maxHeight:'94%',alignSelf:'center',backgroundColor:'#FFFFFF',borderRadius:20,padding:17},
  rowCard:{borderRadius:15,padding:12,marginBottom:9},
  checkbox:{height:25,width:25,borderRadius:8,justifyContent:'center',alignItems:'center',marginTop:2},
  categoryChip:{minHeight:31,borderRadius:99,paddingHorizontal:11,paddingVertical:6,alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6},
});
