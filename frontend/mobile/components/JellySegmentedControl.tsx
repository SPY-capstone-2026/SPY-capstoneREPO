import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CircleDollarSign,
  Coffee,
  LucideIcon,
  Shirt,
  Utensils,
} from 'lucide-react-native';

import { colors } from '@/constants/colors';
import { jellyMotion } from '@/constants/motion';
import { typography } from '@/constants/typography';

type JellySegmentedControlProps = {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

function getCategoryIcon(categoryName: string): LucideIcon {
  if (categoryName === '카페') return Coffee;
  if (categoryName === '식비') return Utensils;
  if (categoryName === '의류') return Shirt;

  return CircleDollarSign;
}

export function JellySegmentedControl({
  items,
  selectedIndex,
  onChange,
}: JellySegmentedControlProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const blobOpacity = useRef(new Animated.Value(1)).current;
  const shineOpacity = useRef(new Animated.Value(0.62)).current;

  const segmentWidth = containerWidth / items.length;
  const blobSize = 58;

  useEffect(() => {
    if (!containerWidth || !segmentWidth) return;

    const targetX =
      selectedIndex * segmentWidth + segmentWidth / 2 - blobSize / 2;

    translateX.stopAnimation();
    scaleX.stopAnimation();
    scaleY.stopAnimation();
    blobOpacity.stopAnimation();
    shineOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: targetX,
        duration: jellyMotion.moveDuration,
        easing: jellyMotion.moveEasing,
        useNativeDriver: true,
      }),

      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleX, {
            toValue: jellyMotion.stretchX,
            duration: jellyMotion.stretchDuration,
            easing: jellyMotion.stretchEasing,
            useNativeDriver: true,
          }),
          Animated.timing(scaleY, {
            toValue: jellyMotion.stretchY,
            duration: jellyMotion.stretchDuration,
            easing: jellyMotion.stretchEasing,
            useNativeDriver: true,
          }),
          Animated.timing(blobOpacity, {
            toValue: 0.95,
            duration: jellyMotion.stretchDuration,
            easing: jellyMotion.stretchEasing,
            useNativeDriver: true,
          }),
        ]),

        Animated.parallel([
          Animated.spring(scaleX, {
            toValue: 1,
            damping: 16,
            stiffness: 280,
            mass: 0.4,
            useNativeDriver: true,
          }),
          Animated.spring(scaleY, {
            toValue: 1,
            damping: 16,
            stiffness: 280,
            mass: 0.4,
            useNativeDriver: true,
          }),
          Animated.timing(blobOpacity, {
            toValue: 1,
            duration: jellyMotion.restoreDuration,
            easing: jellyMotion.restoreEasing,
            useNativeDriver: true,
          }),
        ]),
      ]),

      Animated.sequence([
        Animated.timing(shineOpacity, {
          toValue: 0.88,
          duration: 82,
          easing: jellyMotion.stretchEasing,
          useNativeDriver: true,
        }),
        Animated.timing(shineOpacity, {
          toValue: 0.62,
          duration: 135,
          easing: jellyMotion.restoreEasing,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    blobOpacity,
    containerWidth,
    segmentWidth,
    selectedIndex,
    shineOpacity,
    scaleX,
    scaleY,
    translateX,
  ]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={styles.containerLight} />

      {containerWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.jellyBlob,
            {
              width: blobSize,
              height: blobSize,
              opacity: blobOpacity,
              transform: [{ translateX }, { scaleX }, { scaleY }],
            },
          ]}
        >
          <View style={styles.blobDiffuseLight} />
          <Animated.View
            style={[
              styles.blobMainShine,
              {
                opacity: shineOpacity,
              },
            ]}
          />
          <View style={styles.blobBottomLight} />
        </Animated.View>
      ) : null}

      {items.map((item, index) => {
        const isSelected = selectedIndex === index;
        const Icon = getCategoryIcon(item);

        return (
          <Pressable
            key={item}
            style={styles.segment}
            onPress={() => onChange(index)}
          >
            <View style={styles.iconWrap}>
              <Icon
                size={22}
                strokeWidth={isSelected ? 2.75 : 2.15}
                color={isSelected ? colors.text : colors.mutedText}
              />
            </View>

            <Text
              style={[
                styles.segmentText,
                isSelected && styles.selectedSegmentText,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 78,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',

    shadowColor: '#C69B00',
    shadowOpacity: 0.13,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  containerLight: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 8,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  jellyBlob: {
    position: 'absolute',
    left: 0,
    top: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 201, 76, 0.86)',

    shadowColor: '#D9A900',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  blobDiffuseLight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 201, 76, 0.82)',
  },
  blobMainShine: {
    position: 'absolute',
    top: 10,
    left: 13,
    width: 22,
    height: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
  },
  blobBottomLight: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  segment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconWrap: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  segmentText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.subText,
  },
  selectedSegmentText: {
    color: colors.text,
  },
});