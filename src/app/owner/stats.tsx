import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { CountUp } from '@/components/count-up';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useOwnerFacilities } from '@/hooks/use-owner-facilities';
import { usePalette } from '@/hooks/use-theme';
import { ownerApi, type OwnerReviewStats } from '@/lib/api';

/** 리뷰·통계 — `GET /owner/facilities/{id}/review-stats`. 항목 평균·등급 추이(나이틀리 스냅샷)·관심도 */
export default function StatsScreen() {
  const p = usePalette();
  const { facilityId: idParam } = useLocalSearchParams<{ facilityId?: string }>();
  const facilityId = Number(idParam);
  const { facilities } = useOwnerFacilities();
  const facility = facilities?.find((f) => f.facilityId === facilityId) ?? null;
  const [stats, setStats] = useState<OwnerReviewStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    ownerApi
      .reviewStats(facilityId)
      .then((s) => alive && setStats(s))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [facilityId]);

  if (!facility) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '리뷰·통계', headerBackButtonDisplayMode: 'minimal' }} />
        {facilities === null ? <ActivityIndicator color={p.accent} style={{ padding: 40 }} /> : <Text style={[styles.empty, { color: p.muted }]}>등록된 매장이 없어요.</Text>}
      </SafeAreaView>
    );
  }

  const avg = stats?.itemAverages;
  const bars = avg
    ? [
        { key: 'space', label: '공간 여유', value: avg.averageSpace },
        { key: 'staff', label: '직원 친절도', value: avg.averageStaff },
        { key: 'amenity', label: '편의시설', value: avg.averageAmenity },
      ]
    : [];
  const hasReviews = (avg?.reviewCount ?? 0) > 0;
  const weakest = hasReviews ? bars.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const trend = stats?.gradeTrend ?? [];
  const latest = trend.length ? trend[trend.length - 1] : null;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '리뷰·통계', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: p.accent }]}>{facility.name}</Text>
            <Text style={[styles.title, { color: p.ink }]}>리뷰·통계</Text>
          </View>

          {failed ? (
            <Text style={[styles.noReview, { color: p.muted }]}>통계를 불러오지 못했어요.</Text>
          ) : !stats ? (
            <ActivityIndicator color={p.accent} style={{ paddingVertical: 32 }} />
          ) : (
            <>
              <View style={styles.kpis}>
                <View style={[styles.kpi, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                  <Text style={[styles.kpiLabel, { color: p.muted }]}>발자국 등급</Text>
                  <Text style={[styles.kpiValue, { color: latest?.pawGradeLevel ? p.ink : p.muted }]}>
                    {latest?.pawGradeLevel ? `Lv.${latest.pawGradeLevel}` : '수집 중'}
                  </Text>
                </View>
                <View style={[styles.kpi, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                  <Text style={[styles.kpiLabel, { color: p.muted }]}>리뷰</Text>
                  <CountUp style={[styles.kpiValue, { color: p.ink }]} value={avg?.reviewCount ?? 0} suffix="건" />
                </View>
                <View style={[styles.kpi, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                  <Text style={[styles.kpiLabel, { color: p.muted }]}>관심도</Text>
                  <CountUp style={[styles.kpiValue, { color: p.ink }]} value={stats.interestCount} suffix="회" />
                </View>
              </View>
              <Text style={[styles.note, { color: p.muted }]}>관심도 = 이 매장을 판별한 누적 횟수예요.</Text>

              <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                <Text style={[styles.cardTitle, { color: p.ink }]}>항목별 평균</Text>
                {!hasReviews ? (
                  <Text style={[styles.noReview, { color: p.muted }]}>아직 리뷰가 없어요. 리뷰가 쌓이면 항목별 점수가 보여요.</Text>
                ) : (
                  bars.map((b) => (
                    <View key={b.key} style={styles.barRow}>
                      <Text style={[styles.barLabel, { color: p.ink }]}>{b.label}</Text>
                      <View style={[styles.barTrack, { backgroundColor: p.surface }]}>
                        <View style={[styles.barFill, { width: `${(b.value / 5) * 100}%`, backgroundColor: p.accent }]} />
                      </View>
                      <CountUp style={[styles.barValue, { color: p.muted }]} value={b.value} decimals={1} />
                    </View>
                  ))
                )}
              </View>

              {/* 등급 추이 — 나이틀리 스냅샷. 막대 높이는 petScore(0~100) */}
              <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                <Text style={[styles.cardTitle, { color: p.ink }]}>등급 추이</Text>
                {trend.length === 0 ? (
                  <Text style={[styles.noReview, { color: p.muted }]}>매일 새벽 등급을 기록해요. 내일부터 추이가 보여요.</Text>
                ) : (
                  <View style={styles.trend}>
                    {trend.slice(-14).map((t) => (
                      <View key={t.date} style={styles.trendCol}>
                        <View style={[styles.trendTrack, { backgroundColor: p.surface }]}>
                          <View style={[styles.trendFill, { height: `${Math.max(4, Math.min(100, t.petScore ?? 0))}%`, backgroundColor: t.petScore === null ? p.line : p.accent }]} />
                        </View>
                        <Text style={[styles.trendDay, { color: p.muted }]}>{t.date.slice(8, 10)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {weakest && (
                <View style={[styles.tip, { backgroundColor: p.accentSoft }]}>
                  <Ionicons name="bulb-outline" size={17} color={p.accent} />
                  <Text style={[styles.tipText, { color: p.ink }]}>
                    <Text style={{ fontWeight: '800' }}>{weakest.label}</Text> 점수가 가장 낮아요 ({weakest.value.toFixed(1)}). 이 부분을 보완하면 발자국 등급을 끌어올릴 수 있어요.
                  </Text>
                </View>
              )}
            </>
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
  title: { fontSize: 26, lineHeight: 35, fontWeight: '900', letterSpacing: -1 },
  kpis: { flexDirection: 'row', gap: Spacing.sm },
  kpi: { flex: 1, alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.md, paddingVertical: Spacing.lg },
  kpiLabel: { fontSize: 11, fontWeight: '700' },
  kpiValue: { fontSize: 16, fontWeight: '800' },
  note: { fontSize: 11.5, marginTop: -8 },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  noReview: { fontSize: 13, lineHeight: 20 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barLabel: { width: 78, fontSize: 13, fontWeight: '700' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { width: 30, fontSize: 12.5, fontWeight: '800', textAlign: 'right', fontVariant: ['tabular-nums'] },
  trend: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 96 },
  trendCol: { flex: 1, alignItems: 'center', gap: 3 },
  trendTrack: { width: '100%', height: 76, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  trendFill: { width: '100%', borderRadius: 4 },
  trendDay: { fontSize: 9.5, fontVariant: ['tabular-nums'] },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: Radius.md, padding: Spacing.md },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },
  empty: { fontSize: 14, textAlign: 'center', padding: 40 },
});
