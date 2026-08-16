import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/**
 * 도장이 '탁' 찍히듯 등장하는 래퍼 — 살짝 큰 상태에서 스프링으로 튕기며 자리잡는다.
 * 판별 결과 카드 등 '결과가 확정되는' 순간에 쓴다.
 */
export function StampIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(0);

  useEffect(() => {
    s.value = withSpring(1, { damping: 9, stiffness: 170, mass: 0.6 });
  }, [s]);

  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(s.value, [0, 0.3, 1], [0, 1, 1]),
    transform: [
      { scale: interpolate(s.value, [0, 1], [1.26, 1]) },
      { rotate: `${interpolate(s.value, [0, 1], [-2.5, 0])}deg` },
    ],
  }));

  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
