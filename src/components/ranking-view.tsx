import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { PawBadge } from '@/components/paw-badge';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { FACILITIES, REGIONS, formatDistance } from '@/data/mock';
import { CATEGORY_LABEL, PAW_MIN_REVIEWS, pawGradeOf, type Category } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
const RADIUS_PRESETS = [1, 3, 10];

/**
 * 발자국 랭킹 본문 — 지역·거리·카테고리 필터 + 등급 순 목록.
 * 탐색 탭(토글)과 (탭 분리 롤백 시) 랭킹 탭 양쪽에서 재사용한다.
 * Screen 래퍼는 호출부가 담당한다.
 */
export function RankingView() {
  const p = usePalette();
  const router = useRouter();
  const { reviewsOf } = useAppStore();
  const [category, setCategory] = useState<Category | null>(null);
  const [sido, setSido] = useState<string | null>(null);
  const [sigungu, setSigungu] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customRadius, setCustomRadius] = useState('');

  const sigunguOptions = sido ? (REGIONS.find((r) => r.sido === sido)?.sigungus ?? []) : [];

  const ranked = useMemo(() => {
    return FACILITIES.map((f) => ({ facility: f, grade: pawGradeOf(reviewsOf(f.facilityId)) }))
      .filter((x) => x.grade.level !== null)
      .filter((x) => !category || x.facility.category === category)
      .filter((x) => !sido || x.facility.sido === sido)
      .filter((x) => !sigungu || x.facility.sigungu === sigungu)
      .filter((x) => radiusKm == null || (x.facility.distanceM != null && x.facility.distanceM <= radiusKm * 1000))
      .sort(
        (a, b) =>
          (b.grade.level ?? 0) - (a.grade.level ?? 0) || (b.grade.score ?? 0) - (a.grade.score ?? 0),
      );
  }, [reviewsOf, category, sido, sigungu, radiusKm]);

  const pickPreset = (km: number) => {
    setCustomMode(false);
    setRadiusKm(km);
  };
  const onCustomChange = (t: string) => {
    setCustomRadius(t);
    const n = Number(t);
    setRadiusKm(t.trim() && !Number.isNaN(n) && n > 0 ? n : null);
  };

  return (
    <>
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

      {/* 지역 — 시도 → 시군구 (관광공사 areaCode/sigunguCode) */}
      <Text style={[styles.filterLabel, { color: p.muted }]}>지역</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label="전국"
          selected={sido === null}
          onPress={() => {
            setSido(null);
            setSigungu(null);
          }}
        />
        {REGIONS.map((r) => (
          <Chip
            key={r.sido}
            label={r.sido}
            selected={sido === r.sido}
            onPress={() => {
              setSido(sido === r.sido ? null : r.sido);
              setSigungu(null);
            }}
          />
        ))}
      </ScrollView>
      {sido && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="전체" selected={sigungu === null} onPress={() => setSigungu(null)} />
          {sigunguOptions.map((sg) => (
            <Chip
              key={sg}
              label={sg}
              selected={sigungu === sg}
              onPress={() => setSigungu(sigungu === sg ? null : sg)}
            />
          ))}
        </ScrollView>
      )}

      {/* 거리 — 프리셋 + 직접 입력 */}
      <Text style={[styles.filterLabel, { color: p.muted }]}>거리</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label="전체"
          selected={radiusKm === null && !customMode}
          onPress={() => {
            setCustomMode(false);
            setRadiusKm(null);
          }}
        />
        {RADIUS_PRESETS.map((km) => (
          <Chip
            key={km}
            label={`${km}km`}
            selected={!customMode && radiusKm === km}
            onPress={() => pickPreset(km)}
          />
        ))}
        <Chip label="직접 입력" selected={customMode} onPress={() => setCustomMode(true)} />
      </ScrollView>
      {customMode && (
        <View style={[styles.customRow, { backgroundColor: p.surface, borderColor: p.line }]}>
          <TextInput
            value={customRadius}
            onChangeText={onCustomChange}
            placeholder="반경 직접 입력"
            placeholderTextColor={p.muted}
            keyboardType="number-pad"
            style={[styles.customInput, { color: p.ink }]}
          />
          <Text style={[styles.customUnit, { color: p.muted }]}>km 이내</Text>
        </View>
      )}

      {/* 카테고리 */}
      <Text style={[styles.filterLabel, { color: p.muted }]}>카테고리</Text>
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

      <Text style={[styles.count, { color: p.muted }]}>{ranked.length}곳</Text>

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
    </>
  );
}

const styles = StyleSheet.create({
  legend: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: 6 },
  legendTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendTitle: { fontSize: 13.5, fontWeight: '800' },
  legendBody: { fontSize: 12.5, lineHeight: 19 },
  filterLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  chips: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.xl },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  customInput: { flex: 1, fontSize: 14.5, padding: 0 },
  customUnit: { fontSize: 13, fontWeight: '700' },
  count: { fontSize: 12.5, fontWeight: '700', marginTop: 2 },
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
