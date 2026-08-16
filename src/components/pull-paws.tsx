import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { usePalette } from '@/hooks/use-theme';

/**
 * 당겨서 새로고침 인디케이터 — 당기는 동안 발자국 3개가 순서대로 진해지고,
 * 새로고침 중에는 발자국이 통통 걷는다. 네이티브(고무줄 오버스크롤)에서 동작.
 */
const N = 3;

export function PullPaws({ progress, refreshing }: { progress: number; refreshing: boolean }) {
  const p = usePalette();
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.row} pointerEvents="none">
      {Array.from({ length: N }).map((_, i) => (
        <Paw
          key={i}
          index={i}
          // 당긴 정도에 따라 왼쪽부터 차례로 또렷해진다
          on={clamped >= (i + 0.5) / N}
          refreshing={refreshing}
          color={p.accent}
        />
      ))}
    </View>
  );
}

function Paw({
  index,
  on,
  refreshing,
  color,
}: {
  index: number;
  on: boolean;
  refreshing: boolean;
  color: string;
}) {
  const hop = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      hop.value = withRepeat(
        withTiming(1, { duration: 360, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      hop.value = 0;
    }
  }, [refreshing, hop]);

  const style = useAnimatedStyle(() => ({
    // 걸을 때 위상차를 두고 통통
    transform: [{ translateY: -6 * hop.value * Math.max(0, Math.sin((index / N) * Math.PI + hop.value * Math.PI)) }],
  }));

  return (
    <Animated.View style={[{ opacity: refreshing || on ? 1 : 0.22 }, style]}>
      <Ionicons name="paw" size={18} color={color} style={{ transform: [{ rotate: index % 2 ? '12deg' : '-12deg' }] }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 30 },
});
