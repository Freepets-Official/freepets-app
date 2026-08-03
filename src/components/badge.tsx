import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { RESULT_LABEL, type CheckResult } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';

interface BadgeProps {
  label: string;
  color: string;
  background: string;
  /** true면 테두리를 강조색으로 감싼다(연한 배경 배지의 대비 보강) */
  outline?: boolean;
}

export function Badge({ label, color, background, outline }: BadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: background },
        outline && { borderWidth: 1, borderColor: color + '33' },
      ]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

export function PetAllowedBadge({ allowed }: { allowed: boolean | null }) {
  const p = usePalette();
  // 동반 가능: 연초록 배경 + 진한 초록 볼드 글씨
  if (allowed === true)
    return <Badge label="동반 가능" color={p.success} background={p.successSoft} outline />;
  // 동반 불가: 빨강 채운 배경 + 흰 볼드 글씨 (초록 vs 빨강 강한 대비)
  if (allowed === false)
    return <Badge label="동반 불가" color={p.onAccent} background={p.dangerSolid} />;
  // 정보가 없거나 아직 확정 전 — 회색 '미확인'보다 행동을 유도하는 앰버 '확인 필요'로
  return <Badge label="확인 필요" color={p.warn} background={p.warnSoft} outline />;
}

export function ResultBadge({ result }: { result: CheckResult }) {
  const p = usePalette();
  const tone = {
    ALLOWED: { color: p.success, background: p.successSoft, outline: true },
    CONDITIONAL: { color: p.warn, background: p.warnSoft, outline: true },
    // 불가는 동반 불가 배지와 동일하게 빨강 채운 배경 + 흰 글씨
    DENIED: { color: p.onAccent, background: p.dangerSolid, outline: false },
  }[result];
  return <Badge label={RESULT_LABEL[result]} {...tone} />;
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 11,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
  },
});
