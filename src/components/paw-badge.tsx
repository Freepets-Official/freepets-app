import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { PAW_MIN_REVIEWS, type PawGrade } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';

/**
 * 발자국 등급 배지 — 블루리본/미슐랭 스타 방식의 큐레이션 등급.
 * 반려동물 친화도 점수와 최소 리뷰 수를 모두 만족해야 부여된다.
 */
export function PawBadge({
  grade,
  size = 'md',
  showLabel = true,
}: {
  grade: PawGrade;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}) {
  const p = usePalette();
  const iconSize = size === 'lg' ? 20 : size === 'sm' ? 12 : 15;

  if (grade.level === null) {
    if (!showLabel) return null;
    return (
      <View style={[styles.pending, { backgroundColor: p.unknownSoft }]}>
        <Text style={[styles.pendingText, { color: p.muted }]}>
          리뷰 수집 중 {grade.count}/{PAW_MIN_REVIEWS}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.paws}>
        {Array.from({ length: grade.level }, (_, i) => (
          <Ionicons key={i} name="paw" size={iconSize} color={p.accent} />
        ))}
      </View>
      {showLabel && grade.label && (
        <Text
          style={[
            styles.label,
            { color: p.accent, fontSize: size === 'lg' ? 14 : size === 'sm' ? 11 : 12.5 },
          ]}>
          {grade.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paws: { flexDirection: 'row', gap: 1.5 },
  label: { fontWeight: '800', letterSpacing: -0.2 },
  pending: {
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pendingText: { fontSize: 11, fontWeight: '700' },
});
