import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { CONFIDENCE_LABEL, type Confidence } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** 신뢰도는 두 가지만: 확정(초록) / 확인 필요(앰버). 애매한 중간 단계는 두지 않는다 */
function toneOf(c: Confidence, p: ReturnType<typeof usePalette>) {
  if (c === 'CONFIRMED')
    return { color: p.success, bg: p.successSoft, icon: 'shield-checkmark' as IconName };
  return { color: p.warn, bg: p.warnSoft, icon: 'alert-circle' as IconName };
}

/** 신뢰도 배지 (칩) */
export function ConfidenceBadge({
  confidence,
  size = 'md',
}: {
  confidence: Confidence;
  size?: 'sm' | 'md';
}) {
  const p = usePalette();
  const t = toneOf(confidence, p);
  const iconSize = size === 'sm' ? 11 : 13;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, size === 'sm' && styles.badgeSm]}>
      <Ionicons name={t.icon} size={iconSize} color={t.color} />
      <Text style={[styles.label, { color: t.color }, size === 'sm' && styles.labelSm]}>
        {CONFIDENCE_LABEL[confidence]}
      </Text>
    </View>
  );
}

export function confidenceColor(c: Confidence, p: ReturnType<typeof usePalette>) {
  return toneOf(c, p).color;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeSm: { paddingHorizontal: 7, paddingVertical: 2, gap: 3 },
  label: { fontSize: 12, fontWeight: '800' },
  labelSm: { fontSize: 10.5 },
});
