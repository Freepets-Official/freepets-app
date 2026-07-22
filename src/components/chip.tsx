import { Pressable, StyleSheet, Text } from 'react-native';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? p.ink : p.surface,
          borderColor: selected ? p.ink : p.line,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <Text style={[styles.label, { color: selected ? p.bg : p.muted }]}>{label}</Text>
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
