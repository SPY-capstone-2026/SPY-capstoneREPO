import {
  Bus,
  Coffee,
  CreditCard,
  LucideIcon,
  PiggyBank,
  ShoppingBag,
  Soup,
  WalletCards,
} from 'lucide-react-native';

export type CategoryMeta = {
  label: string;
  Icon: LucideIcon;
  description: string;
};

export function getCategoryMeta(categoryName: string): CategoryMeta {
  if (categoryName.includes('카페')) {
    return {
      label: '카페',
      Icon: Coffee,
      description: '커피, 음료, 디저트 소비',
    };
  }

  if (categoryName.includes('식비')) {
    return {
      label: '식비',
      Icon: Soup,
      description: '식사와 외식 소비',
    };
  }

  if (categoryName.includes('쇼핑')) {
    return {
      label: '쇼핑',
      Icon: ShoppingBag,
      description: '옷, 잡화, 온라인 쇼핑',
    };
  }

  if (categoryName.includes('교통')) {
    return {
      label: '교통',
      Icon: Bus,
      description: '대중교통, 택시, 이동 비용',
    };
  }

  if (categoryName.includes('예산')) {
    return {
      label: '예산',
      Icon: PiggyBank,
      description: '월별 소비 목표',
    };
  }

  if (categoryName.includes('카드')) {
    return {
      label: '카드',
      Icon: CreditCard,
      description: '카드 결제 내역',
    };
  }

  return {
    label: categoryName,
    Icon: WalletCards,
    description: '소비 항목',
  };
}