import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/text';
import { Chip } from '@/components/chip';
import { FacilityCard } from '@/components/facility-card';
import { LoadState } from '@/components/load-state';
import { RankingView } from '@/components/ranking-view';
import { RegionChips, sigunguHasDistricts, useRegions } from '@/components/region-chips';
import { Screen } from '@/components/screen';
import { SectionTitle } from '@/components/section-title';
import { Radius, Spacing, Type } from '@/constants/theme';
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
const DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 };

/**
 * 시군구 목록 캐시.
 *
 * 이 API는 **요청마다 관광공사를 실시간으로 부른다.** 칩을 왔다갔다 하면 그대로 호출이 쌓이고,
 * 일일 한도를 넘기면 야간 적재 배치까지 같이 죽는다(배치는 DB 폴백이 없다). 같은 조건을
 * 다시 고르면 네트워크를 타지 않게 앱 수명 동안 들고 있는다 — 시설 목록은 분 단위로 바뀌지 않는다.
 */
const regionCache = new Map<string, { items: Facility[]; total: number }>();

/** 한 번에 받는 개수. 두 경로(지역·검색)가 같은 값을 써야 「더 보기」 계산이 한 가지로 끝난다 */
const PAGE_SIZE = 30;

async function regionList(params: {
  sidoCode: string;
  /** 생략하면 시도 전체 */
  sigunguCode?: string;
  category?: Category;
  petAllowed?: 'ALLOWED';
  page: number;
}): Promise<{ items: Facility[]; total: number }> {
  // 캐시 키에 페이지가 들어가야 한다 — 빼면 2페이지를 1페이지 응답으로 돌려준다
  const key = `${params.sidoCode}/${params.sigunguCode ?? ''}/${params.category ?? ''}/${params.petAllowed ?? ''}/${params.page}`;
  const hit = regionCache.get(key);
  if (hit) return hit;
  const res = await facilitiesApi.byRegion({ ...params, size: PAGE_SIZE });
  regionCache.set(key, res);
  return res;
}

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
  // '전체' 모드의 지역 선택. 시군구까지 고르면 관광공사 실시간 목록으로 갈아탄다.
  // 지역 목록은 모듈 캐시라 RegionChips와 같은 값을 공유한다 — 여기서 부른다고 더 받지 않는다
  const regions = useRegions();
  const [sidoCode, setSidoCode] = useState<string | null>(null);
  const [sigunguCode, setSigunguCode] = useState<string | null>(null);

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
  /**
   * 「더 보기」로 이어 받은 페이지.
   *
   * 예전에는 어느 경로든 **30건만 받고 끝**이었다. 그런데 캡션에는 서버가 준 전체 건수를
   * 적어서, 「48,786곳 · 전국」이라 말하고 30곳만 보여주고 있었다. 경기도를 고르면 9,469곳이라
   * 적고 30곳을 주는 식이다 — 화면이 거짓을 말하는 쪽이 문제다.
   */
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

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
  /**
   * 지역을 고르면 **지역 목록**(`facilitiesApi.byRegion`)으로 간다. 시도만 골라도 된다.
   *
   * 예전에는 시군구가 필수라, 시도만 고른 상태는 목록이 멈춘 채 "시·군·구까지 골라 주세요"
   * 안내만 떴다. 「경기도 전체」를 보려던 사용자에게는 고를 것이 55개 더 남은 셈이었다.
   * 서버가 시도 단위를 적재해둔 DB로 답하게 되면서(2026-09-27 실측: 경기 9,469건 0.11초)
   * 그 한 걸음이 필요 없어졌다.
   *
   * **검색어가 있으면 지역 조회로 가지 않는다.** 이 API는 키워드를 받지 않아서(`sidoCode`·
   * `sigunguCode`·`category`·`petAllowed`뿐), 지역을 고른 채로 검색어를 치면 글자가
   * 통째로 버려진다. 검색어 쪽을 살리고 — 그쪽은 전국을 훑는다 — 지역이 꺼졌다는 것을
   * 아래 안내 줄로 밝힌다. 조용히 무시하는 것이 가장 나쁘다.
   */
  const searching = keyword.trim().length > 0;
  const byRegion = mode === 'all' && sidoCode !== null && !searching;
  /** 지역을 골라 뒀는데 검색어 때문에 그 필터가 꺼져 있는 상태 */
  const regionMuted = mode === 'all' && sidoCode !== null && searching;
  /**
   * 「구가 있는 시」를 골랐는데 0건인 경우.
   *
   * 규칙으로 못 박지 않고 **실제 결과가 0일 때만** 켠다 — 화성시는 구가 2026년에 신설돼
   * 자료가 아직 시 단위에 남아 있다(시 304건, 구 합계 78건). 같은 모양인데 반대로 동작한다.
   */
  const districtHint =
    byRegion && sigunguCode !== null && sigunguHasDistricts(regions, sidoCode, sigunguCode);

  useEffect(() => {
    if (mode === 'ranking') return;
    const center = mode === 'all' ? coords ?? DEFAULT_CENTER : coords;
    if (!byRegion && !center) return; // 내 주변인데 위치 권한이 없으면 검색하지 않는다
    // 디바운스 타이머만 취소하면 '이미 날아간' 요청은 못 막는다. 모드·검색어를 빠르게
    // 바꾸면 늦게 도착한 이전 응답이 현재 결과를 덮어쓸 수 있어, active 플래그로 무효화한다.
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = byRegion
          ? await regionList({
              sidoCode: sidoCode as string,
              sigunguCode: sigunguCode ?? undefined,
              category: category ?? undefined,
              petAllowed: settings.onlyPetInfo ? 'ALLOWED' : undefined,
              page: 0,
            })
          : await facilitiesApi.search({
              latitude: center!.latitude,
              longitude: center!.longitude,
              keyword: keyword.trim() || undefined,
              category: category ?? undefined,
              /**
               * **전체 모드는 반경을 보내지 않는다 — 생략이 곧 전국이다**(`api-specs/facility.md`).
               *
               * 예전엔 상한인 100km를 보냈는데, 기준점이 서울이라 전국 48,743곳 중 21,809곳만
               * 잡혔다(2026-09-20 실측). "전체 시설"이라고 적어놓고 절반만 보여주던 셈이다.
               * 반경을 빼면 서버가 전 건을 대상으로 거리순 정렬한다 — 응답도 더 빨랐다(0.15s vs 0.20s).
               */
              radiusM: mode === 'all' ? undefined : settings.searchRadiusKm * 1000,
              // 클라이언트에서 거르지 않고 서버 필터를 쓴다 — 30건 받아와서 6건만 남기면
              // 페이지네이션과 total이 어긋난다.
              petAllowed: settings.onlyPetInfo ? 'ALLOWED' : undefined,
              size: PAGE_SIZE,
            });
        if (!active) return; // 그 사이 모드/조건이 바뀌었으면 이 응답은 버린다
        setItems(res.items);
        setTotal(res.total);
        setPage(0); // 조건이 바뀌면 이어 받던 페이지도 처음으로 돌아간다
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
  }, [mode, coords, keyword, category, settings.searchRadiusKm, settings.onlyPetInfo, retryKey, registerFacilities, byRegion, sidoCode, sigunguCode]);

  /**
   * 다음 30곳을 이어 받는다.
   *
   * 디바운스를 거치지 않는다 — 손으로 누른 동작이라 미룰 이유가 없다. 실패하면 목록을 비우지
   * 않고 그대로 둔다(이미 받은 것은 멀쩡하다). 조건이 바뀌면 위 effect가 page를 0으로 되돌린다.
   */
  const loadMore = async () => {
    if (loadingMore || loading) return;
    const next = page + 1;
    const center = mode === 'all' ? coords ?? DEFAULT_CENTER : coords;
    if (!byRegion && !center) return;
    setLoadingMore(true);
    try {
      const res = byRegion
        ? await regionList({
            sidoCode: sidoCode as string,
            sigunguCode: sigunguCode ?? undefined,
            category: category ?? undefined,
            petAllowed: settings.onlyPetInfo ? 'ALLOWED' : undefined,
            page: next,
          })
        : await facilitiesApi.search({
            latitude: center!.latitude,
            longitude: center!.longitude,
            keyword: keyword.trim() || undefined,
            category: category ?? undefined,
            radiusM: mode === 'all' ? undefined : settings.searchRadiusKm * 1000,
            petAllowed: settings.onlyPetInfo ? 'ALLOWED' : undefined,
            page: next,
            size: PAGE_SIZE,
          });
      // 같은 시설이 두 번 그려지지 않게 ID로 거른다 — 가나다순·거리순 모두 경계에서 겹칠 수 있다
      setItems((prev) => {
        const seen = new Set(prev.map((f) => f.facilityId));
        return [...prev, ...res.items.filter((f) => !seen.has(f.facilityId))];
      });
      setTotal(res.total);
      setPage(next);
      registerFacilities(res.items);
    } catch {
      // 이어 받기 실패는 목록을 지우지 않는다. 버튼이 그대로 남아 다시 누를 수 있다
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * 「9,469곳」이라고만 적으면 30곳만 보이는 화면과 어긋난다. 아직 다 안 받았으면 **받은 수를
   * 함께** 적는다 — 「더 보기」 버튼이 아래에 있다는 것도 이 문구가 설명해 준다.
   */
  const hasMore = items.length < total;
  const countText = hasMore
    ? `${items.length.toLocaleString()} / ${total.toLocaleString()}`
    : total.toLocaleString();

  // 동반 불가 시설을 숨기지 않는다. 헛걸음 방지가 목적인 앱에서 '여긴 안 된다'는 가장 확실한
  // 정보라, 감추는 것보다 보여주는 쪽이 값어치가 있다(전국 5건뿐이라 목록을 어지럽히지도 않는다).
  const facilities = items;

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
        <RankingView coords={coords} />
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
              label="동반 가능만"
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

          {/* 지역 — '전체'에서만. 시도만 골라도 그 시도 전체가 바로 뜬다 */}
          {mode === 'all' && (
            <RegionChips
              sidoCode={sidoCode}
              sigunguCode={sigunguCode}
              onChange={({ sidoCode: sd, sigunguCode: sg }) => {
                setSidoCode(sd);
                setSigunguCode(sg);
              }}
            />
          )}

          {/* 검색어가 지역 필터를 덮는다 — 왜 고른 지역이 안 먹는지 여기서 밝힌다 */}
          {regionMuted && (
            <View style={[styles.regionHint, { borderColor: p.accent, backgroundColor: p.accentSoft }]}>
              <Ionicons name="information-circle" size={15} color={p.accent} />
              <Text style={[styles.regionHintText, { color: p.accent }]}>
                검색 중에는 지역 필터가 꺼져요 · 전국에서 찾는 중
              </Text>
            </View>
          )}

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
              // 지역 목록은 거리순이 아니라 가나다순이다. 왜 가까운 순이 아닌지 묻기 전에 밝힌다.
              byRegion
                ? // 시군구까지 좁혔을 때만 관광공사를 실시간으로 부른다. 시도 단위는 적재해둔
                  // DB라, 출처를 똑같이 적으면 거짓이 된다
                  `${countText}곳 · 가나다순${sigunguCode ? ' · 관광공사 실시간' : ''}`
                : mode === 'all'
                  ? `${countText}곳 · 전국`
                  : locState === 'ok'
                    ? `${countText}곳 · 내 위치 기준`
                    : '내 위치 기준'
            }
          />

          {/* 위치 권한 안내는 '내 주변'에서만 — '전체'는 위치 없이 전국을 검색한다 */}
          {mode === 'nearby' && locState === 'denied' ? (
            <LoadState
              kind="empty"
              icon="location-outline"
              message="내 주변 시설을 보려면 위치 권한이 필요해요."
              action={{ label: '위치 다시 시도', icon: 'navigate', onPress: locate }}
            />
          ) : (mode === 'nearby' && locState === 'loading') || (loading && items.length === 0) ? (
            <LoadState kind="loading" message={mode === 'all' ? '시설을 찾고 있어요…' : '내 주변 시설을 찾고 있어요…'} />
          ) : (
            <View style={styles.list}>
              {facilities.map((f) => (
                <FacilityCard key={f.facilityId} facility={f} />
              ))}

              {facilities.length > 0 && hasMore && (
                <Pressable
                  onPress={() => void loadMore()}
                  disabled={loadingMore}
                  style={({ pressed }) => [
                    styles.more,
                    { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
                  ]}>
                  {loadingMore ? (
                    <ActivityIndicator color={p.accent} size="small" />
                  ) : (
                    <Text style={[styles.moreText, { color: p.accent }]}>
                      {Math.min(PAGE_SIZE, total - items.length).toLocaleString()}곳 더 보기
                    </Text>
                  )}
                </Pressable>
              )}
              {facilities.length === 0 &&
                (failed ? (
                  <LoadState
                    kind="failed"
                    message={'시설 정보를 불러오지 못했어요.\n네트워크 상태를 확인하고 다시 시도해 주세요.'}
                    onRetry={() => setRetryKey((k) => k + 1)}
                  />
                ) : districtHint ? (
                  /*
                    구가 있는 시를 상위 코드로 물으면 0건이 온다 — 관광공사가 자료를 구 단위로
                    넣어 뒀기 때문이다. 그냥 "시설이 없어요"로 끝내면 사용자는 그 도시에 정말
                    없는 줄 안다(수원 704곳, 고양 704곳, 용인 656곳이 구에 있다).
                  */
                  <LoadState
                    kind="empty"
                    icon="git-branch-outline"
                    message={'이 시는 자료가 구 단위로 들어 있어요.\n위에서 구를 골라 주세요.'}
                  />
                ) : (
                  <LoadState
                    kind="empty"
                    icon="search"
                    message={'조건에 맞는 시설이 없어요.\n검색어·카테고리·반경(설정)을 바꿔 보세요.'}
                  />
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
  segmentLabel: { fontSize: Type.body, fontWeight: '800', letterSpacing: -0.2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: Type.callout, padding: 0 },
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
  courseTitle: { fontSize: Type.callout, fontWeight: '800', letterSpacing: -0.3 },
  courseBody: { fontSize: Type.footnote, lineHeight: 17 },
  more: { alignItems: 'center', borderWidth: 1, borderRadius: Radius.full, paddingVertical: 12 },
  moreText: { fontSize: Type.footnote, fontWeight: '800' },
  regionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
  },
  regionHintText: { flex: 1, fontSize: Type.footnote, fontWeight: '700' },
});
