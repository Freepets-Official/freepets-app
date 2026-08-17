import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * 게임 홀로그램 카드 효과(증강현실 느낌) — 카드 위에 얹는 오버레이.
 *  ① 무지갯빛 홀로그램 시(sheen)가 대각선으로 천천히 훑고 지나간다.
 *  ② 네 모서리에 AR HUD 스캔 프레임(코너 브래킷).
 * 터치는 통과(pointerEvents none).
 */
const CORNER = '#FFD36E'; // 골드 — 핑크 배너·흰 본문 어디서든 읽힘

export function GameCardFx({ radius = 6 }: { radius?: number }) {
  const [w, setW] = useState(0);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t]);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width !== w) setW(width);
  };

  const sheen = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [-w * 1.2, w * 1.2]) }, { rotate: '18deg' }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {/* 홀로그램 시 — 카드 안으로 클립 */}
      {w > 0 ? (
        <View style={styles.clip}>
          <Animated.View style={[styles.band, { width: w * 0.55 }, sheen]}>
            <LinearGradient
              colors={[
                'rgba(255,255,255,0)',
                'rgba(130,200,255,0.16)',
                'rgba(255,255,255,0.26)',
                'rgba(255,190,240,0.18)',
                'rgba(255,255,255,0)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      ) : null}

      {/* AR HUD 코너 브래킷 */}
      <View style={[styles.corner, styles.tl, { borderTopLeftRadius: radius }]} />
      <View style={[styles.corner, styles.tr, { borderTopRightRadius: radius }]} />
      <View style={[styles.corner, styles.bl, { borderBottomLeftRadius: radius }]} />
      <View style={[styles.corner, styles.br, { borderBottomRightRadius: radius }]} />
    </View>
  );
}

const C = 18; // 코너 브래킷 길이
const T = 2.5; // 두께
const INSET = 7;

const styles = StyleSheet.create({
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  band: { position: 'absolute', top: -50, bottom: -50 },
  corner: { position: 'absolute', width: C, height: C, borderColor: CORNER },
  tl: { top: INSET, left: INSET, borderTopWidth: T, borderLeftWidth: T },
  tr: { top: INSET, right: INSET, borderTopWidth: T, borderRightWidth: T },
  bl: { bottom: INSET, left: INSET, borderBottomWidth: T, borderLeftWidth: T },
  br: { bottom: INSET, right: INSET, borderBottomWidth: T, borderRightWidth: T },
});
