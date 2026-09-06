import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { FacilityCard } from '@/components/facility-card';
import { RankingView } from '@/components/ranking-view';
import { Screen } from '@/components/screen';
import { SectionTitle } from '@/components/section-title';
import { Radius, Spacing } from '@/constants/theme';
import { CATEGORY_LABEL, type Category, type Facility } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { facilitiesApi } from '@/lib/api';
import { getCurrentLocation, type Coords } from '@/lib/location';
import { useAppStore } from '@/store/app-store';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

/**
 * 탐색 탭. "내 주변"(거리순 목록)과 "발자국 랭킹"(등급순)을 상단 토글로 전환한다.
 * 원래 별도 탭이던 랭킹을 흡수한 것 — 성격이 비슷해 탭을 나누면 스크롤만 길어졌다.
 * 롤백(탭 재분리)하려면 이 토글을 걷어내고 _layout의 ranking href:null만 지우면 된다.
 */
type Mode = 'nearby' | 'all' | 'ranking';

// 전체 모드: 내 주변보다 훨씬 넓게 검색. 위치 권한이 없어도 되게 기본 중심(서울)을 둔다.
// 백엔드가 반경을 최대 100km로 제한(200km↑는 400)하므로 그 상한을 쓴다. 진짜 전국(키워드 전역)
// 검색은 반경 무제한/키워드 전역 API가 나오면 교체.
const RADIUS_ALL_M = 100_000;
const DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 };

