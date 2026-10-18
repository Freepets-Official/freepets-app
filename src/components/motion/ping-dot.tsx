import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * 급한 것을 알리는 점 — 둘레에 물결이 퍼진다(지도 앱의 "내 위치"처럼).
 *
 * 화면에서 **급한 것에만** 쓴다. 여기저기 붙으면 아무것도 급해 보이지 않는다.
 * 동작 줄이기를 켜면 물결 없이 점만 남는다.
 */
export function PingDot({
  color,
  size = 10,
  borderColor,
  style,
}: {
  color: string;
  size?: number;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [reduce, t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - t.value), transform: [{ scale: 1 + t.value * 1.6 }] }));
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      {!reduce ? (
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: color }, ring]} />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, backgroundColor: color },
          borderColor ? { borderWidth: 2, borderColor } : null,
        ]}
      />
    </View>
  );
}
