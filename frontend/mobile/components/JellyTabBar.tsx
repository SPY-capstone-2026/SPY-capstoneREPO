import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  BarChart3,
  ClipboardCheck,
  Home,
  LucideIcon,
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
const JELLY_SIDE_GAP = 3;

export function JellyTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [innerWidth, setInnerWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;

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

  const jellyWidth = Math.max(tabWidth - JELLY_SIDE_GAP * 2, 0);

  useEffect(() => {
    if (!tabWidth || !jellyWidth) return;

    const targetX =
      BAR_SIDE_PADDING +
      selectedVisibleIndex * tabWidth +
      (tabWidth - jellyWidth) / 2;

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: targetX,
        damping: 17,
        stiffness: 360,
        mass: 0.42,
        useNativeDriver: true,
      }),

      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleX, {
            toValue: 1.22,
            damping: 11,
            stiffness: 430,
            mass: 0.34,
            useNativeDriver: true,
          }),
          Animated.spring(scaleY, {
            toValue: 0.90,
            damping: 11,
            stiffness: 430,
            mass: 0.34,
            useNativeDriver: true,
          }),
        ]),

        Animated.parallel([
          Animated.spring(scaleX, {
            toValue: 1,
            damping: 20,
            stiffness: 720,
            mass: 0.24,
            useNativeDriver: true,
          }),
          Animated.spring(scaleY, {
            toValue: 1,
            damping: 20,
            stiffness: 720,
            mass: 0.24,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [jellyWidth, scaleX, scaleY, selectedVisibleIndex, tabWidth, translateX]);

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
                styles.jelly,
                {
                  width: jellyWidth,
                  transform: [
                    { translateX },
                    { scaleX },
                    { scaleY },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={['#FFEFA6', '#F6D45A', '#E9BE32']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.jellyFill}
              >
                <View style={styles.jellyLight} />
                <View style={styles.jellyGlow} />
              </LinearGradient>
            </Animated.View>
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
                await Haptics.selectionAsync();
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
                  strokeWidth={isFocused ? 3 : 2.5}
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
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.56)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.13,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  inner: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: BAR_SIDE_PADDING,
    paddingVertical: 6,
  },
  jelly: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  jellyFill: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  jellyLight: {
    position: 'absolute',
    top: 8,
    left: 13,
    width: 34,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  jellyGlow: {
    position: 'absolute',
    right: -12,
    bottom: -16,
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tabButton: {
    flex: 1,
    minHeight: 58,
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