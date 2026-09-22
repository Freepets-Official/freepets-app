import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text, AnimatedText } from '@/components/text';
import { PetAllowedBadge } from '@/components/badge';
import { PressableScale } from '@/components/pressable-scale';
import { DenialAlert } from '@/components/denial-alert';
import { PawBadge } from '@/components/paw-badge';
import { CardShadow, Radius, Spacing, Type } from '@/constants/theme';
import { formatDistance } from '@/data/mock';
import { CATEGORY_LABEL, REQUIREMENT_LABEL, pawGradeOf, type Facility } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

export function FacilityCard({ facility }: { facility: Facility }) {
  const p = usePalette();
  const router = useRouter();
  const { reviewsOf } = useAppStore();
  const grade = pawGradeOf(reviewsOf(facility.facilityId));

  const conditions: string[] = [];
  if (facility.maxWeight !== null) conditions.push(`~${facility.maxWeight}kg`);
  facility.requirements.forEach((r) => conditions.push(REQUIREMENT_LABEL[r]));

  return (
    <PressableScale
      onPress={() =>
        router.push({ pathname: '/facility/[id]', params: { id: String(facility.facilityId) } })
      }
      style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <View style={styles.topRow}>
        <AnimatedText
          sharedTransitionTag={`fac-cat-${facility.facilityId}`}
          style={[styles.category, { color: p.accent }]}>
          {CATEGORY_LABEL[facility.category]}
        </AnimatedText>
        <PetAllowedBadge allowed={facility.petAllowed} />
      </View>

      {/* 카드→상세 shared element — 이름이 그대로 이어지며 커진다(네이티브 전용) */}
      <AnimatedText
        sharedTransitionTag={`fac-name-${facility.facilityId}`}
        style={[styles.name, { color: p.ink }]}>
        {facility.name}
      </AnimatedText>
      {grade.level !== null && (
        <Animated.View sharedTransitionTag={`fac-paw-${facility.facilityId}`} style={styles.pawRow}>
          <PawBadge grade={grade} size="sm" showLabel={false} />
          <Text style={[styles.pawLabel, { color: p.accent }]}>
            {grade.label} · 리뷰 {grade.count}
          </Text>
        </Animated.View>
      )}
      <Text style={[styles.address, { color: p.muted }]} numberOfLines={1}>
        {facility.address}
      </Text>

      {/* 목록에서부터 경고가 보여야 헛걸음이 시작되기 전에 멈출 수 있다 */}
      <DenialAlert facilityId={facility.facilityId} compact />


      <View style={[styles.bottomRow, { borderTopColor: p.line }]}>
        {/*
          지역 목록(관광공사 실시간)은 좌표를 받지 않아 거리가 없다. 그 자리에 "거리 미상"을
          쓰면 뭔가 고장 난 것처럼 보이므로, 대신 행정구역을 보여준다 — 지역을 훑어보는
          맥락에서는 내 위치로부터의 거리보다 어느 시군구인지가 쓸모 있다.
        */}
        <View style={styles.distance}>
          <Ionicons name={facility.distanceM == null ? 'map-outline' : 'location'} size={13} color={p.muted} />
          <Text style={[styles.distanceText, { color: p.muted }]}>
            {facility.distanceM == null
              ? [facility.sido, facility.sigungu].filter(Boolean).join(' ') || '위치 정보 없음'
              : formatDistance(facility.distanceM)}
          </Text>
        </View>
        {conditions.length > 0 && (
          <Text style={[styles.conditions, { color: p.ink }]} numberOfLines={1}>
            {conditions.join(' · ')}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  category: {
    fontSize: Type.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  name: { fontSize: Type.sheetTitle, fontWeight: '800', letterSpacing: -0.4 },
  pawRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, marginBottom: 1 },
  pawLabel: { fontSize: Type.caption, fontWeight: '700' },
  address: { fontSize: Type.body },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  distance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distanceText: { fontSize: Type.footnote, fontWeight: '600', fontVariant: ['tabular-nums'] },
  conditions: { fontSize: Type.footnote, fontWeight: '700', flexShrink: 1 },
});
