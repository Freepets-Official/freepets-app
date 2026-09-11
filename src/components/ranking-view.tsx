import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/text';
import { Chip } from '@/components/chip';
import { PawBadge } from '@/components/paw-badge';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { formatDistance } from '@/data/mock';
import { CATEGORY_LABEL, type Category, type RankingItem, type Region } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { facilitiesApi } from '@/lib/api';
import type { Coords } from '@/lib/location';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
const RADIUS_PRESETS = [1, 3, 10];

/**
 * 발자국 랭킹 본문 — 지역·거리·카테고리 필터 + 등급 순 목록.
 * 탐색 탭(토글)과 (탭 분리 롤백 시) 랭킹 탭 양쪽에서 재사용한다.
 * Screen 래퍼는 호출부가 담당한다.
 *
 * 목록·순위·정렬을 전부 서버가 준다(`GET /facilities/ranking`). 클라이언트에서 다시 거르거나
 * 정렬하지 않는다 — 페이지네이션과 total이 어긋나고, 정렬 규칙(등급 우선 → 점수)이 점수순과
 * 달라서 프론트가 흉내 내면 순서가 뒤집힌다(95점·리뷰20건 1등급이 85점·리뷰100건 3등급보다 뒤).
 */
export function RankingView({ coords }: { coords: Coords | null }) {
  const p = usePalette();
  const router = useRouter();

  const [category, setCategory] = useState<Category | null>(null);
  const [sidoCode, setSidoCode] = useState<string | null>(null);
  const [sigunguCode, setSigunguCode] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customRadius, setCustomRadius] = useState('');

  const [regions, setRegions] = useState<Region[]>([]);
  const [items, setItems] = useState<RankingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // 지역을 고르면 거리 필터를 잠근다. 서버는 지역과 거리를 AND로 겹치므로, 서울에 있는 사용자가
  // 강원 + 1km를 고르면 교집합이 비어 **항상 0건**이 된다. 고를 수 없게 막는 편이 0건을 나중에
  // 설명하는 것보다 낫다.
  const distanceLocked = sidoCode !== null;
  const selectedSido = regions.find((r) => r.sidoCode === sidoCode) ?? null;

  // 지역 목록은 필터와 무관하므로 한 번만 받는다. 비어 있으면 연동 실패가 아니라 서버의 지역
  // 테이블 적재 전이다(랭킹의 리뷰 집계 백필과는 별개 조건).
  useEffect(() => {
    let active = true;
    facilitiesApi
      .regions()
      .then((r) => active && setRegions(r))
      .catch(() => active && setRegions([]));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    // setState를 effect 본문에서 동기로 부르지 않는다(연쇄 렌더 경고). 디바운스 안으로 넣으면
    // 300ms 동안 직전 목록이 그대로 보여서 필터를 연달아 바꿀 때 깜빡임도 줄어든다.
    const t = setTimeout(async () => {
      if (!active) return;
      setLoading(true);
      setFailed(false);
      try {
        const res = await facilitiesApi.ranking({
          // 좌표는 거리 표시용으로 항상 싣는다. 지역을 골랐을 땐 radiusM만 빼서 "그 지역 전체"가
          // 나오게 한다(좌표를 빼면 거리가 전부 '미상'이 된다).
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          radiusM: distanceLocked || radiusKm == null ? undefined : radiusKm * 1000,
          sidoCode: sidoCode ?? undefined,
          sigunguCode: sigunguCode ?? undefined,
          category: category ?? undefined,
          size: 30,
        });
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
      } catch {
        if (!active) return;
        setItems([]);
        setTotal(0);
        setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [coords, sidoCode, sigunguCode, category, radiusKm, distanceLocked, retryKey]);

  const pickPreset = (km: number) => {
    setCustomMode(false);
    setRadiusKm(km);
  };
  const onCustomChange = (t: string) => {
    setCustomRadius(t);
    const n = Number(t);
    setRadiusKm(t.trim() && !Number.isNaN(n) && n > 0 ? n : null);
  };
  const clearRegion = useCallback(() => {
    setSidoCode(null);
    setSigunguCode(null);
  }, []);

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

      {/* 지역 — 시도 → 시군구. 목록도 코드도 서버가 준다(지명이 바뀌어도 어긋나지 않는다) */}
      <Text style={[styles.filterLabel, { color: p.muted }]}>지역</Text>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="전국" selected={sidoCode === null} onPress={clearRegion} />
        {regions.map((r) => (
          <Chip
            key={r.sidoCode}
            label={r.sido}
            selected={sidoCode === r.sidoCode}
            onPress={() => {
              setSidoCode(sidoCode === r.sidoCode ? null : r.sidoCode);
              setSigunguCode(null);
            }}
          />
        ))}
      </ScrollView>
      {selectedSido && selectedSido.sigungus.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="전체" selected={sigunguCode === null} onPress={() => setSigunguCode(null)} />
          {selectedSido.sigungus.map((sg) => (
            <Chip
              key={sg.sigunguCode}
              label={sg.sigungu}
              selected={sigunguCode === sg.sigunguCode}
              onPress={() => setSigunguCode(sigunguCode === sg.sigunguCode ? null : sg.sigunguCode)}
            />
          ))}
        </ScrollView>
      )}

      {/* 거리 — 지역을 고르면 잠긴다(위 distanceLocked 주석 참조) */}
      <View style={styles.filterHead}>
        <Text style={[styles.filterLabel, { color: p.muted }]}>거리</Text>
        {distanceLocked && (
          <Text style={[styles.filterNote, { color: p.muted }]}>
            {selectedSido?.sido ?? '선택한 지역'} 전체를 보는 중
          </Text>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label="전체"
          selected={radiusKm === null && !customMode}
          disabled={distanceLocked}
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
            disabled={distanceLocked}
            onPress={() => pickPreset(km)}
          />
        ))}
        <Chip
          label="직접 입력"
          selected={customMode}
          disabled={distanceLocked}
          onPress={() => setCustomMode(true)}
        />
      </ScrollView>
      {customMode && !distanceLocked && (
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

      {!loading && !failed && <Text style={[styles.count, { color: p.muted }]}>{total}곳</Text>}

      <View style={styles.list}>
        {loading && (
          <View style={styles.state}>
            <ActivityIndicator color={p.accent} />
            <Text style={[styles.stateText, { color: p.muted }]}>랭킹을 불러오는 중…</Text>
          </View>
        )}

        {/* 실패와 "결과 없음"은 다른 화면이다 — 실패는 다시 시도가 의미 있지만 0건은 아니다 */}
        {!loading && failed && (
          <View style={[styles.stateCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
            <Ionicons name="cloud-offline-outline" size={30} color={p.muted} />
            <Text style={[styles.stateTitle, { color: p.ink }]}>랭킹을 불러오지 못했어요</Text>
            <Text style={[styles.stateSub, { color: p.muted }]}>잠시 후 다시 시도해 주세요.</Text>
            <Pressable
              onPress={() => setRetryKey((k) => k + 1)}
              style={({ pressed }) => [
                styles.retry,
                { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' },
              ]}>
              <Text style={[styles.retryText, { color: p.accent }]}>다시 시도</Text>
            </Pressable>
          </View>
        )}

        {!loading &&
          !failed &&
          items.map((it) => (
            <Pressable
              key={it.facilityId}
              onPress={() =>
                router.push({ pathname: '/facility/[id]', params: { id: String(it.facilityId) } })
              }
              style={({ pressed }) => [
                styles.card,
                CardShadow,
                { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.92 : 1 },
              ]}>
              {/* 순위는 서버 값이다. 배열 인덱스로 다시 매기면 2페이지 첫 행이 1위가 된다 */}
              <Text style={[styles.rank, { color: it.rank <= 3 ? p.accent : p.muted }]}>{it.rank}</Text>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: p.ink }]} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={[styles.cat, { color: p.muted }]}>{CATEGORY_LABEL[it.category]}</Text>
                </View>
                <PawBadge
                  grade={{
                    level: it.pawLevel,
                    label: it.pawLabel,
                    score: it.petScore,
                    count: it.reviewCnt,
                    needMore: 0,
                  }}
                  size="sm"
                />
                <Text style={[styles.meta, { color: p.muted }]}>
                  리뷰 {it.reviewCnt}건 · 친화도 {it.petScore.toFixed(0)}점
                  {it.sigungu ? ` · ${it.sigungu}` : ''} · {formatDistance(it.distanceM)}
                </Text>
              </View>
            </Pressable>
          ))}

        {!loading && !failed && items.length === 0 && (
          <Text style={[styles.empty, { color: p.muted }]}>
            {sidoCode
              ? `${selectedSido?.sido ?? '이 지역'}에는 아직 발자국 등급을 받은 시설이 없어요.\n다른 지역을 골라보세요.`
              : '아직 발자국 등급을 받은 시설이 없어요.\n리뷰가 쌓이면 순위가 만들어집니다.'}
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
  filterHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  filterLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  filterNote: { fontSize: 11.5, fontWeight: '600' },
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
  state: { alignItems: 'center', gap: Spacing.md, paddingVertical: 48 },
  stateText: { fontSize: 13.5 },
  stateCard: {
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: 32,
    paddingHorizontal: Spacing.lg,
  },
  stateTitle: { fontSize: 15, fontWeight: '800' },
  stateSub: { fontSize: 12.5 },
  retry: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  retryText: { fontSize: 13, fontWeight: '800' },
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
