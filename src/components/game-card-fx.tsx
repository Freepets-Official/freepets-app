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
 * 프리미엄 홀로그램 포일 오버레이 — 수집형 카드(가챠)처럼 카드 위에 얹는다.
 *  ① 좌상단 유리 광택(정적 하이라이트)으로 입체·고급 질감.
 *  ② 무지갯빛 홀로그램 시(sheen)가 대각선으로 아주 천천히 훑고 지나간다.
 * 예전의 각진 AR 코너 브래킷은 제거했다(장난감 느낌). 터치는 통과(pointerEvents none).
 */
export function GameCardFx() {
  const [w, setW] = useState(0);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }), -1, false);
    return () => cancelAnimation(t);
  }, [t]);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width !== w) setW(width);
  };

  const sheen = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [-w * 1.3, w * 1.3]) }, { rotate: '20deg' }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {/* 유리 광택 — 좌상단이 밝고 우하단으로 사라지는 정적 하이라이트(입체 유리 질감) */}
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.65, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 홀로그램 시 — 카드 안으로 클립, 무지갯빛으로 천천히 훑는다 */}
      {w > 0 ? (
        <View style={styles.clip}>
          <Animated.View style={[styles.band, { width: w * 0.7 }, sheen]}>
            <LinearGradient
              colors={[
                'rgba(255,255,255,0)',
                'rgba(120,220,255,0.10)',
                'rgba(190,170,255,0.16)',
                'rgba(255,255,255,0.30)',
                'rgba(255,200,150,0.14)',
                'rgba(255,255,255,0)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  band: { position: 'absolute', top: -60, bottom: -60 },
});
