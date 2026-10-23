import { StyleSheet } from 'react-native';
export const palette = { background: '#FFFFFF', surface: '#FFFFFF', soft: '#FFF7DA', butter: '#F2C84B', ink: '#211B16', muted: '#796D5E', border: '#E9E2D6', danger: '#9C4C28' };
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { width: '100%', maxWidth: 740, alignSelf: 'center', padding: 20, paddingBottom: 115 },
  title: { fontSize: 26, fontWeight: '800', color: palette.ink, marginBottom: 8 },
  subtitle: { fontSize: 12, color: palette.muted, lineHeight: 19, marginBottom: 14 },
  card: { borderRadius: 20, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, padding: 16, marginBottom: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  heading: { fontSize: 17, fontWeight: '800', color: palette.ink, marginBottom: 10 },
  text: { fontSize: 13, color: palette.ink },
  muted: { fontSize: 12, lineHeight: 18, color: palette.muted },
  input: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, color: palette.ink, fontSize: 14, marginBottom: 10 },
  button: { backgroundColor: palette.butter, minHeight: 43, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12 },
  secondary: { backgroundColor: '#F4F1EB', minHeight: 43, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12 },
  buttonText: { fontSize: 13, fontWeight: '800', color: palette.ink },
  dangerText: { fontSize: 13, fontWeight: '700', color: palette.danger },
  divider: { borderTopWidth: 1, borderTopColor: palette.border, marginVertical: 12 },
});
