import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import {
  BarChart3,
  ClipboardCheck,
  Home,
  ReceiptText,
  UserRound,
} from 'lucide-react-native';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typography } from '@/constants/typography';

type TabMeta = {
  label: string;
  Icon: LucideIcon;
};

const TAB_META: Record<string, TabMeta> = {
  home: { label: '홈', Icon: Home },
  challenge: { label: '챌린지', Icon: ClipboardCheck },
  transactions: { label: '소비', Icon: ReceiptText },
  report: { label: '리포트', Icon: BarChart3 },
  mypage: { label: '마이', Icon: UserRound },
};

const TAB_ORDER = [
  'home',
  'challenge',
  'transactions',
  'report',
  'mypage',
];

const BAR_BACKGROUND = '#211B16';
const ACTIVE_BACKGROUND = '#FFFDF8';
const ACTIVE_FOREGROUND = '#211B16';
const INACTIVE_FOREGROUND = '#8E8378';

const BAR_HORIZONTAL_PADDING = 9;
const INDICATOR_HEIGHT = 44;

export function AppTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;

  const visibleRoutes = useMemo(
    () =>
      [...state.routes]
        .filter((route) => TAB_META[route.name])
        .sort(
          (a, b) =>
            TAB_ORDER.indexOf(a.name) - TAB_ORDER.indexOf(b.name)
        ),
    [state.routes]
  );

  const activeVisibleIndex = useMemo(
    () =>
      visibleRoutes.findIndex((route) => {
        const routeIndex = state.routes.findIndex(
          (item) => item.key === route.key
        );
        return routeIndex === state.index;
      }),
    [state.index, state.routes, visibleRoutes]
  );

  const layout = useMemo(() => {
    if (barWidth <= 0 || visibleRoutes.length === 0) {
      return {
        tabWidth: 0,
        indicatorWidth: 0,
      };
    }

    const innerWidth = barWidth - BAR_HORIZONTAL_PADDING * 2;
    const tabWidth = innerWidth / visibleRoutes.length;
    const indicatorWidth = Math.max(
      58,
      Math.min(88, tabWidth - 4)
    );

    return {
      tabWidth,
      indicatorWidth,
    };
  }, [barWidth, visibleRoutes.length]);

  useEffect(() => {
    if (
      layout.tabWidth <= 0 ||
      layout.indicatorWidth <= 0 ||
      activeVisibleIndex < 0
    ) {
      return;
    }

    const targetX =
      BAR_HORIZONTAL_PADDING +
      activeVisibleIndex * layout.tabWidth +
      (layout.tabWidth - layout.indicatorWidth) / 2;

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: targetX,
        stiffness: 330,
        damping: 24,
        mass: 0.72,
        overshootClamping: false,
        restDisplacementThreshold: 0.2,
        restSpeedThreshold: 0.2,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleX, {
            toValue: 1.12,
            duration: 85,
            useNativeDriver: true,
          }),
          Animated.timing(scaleY, {
            toValue: 0.92,
            duration: 85,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(scaleX, {
            toValue: 1,
            stiffness: 420,
            damping: 18,
            mass: 0.55,
            useNativeDriver: true,
          }),
          Animated.spring(scaleY, {
            toValue: 1,
            stiffness: 420,
            damping: 18,
            mass: 0.55,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [
    activeVisibleIndex,
    layout.indicatorWidth,
    layout.tabWidth,
    scaleX,
    scaleY,
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
      <View
        style={styles.bar}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth !== barWidth) {
            setBarWidth(nextWidth);
          }
        }}
      >
        {layout.indicatorWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeIndicator,
              {
                width: layout.indicatorWidth,
                transform: [
                  { translateX },
                  { scaleX },
                  { scaleY },
                ],
              },
            ]}
          />
        ) : null}

        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex(
            (item) => item.key === route.key
          );
          const isFocused = routeIndex === state.index;
          const meta = TAB_META[route.name];
          const Icon = meta.Icon;
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
                // Haptics can be unavailable on web.
              }

              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={
                isFocused ? { selected: true } : {}
              }
              accessibilityLabel={
                descriptor.options.tabBarAccessibilityLabel
              }
              testID={descriptor.options.tabBarButtonTestID}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                pressed && styles.tabPressed,
              ]}
            >
              <View
                style={[
                  styles.tabContent,
                  isFocused && styles.tabContentFocused,
                ]}
              >
                <Icon
                  size={isFocused ? 17 : 21}
                  strokeWidth={isFocused ? 2.7 : 2.25}
                  color={
                    isFocused
                      ? ACTIVE_FOREGROUND
                      : INACTIVE_FOREGROUND
                  }
                />

                {isFocused ? (
                  <Text
                    numberOfLines={1}
                    style={styles.activeLabel}
                  >
                    {meta.label}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
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
    alignItems: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'transparent',
  },
  bar: {
    position: 'relative',
    width: '100%',
    maxWidth: 560,
    minHeight: 70,
    borderRadius: 35,
    backgroundColor: BAR_BACKGROUND,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_HORIZONTAL_PADDING,
    paddingVertical: 9,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 9,
    overflow: 'hidden',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 13,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
    backgroundColor: ACTIVE_BACKGROUND,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabPressed: {
    opacity: 0.72,
  },
  tabContent: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  tabContentFocused: {
    minWidth: 58,
  },
  activeLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '900',
    color: ACTIVE_FOREGROUND,
  },
});
