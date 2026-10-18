import { useState, type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** 놓을 때 — 살짝 출렁이며 제자리. 손의 힘이 빠지는 느낌이라 스프링을 쓴다 */
const RELEASE = { damping: 14, stiffness: 220, mass: 0.6 };

/**
 * 누른 자리 쪽으로 **3D로 눌려 들어가는** 버튼.
 *
 * 말랑한 쿠션을 누르면 손가락 쪽이 꺼지듯, 오른쪽을 누르면 오른쪽이, 위를 누르면 위가 들어간다.
 * 그냥 작아지는(scale) 버튼보다 "만지고 있다"는 손맛이 크다. 들어가는 데 120ms, 놓으면 스프링.
 * 동작 줄이기를 켜면 기울기 없이 살짝 작아지기만 한다.
 *
 * `style`은 기울어지는 면(카드)에, `containerStyle`은 바깥(배치)에 준다. 눌린 동안 그림자를
 * 바꾸고 싶으면 `style`에 함수를 넘긴다.
 */
export function TiltPressable({
  children,
  style,
  containerStyle,
  maxTilt = 6,
  scaleTo = 0.97,
  haptics = true,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle> | ((pressed: boolean) => StyleProp<ViewStyle>);
  containerStyle?: StyleProp<ViewStyle>;
  maxTilt?: number;
  scaleTo?: number;
  haptics?: boolean;
}) {
  const reduce = useReducedMotion();
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [pressed, setPressed] = useState(false);
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const s = useSharedValue(1);

  const anim = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { rotateX: `${rx.value}deg` },
      { rotateY: `${ry.value}deg` },
      { scale: s.value },
    ],
  }));

  const press = (e: GestureResponderEvent) => {
    setPressed(true);
    if (haptics) haptic.light();
    s.set(withTiming(scaleTo, { duration: 120, easing: EASE_OUT }));
    if (!reduce) {
      // 가운데에서 얼마나 떨어진 곳을 눌렀나(-1..1). 큰 카드는 덜 기울여야 과하지 않다
      const nx = Math.max(-1, Math.min(1, (e.nativeEvent.locationX / size.w) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, (e.nativeEvent.locationY / size.h) * 2 - 1));
      const k = maxTilt * Math.min(1, 220 / Math.max(size.w, size.h));
      ry.set(withTiming(nx * k * 1.4, { duration: 120, easing: EASE_OUT }));
      rx.set(withTiming(-ny * k * 1.4, { duration: 120, easing: EASE_OUT }));
    }
    onPressIn?.(e);
  };
  const release = (e: GestureResponderEvent) => {
    setPressed(false);
    s.set(withSpring(1, RELEASE));
    rx.set(withSpring(0, RELEASE));
    ry.set(withSpring(0, RELEASE));
    onPressOut?.(e);
  };

  return (
    <Pressable
      {...rest}
      onPressIn={press}
      onPressOut={release}
      onLayout={(e: LayoutChangeEvent) =>
        setSize({ w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 })
      }
      style={containerStyle}>
      <Animated.View style={[typeof style === 'function' ? style(pressed) : style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}
