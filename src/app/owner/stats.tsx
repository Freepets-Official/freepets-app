import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountUp } from '@/components/count-up';
import { PawBadge } from '@/components/paw-badge';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { pawGradeOf } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/** 리뷰·통계 (사업자 대시보드 ④) — 등급·항목 평균·관심도·개선 지표 */
export default function StatsScreen() {
  const p = usePalette();
  const params = useLocalSearchParams<{ facilityId?: string }>();
  const { businessRegs, reviewsOf, checks } = useAppStore();

  const facilityId = Number(params.facilityId) || Number(Object.keys(businessRegs)[0]);
  const facility = FACILITIES.find((f) => f.facilityId === facilityId);
  const reviews = reviewsOf(facilityId);
  const grade = pawGradeOf(reviews);
  const checkCount = checks.filter((c) => c.facilityId === facilityId).length;

  const avg = (pick: (r: (typeof reviews)[number]) => number) =>
    reviews.length ? reviews.reduce((s, r) => s + pick(r), 0) / reviews.length : 0;
  const space = avg((r) => r.ratingSpace);
  const staff = avg((r) => r.ratingStaff);
  const amenity = avg((r) => r.ratingAmenity);

  const bars = [
    { key: 'space', label: '공간 여유', value: space },
    { key: 'staff', label: '직원 친절도', value: staff },
    { key: 'amenity', label: '편의시설', value: amenity },
  ];
  // 가장 낮은 항목 = 개선 여지
  const weakest = reviews.length ? bars.reduce((a, b) => (b.value < a.value ? b : a)) : null;

  if (!facility) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '리뷰·통계' }} />
        <Text style={[styles.empty, { color: p.muted }]}>등록된 매장이 없어요.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '리뷰·통계', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: p.accent }]}>{facility.name}</Text>
            <Text style={[styles.title, { color: p.ink }]}>리뷰·통계</Text>
          </View>

          {/* 핵심 지표 */}
          <View style={styles.kpis}>
            <View style={[styles.kpi, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
              <Text style={[styles.kpiLabel, { color: p.muted }]}>발자국 등급</Text>
              {grade.level ? (
                <PawBadge grade={grade} size="sm" />
              ) : (
                <Text style={[styles.kpiValue, { color: p.muted }]}>수집 중</Text>
              )}
            </View>
            <View style={[styles.kpi, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
              <Text style={[styles.kpiLabel, { color: p.muted }]}>리뷰</Text>
              <CountUp style={[styles.kpiValue, { color: p.ink }]} value={grade.count} suffix="건" />
            </View>
            <View style={[styles.kpi, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
              <Text style={[styles.kpiLabel, { color: p.muted }]}>이번 주 판별</Text>
              <CountUp style={[styles.kpiValue, { color: p.ink }]} value={checkCount} suffix="회" />
            </View>
          </View>

          {/* 항목별 평균 */}
          <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
            <Text style={[styles.cardTitle, { color: p.ink }]}>항목별 평균</Text>
            {reviews.length === 0 ? (
              <Text style={[styles.noReview, { color: p.muted }]}>
                아직 리뷰가 없어요. 리뷰가 쌓이면 항목별 점수가 보여요.
              </Text>
            ) : (
              bars.map((b) => (
                <View key={b.key} style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: p.ink }]}>{b.label}</Text>
                  <View style={[styles.barTrack, { backgroundColor: p.surface }]}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${(b.value / 5) * 100}%`, backgroundColor: p.accent },
                      ]}
                    />
                  </View>
                  <CountUp style={[styles.barValue, { color: p.muted }]} value={b.value} decimals={1} />
                </View>
              ))
            )}
          </View>

          {/* 개선 지표 */}
          {weakest && (
            <View style={[styles.tip, { backgroundColor: p.accentSoft }]}>
              <Ionicons name="bulb-outline" size={17} color={p.accent} />
              <Text style={[styles.tipText, { color: p.ink }]}>
                <Text style={{ fontWeight: '800' }}>{weakest.label}</Text> 점수가 가장 낮아요
                ({weakest.value.toFixed(1)}). 이 부분을 보완하면 발자국 등급을 끌어올릴 수 있어요.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 64 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg, paddingTop: Spacing.sm },
  head: { gap: 4 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  kpis: { flexDirection: 'row', gap: Spacing.sm },
  kpi: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
  },
  kpiLabel: { fontSize: 11, fontWeight: '700' },
  kpiValue: { fontSize: 16, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  noReview: { fontSize: 13, lineHeight: 20 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barLabel: { fontSize: 13, fontWeight: '700', width: 74 },
  barTrack: { flex: 1, height: 8, borderRadius: Radius.full, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: Radius.full },
  barValue: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'], width: 26, textAlign: 'right' },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  tipText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  empty: { fontSize: 14, textAlign: 'center', padding: 40 },
});
