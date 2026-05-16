import { View, Text, StyleSheet } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Moni</Text>
      <Text style={styles.subtitle}>AI 소비 코칭 앱</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘의 소비를 예측하고</Text>
        <Text style={styles.cardText}>
          예산 압박도에 맞춘 개인화 챌린지로 소비 습관을 관리합니다.
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>오늘의 챌린지</Text>
        <Text style={styles.challengeText}>
          오늘 카페 지출 5,000원 이하로 유지하기
        </Text>
        <Text style={styles.rewardText}>성공 시 20 XP 획득</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBF0',
  },
  logo: {
    fontSize: 44,
    fontWeight: '800',
    color: '#222222',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 32,
  },
  card: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D0',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666666',
  },
  infoBox: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#F8E7A2',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A5A00',
    marginBottom: 8,
  },
  challengeText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 8,
  },
  rewardText: {
    fontSize: 14,
    color: '#555555',
  },
});