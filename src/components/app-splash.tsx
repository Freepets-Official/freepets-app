import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';


/**
 * 앱 실행 인트로: 가운데 실사 강아지·고양이 사진이 뜨고,
 * '프리펫스' 네 글자가 왼쪽에서 한 글자씩 튀어 들어와 가운데에 자리잡은 뒤
 * 통째로 사라지며 다음 화면으로 넘어간다.
 */
const LETTERS = ['프', '리', '펫', '스'];
const PETS = require('../../assets/images/splash-art.png');

const LETTER_START = 620; // 사진이 자리잡은 뒤 글자 시작
const LETTER_STAGGER = 155; // 글자 사이 간격

export function AppSplash({ onDone }: { onDone: () => void }) {
  const intro = useSharedValue(0); // 사진 등장
  const gone = useSharedValue(0); // 전체 페이드아웃

  useEffect(() => {
    intro.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    // 글자가 다 들어오고 잠깐 머문 뒤 사라진다
    const hold = LETTER_START + LETTERS.length * LETTER_STAGGER + 900;
    gone.value = withDelay(
      hold,
      withTiming(1, { duration: 460, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [intro, gone, onDone]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: 1 - gone.value,
    transform: [{ scale: 1 - gone.value * 0.06 }],
  }));
  const photoStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ scale: interpolate(intro.value, [0, 1], [0.9, 1]) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, wrapStyle]}>
      <Animated.View style={[styles.photoCard, photoStyle]}>
        <Image source={PETS} style={styles.photo} contentFit="contain" transition={200} />
      </Animated.View>

      <View style={styles.row}>
        {LETTERS.map((c, i) => (
          <Letter key={c + i} index={i}>
            {c}
          </Letter>
        ))}
      </View>
    </Animated.View>
  );
}

/** 왼쪽에서 회전하며 튀어 들어와 스프링 바운스로 자리잡는 글자 */
function Letter({ children, index }: { children: string; index: number }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      LETTER_START + index * LETTER_STAGGER,
      withSpring(1, { damping: 8, stiffness: 130, mass: 0.7 }),
    );
  }, [p, index]);

  const s = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.25, 1], [0, 1, 1]),
    transform: [
      { translateX: interpolate(p.value, [0, 1], [-64, 0]) },
      { rotate: `${interpolate(p.value, [0, 1], [-32, 0])}deg` },
    ],
  }));

  return <Animated.Text style={[styles.letter, s]}>{children}</Animated.Text>;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
    zIndex: 100,
    pointerEvents: 'none',
  },
  // 테두리·배경 없이 그림만 — 흰 배경에 동화된다
  photoCard: {
    width: 240,
    height: 240,
  },
  photo: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  letter: { color: '#E86397', fontSize: 46, fontWeight: '900', letterSpacing: -1 },
});
