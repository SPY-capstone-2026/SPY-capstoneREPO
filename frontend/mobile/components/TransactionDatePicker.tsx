import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type Props = { value: string; onChange: (date: string) => void };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parse(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
}

export function TransactionDatePicker({ value, onChange }: Props) {
  const [visible, setVisible] = useState(false);
  const [year, setYear] = useState(() => parse(value).getFullYear());
  const [month, setMonth] = useState(() => parse(value).getMonth());
  useEffect(() => {
    const parsed = parse(value);
    setYear(parsed.getFullYear());
    setMonth(parsed.getMonth());
  }, [value]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1).getDay();
    const last = new Date(year, month + 1, 0).getDate();
    const result: (number | null)[] = Array.from({ length: first }, () => null);
    for (let d = 1; d <= last; d++) result.push(d);
    return result;
  }, [year, month]);

  const shift = (by: number) => {
    const next = new Date(year, month + by, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };
  const pick = (day: number) => {
    onChange(ymd(new Date(year, month, day)));
    setVisible(false);
  };

  return <>
    <Pressable onPress={() => setVisible(true)} style={styles.launch} accessibilityRole="button" accessibilityLabel="거래 날짜 선택">
      <CalendarDays size={16} color={colors.subText} />
      <Text style={styles.launchText}>{value || '날짜 선택'}</Text>
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Pressable style={styles.nav} onPress={() => shift(-1)} accessibilityLabel="이전 달"><ChevronLeft color={colors.text} size={20}/></Pressable>
            <Text style={styles.month}>{year}년 {month + 1}월</Text>
            <Pressable style={styles.nav} onPress={() => shift(1)} accessibilityLabel="다음 달"><ChevronRight color={colors.text} size={20}/></Pressable>
            <Pressable style={styles.close} onPress={() => setVisible(false)} accessibilityLabel="닫기"><X color={colors.text} size={20}/></Pressable>
          </View>
          <View style={styles.days}>
            {WEEKDAYS.map((day) => <View key={day} style={styles.cell}><Text style={styles.weekday}>{day}</Text></View>)}
            {cells.map((day, i) => {
              const date = day ? ymd(new Date(year,month,day)) : '';
              const selected = value === date;
              return <View key={`${year}-${month}-${i}`} style={styles.cell}>
                {day ? <Pressable onPress={() => pick(day)} accessibilityRole="button" accessibilityLabel={date}
                  style={[styles.dayButton, selected && styles.selected]}>
                  <Text style={[styles.dayNumber, selected && styles.selectedText]}>{day}</Text>
                </Pressable> : null}
              </View>;
            })}
          </View>
          <Pressable style={styles.todayButton} onPress={() => { onChange(ymd(new Date())); setVisible(false); }}>
            <Text style={styles.todayLabel}>오늘 날짜 선택</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  launch: { minHeight: 42, flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 8 },
  launchText: { fontFamily: typography.fontFamily, fontSize: 14, color: colors.text },
  backdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.5)' },
  card: { alignSelf: 'center', width: '100%', maxWidth: 380, borderRadius: 20, backgroundColor: colors.surface, padding: 18 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  nav: { padding: 7 }, close: { padding: 7, marginLeft: 4 },
  month: { fontFamily: typography.fontFamily, fontSize: 17, color: colors.text, fontWeight: '900' },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', height: 42, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontSize: 12, color: colors.subText, fontWeight: '800' },
  dayButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  selected: { backgroundColor: colors.butterStrong },
  selectedText: { fontWeight: '900' },
  dayNumber: { fontSize: 13, color: colors.text },
  todayButton: { marginTop: 16, alignSelf: 'center', paddingVertical: 9, paddingHorizontal: 12 },
  todayLabel: { fontSize: 12, fontWeight: '900', color: colors.text },
});
