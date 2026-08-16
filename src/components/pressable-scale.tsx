import { useRef } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * 누르면 살짝 눌리는(scale) Pressable. 앱 전체를 '말랑'하게 만드는 마이크로 인터랙션.
 * haptic 옵션을 켜면 누르는 순간 가벼운 진동(네이티브만).
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  haptics = false,
  onPressIn,
  onPressOut,
  ...rest
}: PressableProps & { scaleTo?: number; haptics?: boolean }) {
  const s = useSharedValue(1);
  const ref = useRef<View>(null);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <AnimatedPressable
      ref={ref}
      onPressIn={(e) => {
        s.value = withTiming(scaleTo, { duration: 90 });
        if (haptics) haptic.light();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, { damping: 12, stiffness: 220, mass: 0.5 });
        onPressOut?.(e);
      }}
      style={[animStyle, style]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
