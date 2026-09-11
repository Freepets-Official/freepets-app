import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { AnimatedText } from '@/components/text';
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
 * '반갑꼬리' 네 글자가 왼쪽에서 한 글자씩 튀어 들어와 가운데에 자리잡은 뒤
 * 통째로 사라지며 다음 화면으로 넘어간다.
 */
const LETTERS = ['반', '갑', '꼬', '리'];
const PETS = require('../../assets/images/splash-art.png');

const LETTER_START = 620; // 사진이 자리잡은 뒤 글자 시작
const LETTER_STAGGER = 155; // 글자 사이 간격

export function AppSplash({ onDone }: { onDone: () => void }) {
  const gone = useSharedValue(0); // 전체 페이드아웃

  useEffect(() => {
    // 글자가 다 들어오고 잠깐 머문 뒤 사라진다
    const hold = LETTER_START + LETTERS.length * LETTER_STAGGER + 900;
    gone.value = withDelay(
      hold,
      withTiming(1, { duration: 460, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [gone, onDone]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: 1 - gone.value,
    transform: [{ scale: 1 - gone.value * 0.06 }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, wrapStyle]}>
      {/*
        **등장 애니메이션을 걸지 않는다.** 이 화면 앞에는 iOS 런치 스크린이 같은 그림을
        같은 크기로 이미 띄워놓고 있다. 여기서 0.9배로 시작하거나 페이드인을 하면
        그림이 한 번 튀었다가 자리잡는 것처럼 보인다 — 한 장이 쭉 떠 있어야 한다.
        움직임은 뒤이어 들어오는 글자가 맡는다.
      */}
      <View style={styles.photoCard}>
        <Image source={PETS} style={styles.photo} contentFit="contain" />
      </View>

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

  return <AnimatedText style={[styles.letter, s]}>{children}</AnimatedText>;
}

/**
 * 스플래시 그림 크기.
 *
 * **`app.json`의 `imageWidth`와 같은 값이어야 하고, 이미지 파일도 같아야 한다**
 * (`splash-art.png`). 예전에는 네이티브가 `splash-icon.png`(512²), 여기가
 * `splash-art.png`(640²)로 서로 다른 그림을 써서 크기를 맞춰도 어긋났다. iOS는 런치 스크린(네이티브 스플래시)을
 * 없앨 수 없어서 이 화면이 그 뒤에 이어 뜨는데, 크기가 다르면 그림이 한 번 튀었다가
 * 커지는 것처럼 보인다. 두 값을 맞추면 한 장이 쭉 떠 있는 것처럼 이어진다.
 *
 * 화면 비례가 아니라 고정값인 것도 그래서다 — 네이티브 쪽은 pt 고정만 받는다.
 */
const PHOTO_SIZE = 270;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
    zIndex: 100,
    pointerEvents: 'none',
  },
  // 테두리·배경 없이 그림만 — 흰 배경에 동화된다.
  // 화면 너비에 비례시킨다. 고정값이면 작은 기기에서 넘치고 큰 기기에서 허전하다.
  photoCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  photo: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  letter: { color: '#E86397', fontSize: 46, fontWeight: '900', letterSpacing: -1 },
});
