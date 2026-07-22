import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { CONFIDENCE_LABEL, type Confidence } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** 신뢰도별 색·아이콘 — 결과색(가능/불가)과 겹치지 않게 파랑·회색 계열을 섞는다 */
function toneOf(c: Confidence, p: ReturnType<typeof usePalette>) {
  switch (c) {
    case 'CONFIRMED':
      return { color: p.success, bg: p.successSoft, icon: 'shield-checkmark' as IconName };
    case 'LIKELY':
      return { color: '#2B6CB0', bg: '#E7F0FA', icon: 'checkmark-circle' as IconName };
    case 'ESTIMATED':
      return { color: p.warn, bg: p.warnSoft, icon: 'help-circle' as IconName };
    case 'UNVERIFIED':
      return { color: p.unknown, bg: p.unknownSoft, icon: 'ellipse-outline' as IconName };
  }
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
