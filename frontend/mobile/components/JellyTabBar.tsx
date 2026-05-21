import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
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

export function JellyTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const jellyScaleX = useRef(new Animated.Value(1)).current;
  const jellyScaleY = useRef(new Animated.Value(1)).current;

  const visibleRoutes = useMemo(() => {
    return [...state.routes]
      .filter((route) => TAB_META[route.name])
      .sort(
        (a, b) => TAB_ORDER.indexOf(a.name) - TAB_ORDER.indexOf(b.name)
      );
  }, [state.routes]);

  const selectedRoute = state.routes[state.index];

  const selectedVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => route.key === selectedRoute?.key)
  );

  const tabWidth =
    visibleRoutes.length > 0 && barWidth > 0
      ? barWidth / visibleRoutes.length
      : 0;

  useEffect(() => {
    if (!tabWidth) return;

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: selectedVisibleIndex * tabWidth,
        damping: 19,
        stiffness: 210,
        mass: 0.62,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.parallel([
          Animated.spring(jellyScaleX, {
            toValue: 1.14,
            damping: 18,
            stiffness: 260,
            mass: 0.45,
            useNativeDriver: true,
          }),
          Animated.spring(jellyScaleY, {
            toValue: 0.94,
            damping: 18,
            stiffness: 260,
            mass: 0.45,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(jellyScaleX, {
            toValue: 1,
            damping: 17,
            stiffness: 230,
            mass: 0.46,
            useNativeDriver: true,
          }),
          Animated.spring(jellyScaleY, {
            toValue: 1,
            damping: 17,
            stiffness: 230,
            mass: 0.46,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [jellyScaleX, jellyScaleY, selectedVisibleIndex, tabWidth, translateX]);

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
      <BlurView
        intensity={46}
        tint="light"
        style={styles.blurShell}
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      >
        <View style={styles.inner}>
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.jelly,
                {
                  width: tabWidth - 10,
                  transform: [
                    {
                      translateX,
                    },
                    {
                      scaleX: jellyScaleX,
                    },
                    {
                      scaleY: jellyScaleY,
                    },
                  ],
                },
              ]}
            >
              <View style={styles.jellyLight} />
              <View style={styles.jellyGlow} />
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
                accessibilityLabel={
                  descriptor.options.tabBarAccessibilityLabel
                }
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
      </BlurView>
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
  blurShell: {
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.64)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    paddingHorizontal: 5,
    paddingVertical: 6,
  },
  jelly: {
    position: 'absolute',
    left: 5,
    top: 6,
    bottom: 6,
    borderRadius: 25,
    backgroundColor: colors.butterStrong,
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    overflow: 'hidden',
  },
  jellyLight: {
    position: 'absolute',
    top: 9,
    left: 14,
    width: 36,
    height: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  jellyGlow: {
    position: 'absolute',
    right: -14,
    bottom: -18,
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.13)',
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