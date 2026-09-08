import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  CONQUEROR_BADGES,
  badgeState,
  groupBySido,
  stampsThisMonth,
  type Stamp,
} from '@/data/stamps';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 여권 도장첩 (게임 요소 1단계) — 아이와 다녀온 곳을 시군구 단위로 모아 보여준다.
 *
 * 도장의 단위가 시군구인 건 관광공사 TourAPI가 `sigunguCode`까지만 주기 때문이다.
 * 그래서 이 화면의 진도는 그대로 관광 데이터 활용의 결과이기도 하다.
 *
 * ⚠️ 1단계는 인증이 목이다 — 사진을 받되 검사하지 않는다. 실제 비전 판별·GPS 대조는 2단계다.
 */
export default function StampsScreen() {
  const p = usePalette();
  const { stamps, stampRegions, reloadStampRegions, stampSaveFailed } = useAppStore();

  const progress = useMemo(() => groupBySido(stamps, stampRegions), [stamps, stampRegions]);
  const badges = useMemo(() => badgeState(stamps), [stamps]);
  const thisMonth = useMemo(() => stampsThisMonth(stamps), [stamps]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]} edges={['bottom']}>
      <Stack.Screen options={{ title: '여권 도장첩' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.wrap}>
          {/* 요약 — 지금까지 무엇을 모았는지 한 줄로 */}
          <View style={[styles.summary, { backgroundColor: p.surface, borderColor: p.line }]}>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryNum, { color: p.accent }]}>{badges.count}</Text>
              <Text style={[styles.summaryLabel, { color: p.muted }]}>모은 지역</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: p.line }]} />
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryNum, { color: p.accent }]}>{stamps.length}</Text>
              <Text style={[styles.summaryLabel, { color: p.muted }]}>전체 도장</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: p.line }]} />
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryNum, { color: p.accent }]}>{thisMonth.length}</Text>
              <Text style={[styles.summaryLabel, { color: p.muted }]}>이번 달</Text>
            </View>
          </View>

          {/* 기기에 못 남겼으면 알려야 한다. 화면에만 보이는 도장은 앱을 다시 켜면 사라진다 */}
          {stampSaveFailed && (
            <Text style={[styles.retryText, { color: p.muted }]}>
              도장을 이 기기에 저장하지 못했어요. 앱을 다시 켜면 사라질 수 있어요.
            </Text>
          )}

          {/* 뱃지 — 못 받은 것도 흐리게 보여준다. 다음 목표가 보여야 다음 도장을 찍는다 */}
          <Text style={[styles.sectionTitle, { color: p.ink }]}>뱃지</Text>
          <View style={styles.badgeRow}>
            {CONQUEROR_BADGES.map((b) => {
              const earned = badges.count >= b.need;
              return (
                <View
                  key={b.key}
                  style={[
                    styles.badge,
                    { borderColor: earned ? p.accent : p.line, backgroundColor: p.card },
                  ]}>
                  <Text style={[styles.badgeEmoji, !earned && styles.badgeLocked]}>{b.emoji}</Text>
                  <Text
                    style={[styles.badgeLabel, { color: earned ? p.ink : p.muted }]}
                    numberOfLines={1}>
                    {b.label}
                  </Text>
                  <Text style={[styles.badgeNeed, { color: p.muted }]}>{b.need}개 지역</Text>
                </View>
              );
            })}
          </View>
          {badges.next && (
            <Text style={[styles.hint, { color: p.muted }]}>
              {badges.next.badge.label}까지 {badges.next.remaining}개 지역 남았어요
            </Text>
          )}

          {/* 지역별 진도 */}
          <Text style={[styles.sectionTitle, { color: p.ink }]}>지역별 진도</Text>
          {/*
            트리를 못 받으면 분모가 사라져 "3 / 25"가 조용히 "3곳"이 된다. 그대로 두면
            사용자는 서버 장애를 "원래 이런 화면"으로 읽는다. 실패를 실패라고 말한다.
          */}
          {stampRegions.length === 0 && stamps.length > 0 && (
            <Pressable
              onPress={() => reloadStampRegions()}
              style={({ pressed }) => [
                styles.retryRow,
                { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
              ]}>
              <Ionicons name="refresh" size={15} color={p.muted} />
              <Text style={[styles.retryText, { color: p.muted }]}>
                지역 정보를 못 불러와 진도를 계산하지 못했어요. 눌러서 다시 시도하기
              </Text>
            </Pressable>
          )}
          {progress.length === 0 ? (
            <View style={[styles.empty, { borderColor: p.line, backgroundColor: p.card }]}>
              <Ionicons name="footsteps-outline" size={22} color={p.muted} />
              <Text style={[styles.emptyTitle, { color: p.ink }]}>아직 도장이 없어요</Text>
              <Text style={[styles.emptyBody, { color: p.muted }]}>
                아이와 다녀온 시설에서 인증샷을 남기면 그 지역 도장이 찍혀요.
              </Text>
            </View>
          ) : (
            progress.map((r) => (
              <View key={r.sido} style={[styles.regionCard, { borderColor: p.line, backgroundColor: p.card }]}>
                <View style={styles.regionHead}>
                  <Text style={[styles.regionName, { color: p.ink }]}>{r.sido}</Text>
                  <Text style={[styles.regionCount, { color: p.muted }]}>
                    {/* 지역 트리를 못 받으면 분모를 못 쓴다. 그때는 모은 개수만 보여준다 */}
                    {r.total > 0 ? `${r.collected.length} / ${r.total}` : `${r.collected.length}곳`}
                  </Text>
                </View>
                {r.total > 0 && (
                  <View style={[styles.barTrack, { backgroundColor: p.surface }]}>
                    <View
                      style={[
                        styles.barFill,
                        { backgroundColor: p.accent, width: `${Math.round(r.ratio * 100)}%` },
                      ]}
                    />
                  </View>
                )}
                <View style={styles.chipWrap}>
                  {r.collected.map((sg) => (
                    <View key={sg} style={[styles.chip, { borderColor: p.accent }]}>
                      <Text style={[styles.chipText, { color: p.accent }]}>{sg}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}

          {/* 최근 도장 */}
          {stamps.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: p.ink }]}>최근 도장</Text>
              {stamps.slice(0, 12).map((s) => (
                <StampRow key={`${s.facilityId}-${s.createdAt}`} stamp={s} />
              ))}
              {/* 잘린 것을 말하지 않으면 13번째부터는 사라진 것처럼 보인다 */}
              {stamps.length > 12 && (
                <Text style={[styles.retryText, { color: p.muted }]}>
                  외 {stamps.length - 12}개는 지역별 진도에 반영돼 있어요
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StampRow({ stamp }: { stamp: Stamp }) {
  const p = usePalette();
  // 웹 피커가 주는 `blob:` URI는 새로고침하면 죽고, 네이티브 캐시 경로도 OS가 회수할 수 있다.
  // 저장된 문자열만 보고 <Image>를 그리면 빈 사각형이 남아 사진 없는 도장보다 더 망가져 보인다.
  const [photoBroken, setPhotoBroken] = useState(false);
  // 저장된 값이 깨져도 줄 하나가 비칠 뿐 목록은 살린다
  const d = new Date(stamp.createdAt);
  const date = Number.isNaN(d.getTime())
    ? ''
    : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;

  return (
    <View style={[styles.stampRow, { borderColor: p.line, backgroundColor: p.card }]}>
      {stamp.photoUri && !photoBroken ? (
        <Image
          source={{ uri: stamp.photoUri }}
          style={styles.thumb}
          contentFit="cover"
          onError={() => setPhotoBroken(true)}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: p.surface }]}>
          <Ionicons name="paw" size={16} color={p.muted} />
        </View>
      )}
      <View style={styles.stampTexts}>
        <Text style={[styles.stampName, { color: p.ink }]} numberOfLines={1}>
          {stamp.facilityName}
        </Text>
        <Text style={[styles.stampMeta, { color: p.muted }]} numberOfLines={1}>
          {stamp.sido} {stamp.sigungu}
          {date ? ` · ${date}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: Spacing.xl },
  wrap: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.lg, gap: 10 },

  summary: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: Spacing.lg,
  },
  summaryCell: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: 1, alignSelf: 'stretch', marginVertical: 6 },
  summaryNum: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 11.5 },

  sectionTitle: { fontSize: 13.5, fontWeight: '800', marginTop: 10 },
  hint: { fontSize: 11.5, marginTop: -2 },

  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: {
    flex: 1, alignItems: 'center', gap: 3,
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: 12, ...CardShadow,
  },
  badgeEmoji: { fontSize: 22 },
  // 못 받은 뱃지는 지우지 않고 흐리게 둔다 — 무엇을 향해 가는지 보여야 한다
  badgeLocked: { opacity: 0.25 },
  badgeLabel: { fontSize: 12, fontWeight: '700' },
  badgeNeed: { fontSize: 10.5 },

  regionCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, gap: 8 },
  regionHead: { flexDirection: 'row', alignItems: 'center' },
  regionName: { fontSize: 13.5, fontWeight: '800' },
  regionCount: { fontSize: 11.5, marginLeft: 'auto' },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11.5, fontWeight: '700' },

  empty: {
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.xl,
  },
  retryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: Spacing.lg,
  },
  retryText: { fontSize: 11.5, flexShrink: 1 },
  emptyTitle: { fontSize: 13.5, fontWeight: '800' },
  emptyBody: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  stampRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: Radius.md, padding: 10,
  },
  thumb: { width: 40, height: 40, borderRadius: Radius.sm },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  stampTexts: { flexShrink: 1, gap: 2 },
  stampName: { fontSize: 13, fontWeight: '700' },
  stampMeta: { fontSize: 11.5 },
});
