import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/hooks/use-theme';

/** 읽기 전용 별점 표시 (반개 단위 반올림) */
export function StarsDisplay({ value, size = 14 }: { value: number; size?: number }) {
  const p = usePalette();
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = value >= i + 0.75;
        const half = !filled && value >= i + 0.25;
        return (
          <Ionicons
            key={i}
            name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
            size={size}
            color={filled || half ? p.accent : p.line}
          />
        );
      })}
    </View>
  );
}

/** 입력용 별점 한 줄 — 항목 이름 + 탭 가능한 별 5개 */
export function StarInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const p = usePalette();
  return (
    <View style={styles.inputRow}>
      <View style={styles.inputText}>
        <Text style={[styles.inputLabel, { color: p.ink }]}>{label}</Text>
        <Text style={[styles.inputHint, { color: p.muted }]}>{hint}</Text>
      </View>
      <View style={styles.stars}>
        {Array.from({ length: 5 }, (_, i) => (
          <Pressable key={i} onPress={() => onChange(i + 1)} hitSlop={4}>
            <Ionicons
              name={value >= i + 1 ? 'star' : 'star-outline'}
              size={26}
              color={value >= i + 1 ? p.accent : p.line}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 2 },
  inputRow: { gap: 8 },
  inputText: { gap: 1 },
  inputLabel: { fontSize: 14.5, fontWeight: '800' },
  inputHint: { fontSize: 12 },
});
