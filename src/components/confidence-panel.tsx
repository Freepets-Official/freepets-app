import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConfidenceBadge } from '@/components/confidence-badge';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { CONFIDENCE_SOURCE_LABEL, freshnessText, type Facility } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 확정성 레이어의 핵심 UI — 정보 신뢰도 + 근거 + 최종 확인 시점,
 * 그리고 "미확인/추정을 확정으로 끌어올리는" 액션 3종.
 */
export function ConfidencePanel({ facility }: { facility: Facility }) {
  const p = usePalette();
  const { confidenceOf, confirmFacility } = useAppStore();
  const { confidence, source, confirmedAt } = confidenceOf(facility);

  const [requested, setRequested] = useState(false);
  const fresh = freshnessText(confirmedAt);
  const isConfirmed = confidence === 'CONFIRMED';

  const callAndConfirm = () => {
    if (facility.phone) Linking.openURL(`tel:${facility.phone.replace(/-/g, '')}`);
    confirmFacility(facility.facilityId);
  };

  return (
    <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <View style={styles.head}>
        <ConfidenceBadge confidence={confidence} />
        <Text style={[styles.source, { color: p.muted }]}>
          {CONFIDENCE_SOURCE_LABEL[source]}
          {fresh ? ` · ${fresh}` : ''}
        </Text>
      </View>

      <Text style={[styles.explain, { color: p.ink }]}>
        {isConfirmed
          ? '최근 확인된 정보예요. 안심하고 방문하세요.'
          : confidence === 'LIKELY'
            ? '관광공사 원문 기준이라 대체로 정확하지만, 현장에서 바뀌었을 수 있어요.'
            : confidence === 'ESTIMATED'
              ? '원문이 모호해 추정한 정보예요. 방문 전 확인을 권장해요.'
              : '등록된 조건 정보가 없어요. 방문 전 꼭 확인하세요.'}
      </Text>

      {!isConfirmed && (
        <View style={styles.actions}>
          <Text style={[styles.actionsTitle, { color: p.muted }]}>이 정보 더 확실하게</Text>

          {facility.phone && (
            <Pressable
              onPress={callAndConfirm}
              style={({ pressed }) => [
                styles.action,
                { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' },
              ]}>
              <Ionicons name="call" size={16} color={p.accent} />
              <Text style={[styles.actionText, { color: p.accent }]}>전화로 직접 확인하기</Text>
              <Ionicons name="arrow-forward" size={14} color={p.accent} />
            </Pressable>
          )}

          <Pressable
            onPress={() => setRequested(true)}
            disabled={requested}
            style={({ pressed }) => [
              styles.action,
              { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
            ]}>
            <Ionicons
              name={requested ? 'checkmark-circle' : 'business'}
              size={16}
              color={requested ? p.success : p.muted}
            />
            <Text style={[styles.actionText, { color: requested ? p.success : p.ink }]}>
              {requested ? '사업자에게 확인 요청을 보냈어요' : '사업자에게 조건 확인 요청'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  source: { fontSize: 12.5, fontWeight: '600' },
  explain: { fontSize: 13.5, lineHeight: 20 },
  actions: { gap: Spacing.sm, marginTop: 2 },
  actionsTitle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  actionText: { fontSize: 13.5, fontWeight: '700', flex: 1 },
});
