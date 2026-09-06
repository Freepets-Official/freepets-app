import { Pressable, StyleSheet, Text } from 'react-native';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 지금 고를 수 없는 칩(예: 지역을 고르면 거리 필터가 잠긴다). 눌러도 반응하지 않는다 */
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, disabled = false }: ChipProps) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected && !disabled ? p.ink : p.surface,
          borderColor: selected && !disabled ? p.ink : p.line,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}>
      <Text style={[styles.label, { color: selected && !disabled ? p.bg : p.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  label: { fontSize: 13, fontWeight: '700' },
});
