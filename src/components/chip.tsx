import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { Radius, Type } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 지금 고를 수 없는 칩(예: 지역을 고르면 거리 필터가 잠긴다). 눌러도 반응하지 않는다 */
  disabled?: boolean;
  /** 앞에 붙는 작은 아이콘(Ionicons 이름) */
  icon?: string;
}

/**
 * 고르는 칩. 누르면 말랑하게 눌렸다가 고르는 순간 톡 튄다 — 필터가 "먹었다"는 걸 손끝으로 알린다.
 * 동작 줄이기면 색만 바뀐다.
 */
export function Chip({ label, selected, onPress, disabled = false, icon }: ChipProps) {
  const p = usePalette();
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const on = selected && !disabled;
  const fg = on ? p.bg : p.muted;
  return (
    <Pressable
      onPress={() => {
        if (!reduce) s.set(withSequence(withTiming(0.9, { duration: 70 }), withSpring(1, { damping: 9, stiffness: 320 })));
        onPress();
      }}
      onPressIn={() => {
        if (!reduce) s.set(withTiming(0.94, { duration: 90 }));
      }}
      onPressOut={() => {
        if (!reduce) s.set(withSpring(1, { damping: 12, stiffness: 300 }));
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}>
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: on ? p.ink : p.card,
            borderColor: on ? p.ink : p.line,
            opacity: disabled ? 0.4 : 1,
          },
          anim,
        ]}>
        {icon ? <Ionicons name={icon as never} size={14} color={on ? p.bg : p.accent} /> : null}
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  label: { fontSize: Type.body, fontWeight: '700' },
});
