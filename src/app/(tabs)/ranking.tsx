import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/chip';
import { PawBadge } from '@/components/paw-badge';
import { Screen } from '@/components/screen';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { FACILITIES, formatDistance } from '@/data/mock';
import { CATEGORY_LABEL, PAW_MIN_REVIEWS, pawGradeOf, type Category } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export default function RankingScreen() {
  const p = usePalette();
  const router = useRouter();
  const { reviewsOf } = useAppStore();
  const [category, setCategory] = useState<Category | null>(null);

  const ranked = useMemo(() => {
    return FACILITIES.map((f) => ({ facility: f, grade: pawGradeOf(reviewsOf(f.facilityId)) }))
      .filter((x) => x.grade.level !== null)
      .filter((x) => !category || x.facility.category === category)
      .sort(
        (a, b) =>
          (b.grade.level ?? 0) - (a.grade.level ?? 0) || (b.grade.score ?? 0) - (a.grade.score ?? 0),
      );
  }, [reviewsOf, category]);

  return (
    <Screen
      eyebrow="발자국 랭킹"
      title="발자국 많은 곳"
      subtitle="반려동물과 얼마나 편했는지, 실제 방문자 리뷰로만 매긴 등급이에요.">
      <View style={[styles.legend, { backgroundColor: p.surface, borderColor: p.line }]}>
        <View style={styles.legendTop}>
          <Ionicons name="paw" size={14} color={p.accent} />
          <Text style={[styles.legendTitle, { color: p.ink }]}>발자국 등급이란?</Text>
        </View>
        <Text style={[styles.legendBody, { color: p.muted }]}>
          공간 여유·직원 친절도·편의시설 점수로 친화도를 계산하고, 리뷰가 일정 수 이상 모인 시설에만
          1~5개의 발자국을 부여해요. 최근 1년 리뷰만 반영합니다.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="전체" selected={category === null} onPress={() => setCategory(null)} />
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABEL[c]}
            selected={category === c}
            onPress={() => setCategory(category === c ? null : c)}
          />
        ))}
      </ScrollView>

      <View style={styles.list}>
        {ranked.map(({ facility, grade }, i) => (
          <Pressable
            key={facility.facilityId}
            onPress={() =>
              router.push({ pathname: '/facility/[id]', params: { id: String(facility.facilityId) } })
            }
            style={({ pressed }) => [
              styles.card,
              CardShadow,
              { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.92 : 1 },
            ]}>
            <Text style={[styles.rank, { color: i < 3 ? p.accent : p.muted }]}>{i + 1}</Text>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: p.ink }]} numberOfLines={1}>
                  {facility.name}
                </Text>
                <Text style={[styles.cat, { color: p.muted }]}>
                  {CATEGORY_LABEL[facility.category]}
                </Text>
              </View>
              <PawBadge grade={grade} size="sm" />
              <Text style={[styles.meta, { color: p.muted }]}>
                리뷰 {grade.count}건 · 친화도 {grade.score?.toFixed(0)}점 ·{' '}
                {formatDistance(facility.distanceM)}
              </Text>
            </View>
          </Pressable>
        ))}

        {ranked.length === 0 && (
          <Text style={[styles.empty, { color: p.muted }]}>
            아직 등급을 받은 시설이 없어요.{'\n'}리뷰가 {PAW_MIN_REVIEWS}건 이상 모이면 발자국이 부여됩니다.
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: 6 },
  legendTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendTitle: { fontSize: 13.5, fontWeight: '800' },
  legendBody: { fontSize: 12.5, lineHeight: 19 },
  chips: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.xl },
  list: { gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  rank: {
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    width: 26,
    textAlign: 'center',
  },
  info: { flex: 1, gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  name: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 },
  cat: { fontSize: 11.5, fontWeight: '600' },
  meta: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
  empty: { fontSize: 14, textAlign: 'center', lineHeight: 21, paddingVertical: 56 },
});
