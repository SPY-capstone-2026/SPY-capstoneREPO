import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import {
  BarChart3,
  ClipboardCheck,
  Home,
  ReceiptText,
  UserRound,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

type TabMeta = {
  label: string;
  Icon: LucideIcon;
};

const TAB_META: Record<string, TabMeta> = {
  home: {
    label: '홈',
    Icon: Home,
  },
  challenge: {
    label: '챌린지',
    Icon: ClipboardCheck,
  },
  report: {
    label: '리포트',
    Icon: BarChart3,
  },
  transactions: {
    label: '소비',
    Icon: ReceiptText,
  },
  mypage: {
    label: '마이',
    Icon: UserRound,
  },
};

const TAB_ORDER = ['home', 'challenge', 'report', 'transactions', 'mypage'];

const BAR_SIDE_PADDING = 6;
const INDICATOR_SIDE_GAP = 5;

export function JellyTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [innerWidth, setInnerWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;

  const visibleRoutes = useMemo(() => {
    return [...state.routes]
      .filter((route) => TAB_META[route.name])
      .sort((a, b) => TAB_ORDER.indexOf(a.name) - TAB_ORDER.indexOf(b.name));
  }, [state.routes]);

  const selectedRoute = state.routes[state.index];

  const selectedVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => route.key === selectedRoute?.key)
  );

  const usableWidth = Math.max(innerWidth - BAR_SIDE_PADDING * 2, 0);

  const tabWidth =
    visibleRoutes.length > 0 && usableWidth > 0
      ? usableWidth / visibleRoutes.length
      : 0;

  const indicatorWidth = Math.max(tabWidth - INDICATOR_SIDE_GAP * 2, 0);

  useEffect(() => {
    if (!tabWidth || !indicatorWidth) return;

    const targetX =
      BAR_SIDE_PADDING +
      selectedVisibleIndex * tabWidth +
      (tabWidth - indicatorWidth) / 2;

    Animated.timing(translateX, {
      toValue: targetX,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [
    indicatorWidth,
    selectedVisibleIndex,
    tabWidth,
    translateX,
  ]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <View style={styles.shell}>
        <View
          style={styles.inner}
          onLayout={(event) => setInnerWidth(event.nativeEvent.layout.width)}
        >
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                {
                  width: indicatorWidth,
                  transform: [{ translateX }],
                },
              ]}
            />
          ) : null}

          {visibleRoutes.map((route) => {
            const meta = TAB_META[route.name];
            const Icon = meta.Icon;

            const routeIndex = state.routes.findIndex(
              (item) => item.key === route.key
            );

            const isFocused = state.index === routeIndex;
            const descriptor = descriptors[route.key];

            const onPress = async () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                try {
                  await Haptics.selectionAsync();
                } catch {
                  // Web 환경에서는 haptic이 동작하지 않을 수 있습니다.
                }

                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
                testID={descriptor.options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tabButton}
              >
                <Icon
                  size={21}
                  strokeWidth={isFocused ? 3 : 2.4}
                  color={isFocused ? colors.text : colors.mutedText}
                />

                <Text
                  style={[
                    styles.tabLabel,
                    isFocused && styles.activeTabLabel,
                  ]}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  shell: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 4,
  },
  inner: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: BAR_SIDE_PADDING,
    paddingVertical: 6,
  },
  indicator: {
    position: 'absolute',
    top: 7,
    bottom: 7,
    left: 0,
    borderRadius: 19,
    backgroundColor: colors.butterStrong,
    borderWidth: 1,
    borderColor: colors.butterSoft,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 0,
  },
  tabButton: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 2,
  },
  tabLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '800',
    color: colors.mutedText,
    letterSpacing: -0.1,
  },
  activeTabLabel: {
    color: colors.text,
    fontWeight: '900',
  },
});