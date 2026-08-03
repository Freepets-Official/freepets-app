import { useEffect } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * 앱 실행 인트로: 흰 배경에서 동물들과 '프리펫스'가 토독토독 뛰다가
 * 통째로 사라지며 홈으로 넘어간다.
 */
const LETTERS = ['프', '리', '펫', '스'];
const ANIMALS = ['🐶', '🐱', '🐹', '🦜'];

export function AppSplash({ onDone }: { onDone: () => void }) {
  const bounce = useSharedValue(0);
  const gone = useSharedValue(0);

  useEffect(() => {
    // 0→1을 반복하며 각 글자가 위상차를 두고 통통 뛴다
    bounce.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1, false);
    // 잠깐 뛰놀다가 페이드아웃 → onDone
    gone.value = withDelay(
      1750,
      withTiming(1, { duration: 440, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [bounce, gone, onDone]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: 1 - gone.value,
    transform: [{ scale: 1 - gone.value * 0.08 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, wrapStyle]}>
      <Animated.View style={styles.row}>
        {ANIMALS.map((a, i) => (
          <Hop key={a} bounce={bounce} index={i} style={styles.animal}>
            {a}
          </Hop>
        ))}
      </Animated.View>
      <Animated.View style={styles.row}>
        {LETTERS.map((c, i) => (
          <Hop key={c + i} bounce={bounce} index={i + 0.5} style={styles.letter}>
            {c}
          </Hop>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/** 위상차(index)를 두고 반쪽 사인파로 통통 뛰는 글자/이모지 */
function Hop({
  children,
  bounce,
  index,
  style,
}: {
  children: string;
  bounce: SharedValue<number>;
  index: number;
  style: TextStyle;
}) {
  const s = useAnimatedStyle(() => {
    const ph = (bounce.value + index * 0.14) % 1;
    const hop = Math.max(0, Math.sin(ph * Math.PI));
    return { transform: [{ translateY: -18 * hop }, { scale: 1 + 0.1 * hop }] };
  });
  return <Animated.Text style={[style, s]}>{children}</Animated.Text>;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 100,
    pointerEvents: 'none',
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  animal: { fontSize: 30 },
  letter: { color: '#E86397', fontSize: 46, fontWeight: '900', letterSpacing: -1 },
});
