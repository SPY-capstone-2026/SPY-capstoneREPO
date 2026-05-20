import { colors } from '@/constants/colors';

export type BudgetTone = 'success' | 'warning' | 'danger';

export function getBudgetTone(pressure: number): BudgetTone {
  if (pressure >= 1.1) return 'danger';
  if (pressure >= 0.8) return 'warning';
  return 'success';
}

export function getBudgetLabel(pressure: number) {
  if (pressure >= 1.1) return '조절 필요';
  if (pressure >= 0.8) return '주의';
  return '안정';
}

export function getBudgetColor(pressure: number) {
  if (pressure >= 1.1) return colors.dangerText;
  if (pressure >= 0.8) return colors.warningText;
  return colors.successText;
}

export function getBudgetBg(pressure: number) {
  if (pressure >= 1.1) return colors.dangerBg;
  if (pressure >= 0.8) return colors.warningBg;
  return colors.successBg;
}

export function getBudgetSignalText(pressure: number) {
  if (pressure >= 1) {
    return `예산보다 약 ${pressure.toFixed(1)}배 예상`;
  }

  return `예산의 약 ${Math.round(pressure * 100)}% 예상`;
}

export function getFriendlyBudgetMessage(pressure: number) {
  if (pressure >= 1.5) {
    return '이번 달에는 소비 조절이 꼭 필요해 보여요.';
  }

  if (pressure >= 1.1) {
    return '예산을 넘을 가능성이 있어 조금 줄이면 좋아요.';
  }

  if (pressure >= 0.8) {
    return '아직 괜찮지만 조금만 신경 쓰면 더 안정적이에요.';
  }

  return '현재는 안정적으로 관리되고 있어요.';
}