const HEADER: Record<Mode, { eyebrow: string; title: string; subtitle: string }> = {
  nearby: {
    eyebrow: '반려동물 동반여행',
    title: '가도 될까?',
    subtitle: '시설마다 다른 출입 조건, AI가 우리 아이 기준으로 판단해 드려요.',
  },
  all: {
    eyebrow: '반려동물 동반여행',
    title: '어디든 찾아봐요',
    subtitle: '내 주변을 넘어 넓은 범위에서, 지역·이름으로 검색해요.',
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
  const { settings, updateSettings, registerFacilities, setLastCoords } = useAppStore();
  const [mode, setMode] = useState<Mode>('nearby');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<Category | null>(null);

  // 실제 GPS로 내 위치를 잡고, 관광공사 시설을 거리순으로 검색한다.
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locState, setLocState] = useState<'loading' | 'denied' | 'ok'>('loading');
  const [items, setItems] = useState<Facility[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  // 검색 실패(네트워크·CORS·인증)와 '조건에 맞는 게 없음'은 사용자가 할 일이 정반대인데,
  // 예전엔 catch가 조용히 빈 배열만 넣어 둘 다 "조건을 바꿔 보세요"로 보였다.
  // 실제로 CORS 403을 반경 문제로 오해해 한참 헤맨 적이 있다.
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const locate = () => {
    setLocState('loading');
    getCurrentLocation().then((c) => {
      setCoords(c);
      // 시설 상세가 거리(distanceM)를 받으려면 좌표가 필요하다. 상세에서 권한을 다시
      // 묻지 않도록 여기서 잡은 값을 스토어에 넘겨둔다.
      setLastCoords(c);
      setLocState(c ? 'ok' : 'denied');
    });
  };
  // locate가 setLastCoords를 닫고 있지만 스토어 setter는 안정적이다 — 최초 1회만 실행한다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(locate, []);

  // 좌표·검색어·카테고리·반경·모드가 바뀌면 재검색(입력 타이핑은 400ms 디바운스).
  // 전체 모드는 위치 없이도 되도록 기본 중심을 쓰고 반경을 전국으로 넓힌다.
  useEffect(() => {
    if (mode === 'ranking') return;
    const center = mode === 'all' ? coords ?? DEFAULT_CENTER : coords;
    if (!center) return; // 내 주변인데 위치 권한이 없으면 검색하지 않는다
    // 디바운스 타이머만 취소하면 '이미 날아간' 요청은 못 막는다. 모드·검색어를 빠르게
    // 바꾸면 늦게 도착한 이전 응답이 현재 결과를 덮어쓸 수 있어, active 플래그로 무효화한다.
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await facilitiesApi.search({
          latitude: center.latitude,
          longitude: center.longitude,
          keyword: keyword.trim() || undefined,
          category: category ?? undefined,
          radiusM: mode === 'all' ? RADIUS_ALL_M : settings.searchRadiusKm * 1000,
          // 클라이언트에서 거르지 않고 서버 필터를 쓴다 — 30건 받아와서 6건만 남기면
          // 페이지네이션과 total이 어긋난다. hideDenied가 클라이언트인 건 대상이 16건뿐이라서다.
          petAllowed: settings.onlyPetInfo ? 'ALLOWED' : undefined,
          size: 30,
        });
        if (!active) return; // 그 사이 모드/조건이 바뀌었으면 이 응답은 버린다
        setItems(res.items);
        setTotal(res.total);
        registerFacilities(res.items);
      } catch {
        if (!active) return;
        setItems([]);
        setTotal(0);
        setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [mode, coords, keyword, category, settings.searchRadiusKm, settings.onlyPetInfo, retryKey, registerFacilities]);

  // '동반 불가 숨기기' 설정은 클라이언트에서 거른다(서버 필터는 단일값이라)
  const facilities = useMemo(
    () => items.filter((f) => !(settings.hideDenied && f.petAllowed === false)),
    [items, settings.hideDenied],
  );

  return (
    <Screen {...HEADER[mode]}>
      {/* 내 주변 ↔ 발자국 랭킹 전환 */}
      <View style={[styles.segment, { backgroundColor: p.surface, borderColor: p.line }]}>
        {(
          [
            { key: 'nearby', icon: 'location', label: '내 주변' },
            { key: 'all', icon: 'earth', label: '전체' },
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
            {/* 성격이 다른 필터라 카테고리 칩과 구분되게 맨 앞에 둔다 */}
            <Chip
              label="동반 정보 있는 곳만"
              selected={settings.onlyPetInfo}
              onPress={() => updateSettings({ onlyPetInfo: !settings.onlyPetInfo })}
            />
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

          <SectionTitle
            title={mode === 'all' ? '전체 시설' : '내 주변 시설'}
            caption={
              mode === 'all'
                ? `${total.toLocaleString()}곳 · 넓은 범위`
                : locState === 'ok'
                  ? `${total.toLocaleString()}곳 · 내 위치 기준`
                  : '내 위치 기준'
            }
          />

          {/* 위치 권한 안내는 '내 주변'에서만 — '전체'는 위치 없이 전국을 검색한다 */}
          {mode === 'nearby' && locState === 'denied' ? (
            <View style={styles.empty}>
              <Ionicons name="location-outline" size={30} color={p.muted} />
              <Text style={[styles.emptyText, { color: p.muted }]}>
                내 주변 시설을 보려면 위치 권한이 필요해요.
              </Text>
              <Pressable
                onPress={locate}
                style={({ pressed }) => [styles.retry, { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' }]}>
                <Ionicons name="navigate" size={15} color={p.accent} />
                <Text style={[styles.retryText, { color: p.accent }]}>위치 다시 시도</Text>
              </Pressable>
            </View>
          ) : (mode === 'nearby' && locState === 'loading') || (loading && items.length === 0) ? (
            <View style={styles.empty}>
              <ActivityIndicator color={p.accent} />
              <Text style={[styles.emptyText, { color: p.muted }]}>
                {mode === 'all' ? '시설을 찾고 있어요…' : '내 주변 시설을 찾고 있어요…'}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {facilities.map((f) => (
                <FacilityCard key={f.facilityId} facility={f} />
              ))}
              {facilities.length === 0 &&
                (failed ? (
                  <View style={styles.empty}>
                    <Ionicons name="cloud-offline-outline" size={30} color={p.muted} />
                    <Text style={[styles.emptyText, { color: p.muted }]}>
                      시설 정보를 불러오지 못했어요.{'\n'}네트워크 상태를 확인하고 다시 시도해 주세요.
                    </Text>
                    <Pressable
                      onPress={() => setRetryKey((k) => k + 1)}
                      style={({ pressed }) => [
                        styles.retry,
                        { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' },
                      ]}>
                      <Ionicons name="refresh" size={15} color={p.accent} />
                      <Text style={[styles.retryText, { color: p.accent }]}>다시 시도</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.empty}>
                    <Ionicons name="search" size={30} color={p.muted} />
                    <Text style={[styles.emptyText, { color: p.muted }]}>
                      조건에 맞는 시설이 없어요.{'\n'}검색어·카테고리·반경(설정)을 바꿔 보세요.
                    </Text>
                  </View>
                ))}
            </View>
          )}
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
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 4,
  },
  retryText: { fontSize: 13.5, fontWeight: '800' },
});
