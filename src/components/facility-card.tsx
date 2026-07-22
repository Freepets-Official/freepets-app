import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PetAllowedBadge } from '@/components/badge';
import { ConfidenceBadge } from '@/components/confidence-badge';
import { PawBadge } from '@/components/paw-badge';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { formatDistance } from '@/data/mock';
import { CATEGORY_LABEL, REQUIREMENT_LABEL, pawGradeOf, type Facility } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

export function FacilityCard({ facility }: { facility: Facility }) {
  const p = usePalette();
  const router = useRouter();
  const { reviewsOf, confidenceOf } = useAppStore();
  const grade = pawGradeOf(reviewsOf(facility.facilityId));
  const confidence = confidenceOf(facility).confidence;

  const conditions: string[] = [];
  if (facility.maxWeight !== null) conditions.push(`~${facility.maxWeight}kg`);
  facility.requirements.forEach((r) => conditions.push(REQUIREMENT_LABEL[r]));

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/facility/[id]', params: { id: String(facility.facilityId) } })
      }
      style={({ pressed }) => [
        styles.card,
        CardShadow,
        { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.92 : 1 },
      ]}>
      <View style={styles.topRow}>
        <Text style={[styles.category, { color: p.accent }]}>
          {CATEGORY_LABEL[facility.category]}
        </Text>
        <View style={styles.topBadges}>
          <ConfidenceBadge confidence={confidence} size="sm" />
          <PetAllowedBadge allowed={facility.petAllowed} />
        </View>
      </View>

      <Text style={[styles.name, { color: p.ink }]}>{facility.name}</Text>
      {grade.level !== null && (
        <View style={styles.pawRow}>
          <PawBadge grade={grade} size="sm" showLabel={false} />
          <Text style={[styles.pawLabel, { color: p.accent }]}>
            {grade.label} · 리뷰 {grade.count}
          </Text>
        </View>
      )}
      <Text style={[styles.address, { color: p.muted }]} numberOfLines={1}>
        {facility.address}
      </Text>

      <View style={[styles.bottomRow, { borderTopColor: p.line }]}>
        <View style={styles.distance}>
          <Ionicons name="location" size={13} color={p.muted} />
          <Text style={[styles.distanceText, { color: p.muted }]}>
            {formatDistance(facility.distanceM)}
          </Text>
        </View>
        {conditions.length > 0 && (
          <Text style={[styles.conditions, { color: p.ink }]} numberOfLines={1}>
            {conditions.join(' · ')}
          </Text>
        )}
      </View>
    </Pressable>
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
  topBadges: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  category: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  name: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  pawRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, marginBottom: 1 },
  pawLabel: { fontSize: 11.5, fontWeight: '700' },
  address: { fontSize: 13 },
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
  distanceText: { fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  conditions: { fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
});
