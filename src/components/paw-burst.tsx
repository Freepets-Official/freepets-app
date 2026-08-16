import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { usePalette } from '@/hooks/use-theme';

/**
 * 성공 순간(판별 가능·리뷰 등록 등) 가운데에서 발자국이 사방으로 퍼졌다 사라지는 축하 효과.
 * 부모(relative) 위에 absoluteFill로 얹고, 마운트되면 한 번 재생된다. 터치는 통과.
 */
const N = 8;

export function PawBurst({ color, size = 20 }: { color?: string; size?: number }) {
  const p = usePalette();
  return (
    <View pointerEvents="none" style={styles.fill}>
      {Array.from({ length: N }).map((_, i) => (
        <BurstPaw key={i} index={i} color={color ?? p.accent} size={size} />
      ))}
    </View>
  );
}

function BurstPaw({ index, color, size }: { index: number; color: string; size: number }) {
  const t = useSharedValue(0);
  const angle = (index / N) * Math.PI * 2;
  const dist = index % 2 === 0 ? 72 : 52;

  useEffect(() => {
    t.value = withTiming(1, { duration: 780, easing: Easing.out(Easing.quad) });
  }, [t]);

  const style = useAnimatedStyle(() => {
    const d = dist * t.value;
    return {
      opacity: interpolate(t.value, [0, 0.2, 1], [0, 0.9, 0]),
      transform: [
        { translateX: Math.cos(angle) * d },
        { translateY: Math.sin(angle) * d },
        { scale: interpolate(t.value, [0, 0.3, 1], [0.3, 1, 0.75]) },
        { rotate: `${angle}rad` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.center, style]}>
      <Ionicons name="paw" size={size} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { position: 'absolute' },
});
