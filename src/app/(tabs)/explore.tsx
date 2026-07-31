import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { FacilityCard } from '@/components/facility-card';
import { LocationBanner } from '@/components/location-banner';
import { RankingView } from '@/components/ranking-view';
import { Screen } from '@/components/screen';
import { SectionTitle } from '@/components/section-title';
import { Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { CATEGORY_LABEL, type Category } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

/**
 * 탐색 탭. "내 주변"(거리순 목록)과 "발자국 랭킹"(등급순)을 상단 토글로 전환한다.
 * 원래 별도 탭이던 랭킹을 흡수한 것 — 성격이 비슷해 탭을 나누면 스크롤만 길어졌다.
 * 롤백(탭 재분리)하려면 이 토글을 걷어내고 _layout의 ranking href:null만 지우면 된다.
 */
type Mode = 'nearby' | 'ranking';

const HEADER: Record<Mode, { eyebrow: string; title: string; subtitle: string }> = {
  nearby: {
    eyebrow: '반려동물 동반여행',
    title: '가도 될까?',
    subtitle: '시설마다 다른 출입 조건, AI가 우리 아이 기준으로 판단해 드려요.',
  },
  ranking: {
    eyebrow: '반려동물 동반여행',
    title: '어디가 좋을까?',
    subtitle: '반려동물과 얼마나 편했는지, 실제 방문자 리뷰로만 매긴 발자국 등급이에요.',
  },
};

export default function ExploreScreen() {
  const p = usePalette();
  const router = useRouter();
  const { settings } = useAppStore();
  const [mode, setMode] = useState<Mode>('nearby');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<Category | null>(null);

  const facilities = useMemo(() => {
    const q = keyword.trim();
    return FACILITIES.filter((f) => {
      if (settings.hideDenied && f.petAllowed === false) return false;
      if (category && f.category !== category) return false;
      if (q && !f.name.includes(q) && !f.address.includes(q)) return false;
      return true;
    }).sort((a, b) => a.distanceM - b.distanceM);
  }, [keyword, category, settings.hideDenied]);

  return (
    <Screen {...HEADER[mode]}>
      {/* 내 주변 ↔ 발자국 랭킹 전환 */}
      <View style={[styles.segment, { backgroundColor: p.surface, borderColor: p.line }]}>
        {(
          [
            { key: 'nearby', icon: 'location', label: '내 주변' },
            { key: 'ranking', icon: 'trophy', label: '발자국 랭킹' },
          ] as const
        ).map((tab) => {
          const active = mode === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setMode(tab.key)}
              style={[styles.segmentItem, active && { backgroundColor: p.card }]}>
              <Ionicons
                name={active ? tab.icon : (`${tab.icon}-outline` as const)}
                size={16}
                color={active ? p.accent : p.muted}
              />
              <Text style={[styles.segmentLabel, { color: active ? p.ink : p.muted }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'ranking' ? (
        <RankingView />
      ) : (
        <>
          <View style={[styles.search, { backgroundColor: p.surface, borderColor: p.line }]}>
            <Ionicons name="search" size={18} color={p.muted} />
            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              placeholder="시설명이나 지역으로 검색"
              placeholderTextColor={p.muted}
              style={[styles.searchInput, { color: p.ink }]}
            />
            {keyword.length > 0 && (
              <Ionicons name="close-circle" size={17} color={p.muted} onPress={() => setKeyword('')} />
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
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

          {/* 여행 코스 판별 진입점 — 낱개 시설이 아니라 하루 동선 전체를 검증한다 */}
          <Pressable
            onPress={() => router.push('/course')}
            style={({ pressed }) => [
              styles.courseCta,
              { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : p.card },
            ]}>
            <View style={[styles.courseIcon, { backgroundColor: p.accentSoft }]}>
              <Ionicons name="map" size={20} color={p.accent} />
            </View>
            <View style={styles.courseText}>
              <Text style={[styles.courseTitle, { color: p.ink }]}>여행 코스 판별</Text>
              <Text style={[styles.courseBody, { color: p.muted }]}>
                여러 곳을 코스로 묶어 하루 동선을 한 번에 확인해요
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.accent} />
          </Pressable>

          {/* 위치 권한 요청 (UX만 — 실거리 정렬은 API 연동 후) */}
          <LocationBanner />

          <SectionTitle title="내 주변 시설" caption={`${facilities.length}곳 · 강릉역 기준`} />

          <View style={styles.list}>
            {facilities.map((f) => (
              <FacilityCard key={f.facilityId} facility={f} />
            ))}
            {facilities.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="search" size={30} color={p.muted} />
                <Text style={[styles.emptyText, { color: p.muted }]}>
                  조건에 맞는 시설이 없어요.{'\n'}검색어나 카테고리를 바꿔 보세요.
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: Radius.full,
    paddingVertical: 9,
  },
  segmentLabel: { fontSize: 13.5, fontWeight: '800', letterSpacing: -0.2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  chips: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.xl },
  list: { gap: Spacing.md },
  courseCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  courseIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseText: { flex: 1, gap: 2 },
  courseTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  courseBody: { fontSize: 12, lineHeight: 17 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 56 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
