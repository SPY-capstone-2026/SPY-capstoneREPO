/**
 * 탄성 애니메이션이 적용된 가로 스크롤 세그먼트 토글.
 * items 배열을 가로로 나열하고, selectedIndex로 선택 상태를 표시한다.
 * 소비 화면 기간 필터 등에 쓰인다.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type JellySegmentedControlProps = {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

export function JellySegmentedControl({
  items,
  selectedIndex,
  onChange,
}: JellySegmentedControlProps) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {items.map((item, index) => {
          const isSelected = selectedIndex === index;

          return (
            <Pressable
              key={`${item}-${index}`}
              onPress={() => onChange(index)}
              style={[styles.item, isSelected && styles.selectedItem]}
            >
              <Text
                style={[styles.itemText, isSelected && styles.selectedItemText]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  container: {
    gap: 8,
    paddingVertical: 2,
  },
  item: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedItem: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  itemText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
  },
  selectedItemText: {
    color: colors.backgroundWhite,
  },
});