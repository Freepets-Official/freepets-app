import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * 카드 테두리를 따라 빛나는 광점이 계속 흘러다니는 효과(증강현실 게임 카드 느낌).
 * 부모(카드) 위에 absoluteFill로 얹는다. 터치는 통과.
 * transform 이동 + 겹친 반투명 원으로 글로우를 흉내 내 웹·네이티브 모두 동작.
 */
const GLOW = 44; // 광점 박스 크기

export function BorderBeam({
  pad = 2,
  duration = 3600,
}: {
  pad?: number;
  duration?: number;
}) {
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const prog = useSharedValue(0);

  const W = dim.w - 2 * pad;
  const H = dim.h - 2 * pad;
  const total = 2 * (W + H);

  useEffect(() => {
    if (total <= 0) return;
    prog.value = 0;
    prog.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(prog);
  }, [total, duration, prog]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== dim.w || height !== dim.h) setDim({ w: width, h: height });
  };

  // 진행도(0~1)를 테두리 둘레 위 좌표로 — 위→오른→아래→왼 순환
  const style = useAnimatedStyle(() => {
    const d = prog.value * total;
    let x = pad;
    let y = pad;
    if (d < W) {
      x = pad + d;
      y = pad;
    } else if (d < W + H) {
      x = pad + W;
      y = pad + (d - W);
    } else if (d < 2 * W + H) {
      x = pad + W - (d - W - H);
      y = pad + H;
    } else {
      x = pad;
      y = pad + H - (d - 2 * W - H);
    }
    return { transform: [{ translateX: x - GLOW / 2 }, { translateY: y - GLOW / 2 }] };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {total > 0 ? (
        <Animated.View style={[styles.glow, style]}>
          <View style={styles.glowOuter} />
          <View style={styles.glowMid} />
          <View style={styles.glowCore} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: GLOW,
    height: GLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: GLOW,
    height: GLOW,
    borderRadius: GLOW / 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  glowMid: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  glowCore: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    // iOS/웹 글로우
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.95,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
