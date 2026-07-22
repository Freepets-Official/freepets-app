import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/** 앱 실행 인트로: 흰 배경에 프리펫스가 떠오른 뒤 확대되며 사라진다. */
export function AppSplash({ onDone }: { onDone: () => void }) {
  const intro = useSharedValue(0);
  const zoom = useSharedValue(0);

  useEffect(() => {
    intro.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) });
    zoom.value = withDelay(
      820,
      withTiming(1, { duration: 900, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [intro, zoom, onDone]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: intro.value * interpolate(zoom.value, [0, 0.55, 1], [1, 1, 0]),
    transform: [
      { scale: interpolate(intro.value, [0, 1], [0.88, 1]) * interpolate(zoom.value, [0, 1], [1, 14]) },
    ],
  }));

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(zoom.value, [0.8, 1], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, wrapStyle]}>
      <Animated.Text style={[styles.text, textStyle]}>프리펫스</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    pointerEvents: 'none',
  },
  text: {
    color: '#E86397',
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -1,
  },
});
