import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { ResultBadge } from '@/components/badge';
import { Chip } from '@/components/chip';
import { CourseActionNotice } from '@/components/course/action-notice';
import { StopReorderSheet } from '@/components/course/stop-reorder-sheet';
import { StopTimeField } from '@/components/course/stop-time-field';
import {
  CoursePickCard,
  LikedCourseCard,
  PresetCourseCard,
  SimilarCourseCard,
} from '@/components/course/course-cards';
import {
  CourseCheckAction,
  CourseCheckPanel,
  CourseResultView,
  SaveCourseAction,
} from '@/components/course/course-check';
import { MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { BUILDER_PLAN_KEY, outOfOrderStops } from '@/data/course-plan';
import {
  PRESET_COURSES,
  recommendCourse,
  recommendSimilarCourse,
  validateCourse,
  type Course,
  type StopResult,
} from '@/data/course';
import { isMockFacilityId } from '@/data/facility-id';
import { formatDistance } from '@/lib/format';
import { facilitiesApi } from '@/lib/api';
import { getCurrentLocation, type Coords } from '@/lib/location';
import {
  CATEGORY_LABEL,
  type CourseDistanceOption,
  type CourseRegion,
  type CourseCheckResult,
  type CourseStop,
  type CourseTheme,
  type LikedCourse,
  type Facility,
  type PresetCourse,
  type SavedCourse,
  type SimilarCourse,
} from '@/data/types';
import { ApiError, aiApi, coursesApi } from '@/lib/api';
import { useCourseLibrary } from '@/hooks/use-course-library';
import { useCoursePlan } from '@/hooks/use-course-plan';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 여행 코스 판별 (F3) — 하루 동선 전체를 한 번에 검증한다.
 * 낱개 시설이 "이 문"을 풀었다면, 코스는 "이 하루"를 푼다.
 */
/** 코스 빌더 검색 반경. 하루 동선이라 한 도시를 덮을 만큼이면 된다. */
/** 키워드 없이 둘러볼 때만 반경을 건다. 키워드가 있으면 반경을 안 보낸다 — 명세대로 생략하면 전국이다 */
const PICK_RADIUS_M = 30_000;
/** 위치를 못 받았을 때의 기준점(서울시청). 키워드로 전국을 찾을 수 있게 열어둔다. */
const PICK_FALLBACK_CENTER: Coords = { latitude: 37.5665, longitude: 126.978 };

export default function CourseScreen() {
  const p = usePalette();
  const router = useRouter();
  const {
    pets,
    satisfactions,
    facilityById,
    registerFacilities,
    loadFacility,
    lastCoords,
    setLastCoords,
    restoring,
    session,
    refreshGamification,
  } = useAppStore();

  const [selectedPetIds, setSelectedPetIds] = useState<number[]>(pets.map((x) => x.petId));
  const [stopIds, setStopIds] = useState<number[]>([]);

  // ── 지역×테마 추천(서버) ─────────────────────────────────────────────
  // 재료(지역·테마·거리)는 서버가 준다. 지역 이름은 자유 텍스트라 "강원"처럼 축약해 보내면
  // 실제 값("강원특별자치도")과 안 맞아 후보가 0건이 되므로, 반드시 이 응답의 값을 그대로 쓴다.
  const [regions, setRegions] = useState<CourseRegion[]>([]);
  const [themes, setThemes] = useState<CourseTheme[]>([]);
  const [distanceOptions, setDistanceOptions] = useState<CourseDistanceOption[]>([]);
  const [sido, setSido] = useState<string | null>(null);
  const [sigungu, setSigungu] = useState<string | null>(null);
  const [pickedThemes, setPickedThemes] = useState<string[]>([]);
  const [maxDistance, setMaxDistance] = useState<string | null>(null);
  // 결과에 그때의 요청 키를 함께 담는다. 필터를 바꾼 뒤 300ms 디바운스 동안 이전 결과가
  // 새 필터의 답인 것처럼 보이는 걸 막으려는 것이다.
  const [preset, setPreset] = useState<{ key: string; course: PresetCourse } | null>(null);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  // ── 개인화 추천(서버) ────────────────────────────────────────────────
  // liked는 실제 방문 기록이, similar는 취향 데이터가 있어야 의미가 있다. 둘 다 없으면
  // 서버가 각각 COURSE4002 / 콜드스타트로 답하므로 그대로 구분해 보여준다.
  const [liked, setLiked] = useState<LikedCourse | null>(null);
  /** 방문 기록이 부족해서 못 만든 상태(COURSE4002). 장애와 구분한다 */
  const [likedEmpty, setLikedEmpty] = useState(false);
  const [similar, setSimilar] = useState<SimilarCourse | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  /** 기록 부족이 아니라 진짜 실패(네트워크·401·5xx) */
  const [personalError, setPersonalError] = useState(false);

  // ── 서버 코스 일괄 판별 ──────────────────────────────────────────────
  // 빌더의 스톱은 전부 목 시설이라 서버 판별을 쓸 수 없다. 서버가 만들어 준 코스(preset·
  // liked·similar)를 그대로 판별에 넘기는 게 이 API가 쓰이는 자리다.
  const [courseCheck, setCourseCheck] = useState<{ key: string; result: CourseCheckResult } | null>(null);
  const [courseCheckKey, setCourseCheckKey] = useState<string | null>(null);
  /**
   * 판별 실패. **어느 버튼의 실패인지 함께 들고 있는다.**
   *
   * 예전에는 메시지만 담고 화면 한 곳에서만 그려서, 아래쪽 버튼을 누르면 위쪽에 뜬 문구를
   * 사용자가 보지 못했다 — 눌러도 아무 일이 없는 것처럼 보였다.
   */
  const [courseCheckError, setCourseCheckError] = useState<{ key: string; message: string } | null>(
    null,
  );

  /**
   * 내 코스 · 둘러보기 · 공유는 서로 얽혀 있어 한 훅으로 묶어 뒀다(`use-course-library`).
   * 이 화면은 그 결과를 그리고, 추천·빌더 쪽에서는 `saveCourse()` 하나만 부른다.
   */
  const {
    savedCourses,
    savingKey,
    saveMessage,
    setSaveMessage,
    saveCourse,
    removeCourse,
    renameCourse,
    otherCourses,
    publicTotal,
    publicLoading,
    publicError,
    publicPendingId,
    copyingId,
    reloadPublic,
    copyPublicCourse,
    togglePublic,
    sharingId,
    shareCourse,
    shareInput,
    setShareInput,
    importing,
    importShared,
  } = useCourseLibrary();

  /**
   * 판별 요청의 서명. 코스 종류만으로는 부족하다 — 같은 'liked'라도 고른 아이나 스톱이 바뀌면
   * 다른 요청이므로, 늦게 도착한 옛 응답이 새 입력의 결과인 것처럼 덮어쓰면 안 된다.
   * 방문 순서가 결과를 바꾸므로 facilityIds는 정렬하지 않는다.
   */
  /** 빌더로 만든 코스의 판별 결과를 구분하는 키. 추천 코스(preset·liked·similar)와 섞이면 안 된다. */
  const BUILDER_KEY = 'builder';
  /**
   * 판별 요청의 순번. 서명 검사만으로는 A → B → 다시 A(같은 서명)로 돌아왔을 때 늦게 온
   * 첫 A 응답을 걸러내지 못한다. 마지막으로 보낸 요청만 결과를 쓴다.
   */
  const checkReqRef = useRef(0);

  const checkSignature = (key: string, facilityIds: number[]) =>
    `${key}|${[...selectedPetIds].sort((a, b) => a - b).join(',')}|${facilityIds.join(',')}`;

  const runCourseCheck = async (key: string, stops: Pick<CourseStop, 'facilityId'>[]) => {
    if (selectedPetIds.length === 0 || stops.length === 0) return;
    // 배열 순서가 곧 방문 순서다. 서버는 1~10개만 받는다.
    const facilityIds = stops.slice(0, 10).map((st) => st.facilityId);
    const sig = checkSignature(key, facilityIds);

    // 데모 시설이 섞여 있으면 서버가 그 id를 모른다(FACILITY4001). 부르기 전에 걸러,
    // "왜 안 되는지 모르겠는 실패" 대신 이유를 말한다.
    if (facilityIds.some(isMockFacilityId)) {
      setCourseCheck(null);
      setCourseCheckError({
        key: sig,
        message: '데모용 예시 코스라 판별할 수 없어요. 지역으로 찾은 코스에서 확인해 주세요.',
      });
      return;
    }
    setCourseCheckKey(sig);
    setCourseCheckError(null);
    setCourseCheck(null);
    const reqId = ++checkReqRef.current;
    const stale = () => reqId !== checkReqRef.current || checkSignature(key, facilityIds) !== sig;
    try {
      const res = await aiApi.courseCheck(selectedPetIds, facilityIds);
      // 그 사이 아이나 코스가 바뀌었거나 더 새 요청이 나갔으면 이 응답은 화면의 답이 아니다
      if (stale()) return;
      setCourseCheck({ key: sig, result: res });
    } catch (e) {
      if (stale()) return;
      setCourseCheckError({
        key: sig,
        message: e instanceof Error ? e.message : '코스를 판별하지 못했어요',
      });
    } finally {
      // 더 새 요청이 돌고 있으면 그쪽 스피너를 끄지 않는다
      if (reqId === checkReqRef.current) setCourseCheckKey((cur) => (cur === sig ? null : cur));
    }
  };
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);

  /**
   * 코스 빌더의 시설 목록.
   *
   * 예전에는 목 데이터(`FACILITIES`)를 그대로 깔아서 강릉 6곳만 나왔다. 관광공사에서 온
   * 실제 시설은 영원히 뜨지 않았고, 그 목 시설로 코스를 만들면 판별 단계에서
   * "데모용 예시 코스라 판별할 수 없어요"로 막혀 끝까지 가도 아무것도 안 되는 길이었다.
   * 서버 검색으로 바꾼다.
   */
  const [pickCenter, setPickCenter] = useState<Coords | null>(null);
  const [pickQuery, setPickQuery] = useState('');
  const [pickItems, setPickItems] = useState<Facility[]>([]);
  const [pickLoading, setPickLoading] = useState(false);
  const [pickFailed, setPickFailed] = useState(false);
  const [pickRetry, setPickRetry] = useState(0);

  // 검색 기준점을 한 번만 잡는다. 탐색 탭이 이미 잡아둔 좌표가 있으면 권한을 다시 묻지 않고,
  // 없으면 GPS를 요청하고, 그것도 거부되면 기본 중심으로 전국에서 찾게 둔다 —
  // 위치를 안 준다고 코스를 못 만들게 할 이유는 없다(키워드로 찾으면 된다).
  useEffect(() => {
    if (!picking || pickCenter) return;
    let active = true;
    void (async () => {
      const c = lastCoords ?? (await getCurrentLocation());
      if (!active) return;
      if (c && !lastCoords) setLastCoords(c);
      setPickCenter(c ?? PICK_FALLBACK_CENTER);
    })();
    return () => {
      active = false;
    };
  }, [picking, pickCenter, lastCoords, setLastCoords]);

  useEffect(() => {
    if (!picking || !pickCenter) return;
    let active = true;
    const t = setTimeout(async () => {
      setPickLoading(true);
      setPickFailed(false);
      try {
        const res = await facilitiesApi.search({
          latitude: pickCenter.latitude,
          longitude: pickCenter.longitude,
          keyword: pickQuery.trim() || undefined,
          ...(pickQuery.trim() ? {} : { radiusM: PICK_RADIUS_M }),
          size: 30,
        });
        if (!active) return;
        // 스톱을 이름으로 그리려면 상세 캐시에 있어야 한다. 안 넣으면 코스를 만든 뒤
        // 빌더 목록이 비어 보인다.
        registerFacilities(res.items);
        setPickItems(res.items);
      } catch {
        if (active) {
          setPickItems([]);
          setPickFailed(true);
        }
      } finally {
        if (active) setPickLoading(false);
      }
    }, pickQuery ? 400 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [picking, pickCenter, pickQuery, pickRetry, registerFacilities]);

  // 재료는 필터와 무관하게 한 번만 받는다. 실패해도 화면 전체를 막지 않는다 —
  // 아래 로컬 추천·직접 만들기는 그대로 쓸 수 있어야 한다.
  useEffect(() => {
    let active = true;
    Promise.all([
      coursesApi.regions().catch(() => [] as CourseRegion[]),
      coursesApi.themes().catch(() => [] as CourseTheme[]),
      coursesApi.distanceOptions().catch(() => [] as CourseDistanceOption[]),
    ]).then(([rg, th, dp]) => {
      if (!active) return;
      setRegions(rg);
      setThemes(th);
      setDistanceOptions(dp);
    });
    return () => {
      active = false;
    };
  }, []);

  /** 지금 화면의 필터 조합. 결과에 붙은 키와 다르면 그 결과는 옛 필터의 답이다 */
  const presetKey = `${sido ?? ''}|${sigungu ?? ''}|${[...pickedThemes].sort().join(',')}|${maxDistance ?? ''}`;

  // 지역과 테마가 모두 정해져야 조회한다(서버 필수 파라미터).
  // 조건이 안 맞을 때 상태를 되돌리지 않고 렌더에서 presetReady로 가린다 —
  // effect 본문에서 setState를 동기로 부르면 연쇄 렌더 경고가 뜬다.
  useEffect(() => {
    if (!sido || pickedThemes.length === 0) return;
    let active = true;
    const t = setTimeout(async () => {
      if (!active) return;
      setPresetLoading(true);
      setPresetError(null);
      try {
        const key = presetKey;
        const res = await coursesApi.preset({
          sido,
          sigungu: sigungu ?? undefined,
          themes: pickedThemes,
          maxDistanceM: maxDistance ?? undefined,
        });
        if (!active) return;
        setPreset({ key, course: res });
      } catch (e) {
        if (!active) return;
        setPreset(null);
        // 조건에 맞는 시설이 2곳 미만이면 서버가 COURSE4001을 준다 — 장애가 아니라 조건 문제라
        // 그대로 알려주고 다른 조합을 고르게 한다.
        setPresetError(e instanceof Error ? e.message : '코스를 만들지 못했어요');
      } finally {
        if (active) setPresetLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [sido, sigungu, pickedThemes, maxDistance, presetKey]);

  // 선택한 아이가 바뀌면 개인화 추천을 다시 받는다. 실패(기록 부족)는 장애가 아니라
  // "아직 데이터가 없다"는 정상 상태라 화면을 막지 않는다.
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      if (!active) return;
      // 아이를 하나도 안 고르면 판별할 대상이 없다. 직전 결과를 남겨두면 "누구 취향인지"
      // 알 수 없는 카드가 그대로 떠 있게 되므로 비운다.
      if (selectedPetIds.length === 0) {
        setLiked(null);
        setSimilar(null);
        setLikedEmpty(false);
        setPersonalError(false);
        setPersonalLoading(false);
        return;
      }
      setPersonalLoading(true);
      setPersonalError(false);
      const params = {
        petIds: selectedPetIds,
        sido: sido ?? undefined,
        sigungu: sigungu ?? undefined,
        maxDistanceM: maxDistance ?? undefined,
      };
      // 기록 부족(COURSE4002)과 진짜 실패를 구분한다. 네트워크·401·5xx까지 "방문 기록이
      // 없어요"로 안내하면 서버 장애를 사용자 탓으로 돌리는 셈이 된다.
      const [lk, sm] = await Promise.all([
        coursesApi
          .liked(params)
          .then((r) => ({ ok: true as const, value: r }))
          .catch((e) => ({ ok: false as const, empty: e instanceof ApiError && e.code === 'COURSE4002' })),
        coursesApi.similar(params).catch(() => null),
      ]);
      // 화면을 떠났으면 상태를 건드리지 않는다. 로딩만은 내린다 — 켜둔 채 빠져나가면
      // 다시 들어왔을 때 아무도 끄지 않는 스피너가 남는다.
      /**
       * 새 요청이 이미 시작됐으면 이 응답은 옛 답이다.
       *
       * 예전에는 `active`가 false여도 로딩만 끄고 나갔는데, 그 로딩은 **새 요청의 것**이다.
       * 아이를 두 번 빠르게 바꾸면 A의 응답이 B의 스피너를 끄고 옛 추천이 다시 보였다.
       * 정리는 다음 effect가 이미 맡고 있으므로 여기서는 아무것도 건드리지 않는다.
       */
      if (!active) return;
      setLiked(lk.ok ? lk.value : null);
      setLikedEmpty(!lk.ok && lk.empty);
      setPersonalError(!lk.ok && !lk.empty);
      setSimilar(sm);
      setPersonalLoading(false);
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [selectedPetIds, sido, sigungu, maxDistance]);

  const sigunguOptions = regions.find((r) => r.sido === sido)?.sigungus ?? [];
  /** 지역·테마가 다 골라졌을 때만 결과를 보여준다(고르는 중엔 직전 결과가 남아 있어도 감춘다) */
  const presetReady = sido !== null && pickedThemes.length > 0;

  const toggleTheme = (value: string) =>
    setPickedThemes((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));

  const chosenPets = useMemo(
    () => pets.filter((x) => selectedPetIds.includes(x.petId)),
    [pets, selectedPetIds],
  );

  const recommended = useMemo(
    () => recommendCourse(selectedPetIds, satisfactions),
    [selectedPetIds, satisfactions],
  );

  // 취향이 비슷한 아직 안 가본 곳 — 좋아한 곳 그 자체와 별개로 제안
  const recommendedSimilar = useMemo(
    () => recommendSimilarCourse(chosenPets, satisfactions),
    [chosenPets, satisfactions],
  );

  /** 빌더 코스의 판별 요청 키. 스톱·아이가 바뀌면 이전 결과는 더 이상 이 코스의 답이 아니다. */

  const togglePet = (petId: number) => {
    setSelectedPetIds((prev) =>
      prev.includes(petId) ? prev.filter((x) => x !== petId) : [...prev, petId],
    );
  };

  const loadCourse = (course: Course) => {
    setStopIds(course.stopIds);
    setPicking(false);
  };

  /**
   * 저장해 둔 코스를 빌더로 불러온다.
   *
   * 서버의 내 코스 목록(`GET /courses`)은 스톱을 **시설 ID만** 준다. 그 ID가 캐시에
   * 없으면 빌더가 이름을 못 그려 빈 화면이 된다 — 담은 코스를 열었는데 아무것도 없는
   * 것처럼 보이던 원인이다. 상세를 미리 받아 캐시를 채운 뒤 스톱을 세운다.
   */
  const [openingCourseId, setOpeningCourseId] = useState<number | null>(null);
  /**
   * 지금 빌더에 올라와 있는 저장 코스. 두 가지에 쓴다.
   *
   * ① 빌더 머리에 "무엇을 보고 있는지"를 적는다 — 예전에는 코스를 눌러도 화면이 그대로인 것
   *    처럼 보였다. 스톱은 실제로 바뀌는데 빌더가 한참 아래에 있어 눈에 안 띄었기 때문이다.
   * ② 스톱별 시간을 어느 코스 것으로 저장할지 가른다(저장 전 빌더는 `BUILDER_PLAN_KEY`).
   */
  const [openedCourse, setOpenedCourse] = useState<SavedCourse | null>(null);

  /**
   * 담아둔 코스를 열면 **뒤로가기가 그것부터 닫는다.**
   *
   * 코스를 여는 것은 화면 이동이 아니라 이 화면의 상태 변화다. 그래서 네비게이션 기록에는
   * 아무것도 쌓이지 않고, 뒤로가기는 그 단계를 건너뛰어 탐색 탭까지 한 번에 나가 버렸다 —
   * 사용자에게는 두 칸 뒤로 간 것으로 보인다(실기기에서 보고된 문제).
   *
   * 목적지를 정해 보내지 않는다. 이 화면을 떠나려는 시도를 **한 번만 취소하고** 연 코스를
   * 닫을 뿐이라, 다음 뒤로가기는 여기까지 온 진짜 경로를 그대로 따라간다. 탐색 탭에서
   * 왔으면 탐색 탭으로, 홈에서 왔으면 홈으로 간다.
   *
   * iOS 스와이프와 안드로이드 하드웨어 버튼도 같은 이벤트를 타므로 함께 처리된다.
   */
  const navigation = useNavigation();
  useEffect(() => {
    if (!openedCourse) return;
    let off: (() => void) | null = null;
    off = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      // 상태가 바뀌어 이 효과가 정리되기 전에 한 번 더 눌릴 수 있다. 그때 또 막히지 않게
      // 스스로 떨어진다 — 두 번째 뒤로가기는 화면을 정말로 떠나야 한다.
      off?.();
      off = null;
      setOpenedCourse(null);
      setStopIds([]);
      setCourseCheck(null);
      setCourseCheckError(null);
    });
    return () => off?.();
  }, [navigation, openedCourse]);
  /** 순서 바꾸기 시트가 열렸는가 */
  const [reordering, setReordering] = useState(false);

  /**
   * 스톱별 방문 시각. **서버에 시간 필드가 없어 기기에 남는다**(`data/course-plan.ts`).
   * 저장 전 빌더와 저장된 코스를 다른 키로 나눈다 — 저장하면 빌더 일정이 그 코스로 옮겨간다.
   */
  const { planOf, setStopTime, adoptPlan } = useCoursePlan();
  const planKey = openedCourse ? String(openedCourse.courseId) : BUILDER_PLAN_KEY;
  const plan = planOf(planKey);
  const scrollRef = useRef<ScrollView>(null);
  /** 빌더 블록의 y 좌표. 코스를 열면 그 자리로 데려간다 */
  const builderY = useRef(0);

  const openSavedCourse = async (course: SavedCourse) => {
    setOpeningCourseId(course.courseId);
    try {
      const missing = course.stopIds.filter((id) => !facilityById(id));
      await Promise.all(missing.map((id) => loadFacility(id)));
    } finally {
      setOpeningCourseId(null);
    }
    setStopIds(course.stopIds);
    setOpenedCourse(course);
    setPicking(false);
    // 바뀐 것을 보게 한다. 레이아웃이 자리를 잡은 뒤에 움직여야 엉뚱한 곳으로 가지 않는다
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(builderY.current - 12, 0), animated: true }), 60);
  };

  /**
   * 스톱 추가. **서버 판별이 10곳까지만 받는다.**
   *
   * 예전에는 제한 없이 담기고 판별은 앞 10곳만 보냈다. 11곳짜리 코스를 만들면 뒤 1곳은
   * 판별되지도 않았는데 결과가 "코스 전체"로 표시됐다 — 가장 위험한 종류의 거짓이다.
   * 담는 단계에서 막고 이유를 알린다.
   */
  /**
   * 빌더 코스를 담는다. 담은 뒤 **빌더에 짜둔 시간을 새 코스로 옮긴다** —
   * 옮기지 않으면 저장하는 순간 시간이 사라진 것처럼 보인다(키가 코스 ID로 바뀌므로).
   */
  const saveBuilderCourse = async () => {
    if (stopFacilities.length === 0) return;
    // 이름은 `saveCourse`가 스톱 내용으로 짓는다 — 아래 값은 스톱 이름을 모를 때의 대비책이다
    // 지금 보고 있는 일정의 키를 먼저 잡아둔다 — 아래에서 openedCourse를 비우면 키가 바뀐다
    const fromKey = planKey;
    const newId = await saveCourse(BUILDER_PLAN_KEY, '내가 만든 코스', stopFacilities);
    if (newId === null) return;
    adoptPlan(fromKey, newId);
    setOpenedCourse(null);
  };

  const MAX_STOPS = 10;
  const addStop = (facilityId: number) => {
    setStopIds((prev) => {
      if (prev.includes(facilityId)) return prev;
      if (prev.length >= MAX_STOPS) {
        setSaveMessage({
          text: `코스에는 ${MAX_STOPS}곳까지 담을 수 있어요. 빼고 다시 담아 주세요.`,
          failed: true,
        });
        return prev;
      }
      return [...prev, facilityId];
    });
  };

  const removeStop = (facilityId: number) => {
    setStopIds((prev) => prev.filter((x) => x !== facilityId));
  };

  const moveStop = (index: number, dir: -1 | 1) => {
    setStopIds((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const swapToAlternative = (fromId: number, toId: number) => {
    setStopIds((prev) => prev.map((x) => (x === fromId ? toId : x)));
  };

  /**
   * 직접 만든 코스를 **서버로 판별한다.**
   *
   * 예전에는 900ms 타이머를 돌린 뒤 로컬 `validateCourse()`로 결과를 만들었다. 그 함수는
   * 목 시설 배열에서만 시설을 찾으므로, 빌더가 실제 관광공사 시설을 담게 된 뒤로는
   * 결과가 빈 배열이 됐다 — 로딩이 끝나도 아무것도 안 나왔다.
   * 추천 코스가 쓰는 것과 같은 `POST /ai/course-check`를 쓴다.
   */
  const runValidation = async () => {
    if (stopIds.length === 0 || chosenPets.length === 0) return;
    await runCourseCheck(
      BUILDER_KEY,
      // stopIds가 아니라 조회에 성공한 시설만 보낸다. 서명도 같은 기준이어야 결과가 붙는다.
      stopFacilities.map((f) => ({ facilityId: f.facilityId })),
    );
  };

  // 스토어 캐시에서 찾는다 — 서버 시설과 목 시설을 모두 아는 건 여기뿐이다
  /** 앞 스톱보다 이른 시각인 곳. 막지 않고 표시만 한다 */
  const outOfOrder = useMemo(() => outOfOrderStops(stopIds, plan), [stopIds, plan]);

  const stopFacilities = stopIds
    .map((id) => facilityById(id))
    .filter((f): f is NonNullable<typeof f> => !!f);

  const available = pickItems.filter((f) => !stopIds.includes(f.facilityId));

  /**
   * 서명은 **실제로 판별에 보낸 시설** 기준이어야 한다.
   *
   * 예전에는 `stopIds`로 만들었는데, 저장 코스를 열 때 상세 조회가 일부 실패하면
   * `stopIds`에는 남고 `stopFacilities`에는 없다. 그러면 요청 서명과 렌더 서명이 어긋나
   * 결과도 오류도 로딩도 아무것도 안 붙었다 — 눌러도 반응이 없는 것처럼 보였다.
   */
  const builderSig = checkSignature(
    BUILDER_KEY,
    stopFacilities.map((f) => f.facilityId),
  );
  const builderRunning = courseCheckKey === builderSig;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '여행 코스', headerBackButtonDisplayMode: 'minimal'}} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: p.accent }]}>여행 코스 판별</Text>
            <Text style={[styles.title, { color: p.ink }]}>하루 동선을{'\n'}통째로 확인해요</Text>
            <Text style={[styles.sub, { color: p.muted }]}>
              여러 곳을 코스로 묶으면, 어느 스톱에서 어떤 아이가 막히는지 출발 전에 한 번에 알 수 있어요.
            </Text>
          </View>

          {/* 데려갈 아이 */}
          {pets.length === 0 ? (
            <LoadState
              kind="empty"
              icon="paw"
              message="코스에 데려갈 아이가 없어요."
              action={{ label: '아이 등록하기', icon: 'add', onPress: () => router.push('/(tabs)/pets') }}
            />
          ) : (
            <View style={styles.petRow}>
              {pets.map((pet) => {
                const on = selectedPetIds.includes(pet.petId);
                return (
                  <Pressable
                    key={pet.petId}
                    onPress={() => togglePet(pet.petId)}
                    style={[
                      styles.petChip,
                      { backgroundColor: on ? p.accentSoft : p.surface, borderColor: on ? p.accent : p.line },
                    ]}>
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={on ? p.accent : p.muted}
                    />
                    <Text style={[styles.petChipText, { color: on ? p.accent : p.muted }]}>
                      {pet.name} · {pet.weight}kg
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* 시작점: 프리셋 · 추천 코스 */}
          {stopFacilities.length === 0 && (
            <View style={styles.presetWrap}>
              <Text style={[styles.blockLabel, { color: p.ink }]}>코스로 시작하기</Text>

              {recommended && (
                <CoursePickCard
                  course={recommended}
                  highlight
                  onPress={() => loadCourse(recommended)}
                />
              )}
              {recommendedSimilar && (
                <CoursePickCard
                  course={recommendedSimilar}
                  highlight
                  onPress={() => loadCourse(recommendedSimilar)}
                />
              )}
              {PRESET_COURSES.map((c) => (
                <CoursePickCard key={c.id} course={c} onPress={() => loadCourse(c)} />
              ))}

              {/* 개인화 추천 — 선택한 아이의 만족도 기록을 서버가 읽어 만든다 */}
              {selectedPetIds.length > 0 && personalLoading && (
                <View style={styles.presetState}>
                  <ActivityIndicator color={p.accent} />
                  <Text style={[styles.presetStateText, { color: p.muted }]}>
                    아이 취향으로 코스를 찾는 중…
                  </Text>
                </View>
              )}
              {selectedPetIds.length > 0 && !personalLoading && liked && (
                <>
                  <LikedCourseCard course={liked} />
                  <CourseCheckAction
                    label="이 코스로 다녀와도 될까요?"
                    disabled={selectedPetIds.length === 0}
                    running={courseCheckKey === checkSignature('liked', liked.stops.slice(0, 10).map((st) => st.facilityId))}
                    error={courseCheckError?.key === checkSignature('liked', liked.stops.slice(0, 10).map((st) => st.facilityId)) ? courseCheckError.message : null}
                    onPress={() => runCourseCheck('liked', liked.stops)}
                  />
                  <SaveCourseAction
                    running={savingKey === 'liked'}
                    onPress={() => saveCourse('liked', liked.title, liked.stops)}
                  />
                  {courseCheck?.key === checkSignature('liked', liked.stops.slice(0, 10).map((st) => st.facilityId)) && (
                    <CourseCheckPanel result={courseCheck.result} />
                  )}
                </>
              )}
              {!personalLoading && personalError && selectedPetIds.length > 0 && (
                <Text style={[styles.presetStateText, { color: p.muted }]}>
                  추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
                </Text>
              )}
              {!personalLoading && likedEmpty && selectedPetIds.length > 0 && (
                <Text style={[styles.presetStateText, { color: p.muted }]}>
                  아직 좋아한 곳을 뽑을 만큼 방문 기록이 없어요.{'\n'}
                  다녀온 곳에 만족도를 남기면 그 기록으로 코스를 만들어 드려요.
                </Text>
              )}
              {selectedPetIds.length > 0 && !personalLoading && similar && (
                <>
                  <SimilarCourseCard course={similar} />
                  <CourseCheckAction
                    label="이 코스로 다녀와도 될까요?"
                    disabled={selectedPetIds.length === 0}
                    running={courseCheckKey === checkSignature('similar', similar.stops.slice(0, 10).map((st) => st.facilityId))}
                    error={courseCheckError?.key === checkSignature('similar', similar.stops.slice(0, 10).map((st) => st.facilityId)) ? courseCheckError.message : null}
                    onPress={() => runCourseCheck('similar', similar.stops)}
                  />
                  <SaveCourseAction
                    running={savingKey === 'similar'}
                    onPress={() => saveCourse('similar', similar.title, similar.stops)}
                  />
                  {courseCheck?.key === checkSignature('similar', similar.stops.slice(0, 10).map((st) => st.facilityId)) && (
                    <CourseCheckPanel result={courseCheck.result} />
                  )}
                </>
              )}

              {/* 내 코스 — 저장한 CUSTOM 코스. 서버는 stopIds만 남기므로 지금은 개수만 보여준다 */}
              {savedCourses.length > 0 && (
                <View style={styles.presetBlock}>
                  <Text style={[styles.blockLabel, { color: p.ink }]}>내 코스 · {savedCourses.length}개</Text>
                  {savedCourses.map((c) => (
                    <View key={c.courseId} style={[styles.savedRow, { borderColor: p.line }]}>
                      {/* 이름 영역만 누르게 한다 — 옆의 공개 토글·삭제와 겹치면 안 된다 */}
                      <Pressable
                        onPress={() => void openSavedCourse(c)}
                        disabled={openingCourseId !== null}
                        style={({ pressed }) => [styles.savedTap, { opacity: pressed ? 0.6 : 1 }]}>
                        {openingCourseId === c.courseId ? (
                          <ActivityIndicator size="small" color={p.accent} />
                        ) : (
                          <Ionicons name="bookmark" size={15} color={p.accent} />
                        )}
                        <Text style={[styles.savedName, { color: p.ink }]} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={[styles.savedMeta, { color: p.muted, marginLeft: 'auto' }]}>
                          {c.stopIds.length}곳
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => void renameCourse(c)} hitSlop={8} accessibilityLabel="코스 이름 바꾸기">
                        <Ionicons name="pencil-outline" size={15} color={p.muted} />
                      </Pressable>
                      {/* 공개 토글 — 켜면 둘러보기 목록에 뜬다. 되돌릴 수 있으니 확인은 묻지 않는다 */}
                      {publicPendingId === c.courseId ? (
                        <ActivityIndicator color={p.muted} size="small" />
                      ) : (
                        <Pressable
                          onPress={() => togglePublic(c)}
                          hitSlop={8}
                          accessibilityRole="switch"
                          accessibilityState={{ checked: c.isPublic }}
                          accessibilityLabel={c.isPublic ? '코스 비공개로 바꾸기' : '코스 공개하기'}>
                          <Ionicons
                            name={c.isPublic ? 'earth' : 'lock-closed-outline'}
                            size={16}
                            color={c.isPublic ? p.accent : p.muted}
                          />
                        </Pressable>
                      )}
                      {sharingId === c.courseId ? (
                        <ActivityIndicator color={p.muted} size="small" />
                      ) : (
                        <Pressable
                          onPress={() => void shareCourse(c)}
                          hitSlop={8}
                          accessibilityLabel="코스 공유">
                          <Ionicons name="share-outline" size={16} color={p.muted} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => removeCourse(c.courseId)}
                        hitSlop={8}
                        accessibilityLabel="코스 삭제">
                        <Ionicons name="trash-outline" size={16} color={p.muted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* 공유 코드로 담기 — 링크가 웹으로 열리므로 앱 사용자는 여기로 담는다 */}
              <View style={[styles.shareRow, { borderColor: p.line, backgroundColor: p.surface }]}>
                <Ionicons name="link-outline" size={16} color={p.muted} />
                <TextInput
                  value={shareInput}
                  onChangeText={setShareInput}
                  placeholder="공유받은 코스 코드"
                  placeholderTextColor={p.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => void importShared(shareInput)}
                  style={[styles.shareInput, { color: p.ink }]}
                />
                {importing ? (
                  <ActivityIndicator color={p.accent} size="small" />
                ) : (
                  <Pressable
                    onPress={() => void importShared(shareInput)}
                    disabled={!shareInput.trim()}
                    hitSlop={8}>
                    <Text style={[styles.shareBtn, { color: shareInput.trim() ? p.accent : p.muted }]}>담기</Text>
                  </Pressable>
                )}
              </View>


              {/*
                둘러보기 — 다른 사람이 공개한 코스. 못 불러온 것과 아직 없는 것을 나눠서 안내한다.
                로딩 중(null)에는 자리만 비워둔다 — 빈 상태를 먼저 보여주면 없는 줄 알고 지나친다.
              */}
              {(otherCourses !== null || publicError) && (
                <View style={styles.presetBlock}>
                  <Text style={[styles.blockLabel, { color: p.ink }]}>
                    다른 집사의 코스 둘러보기
                    {otherCourses !== null && otherCourses.length > 0 && !publicError
                      ? ` · ${publicTotal}개`
                      : ''}
                  </Text>
                  {publicError ? (
                    // 재시도 경로를 준다. 없으면 앱을 다시 켤 때까지 실패 화면이 고정된다
                    <Pressable
                      onPress={() => reloadPublic()}
                      disabled={publicLoading}
                      style={({ pressed }) => [
                        styles.retryRow,
                        { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
                      ]}>
                      {publicLoading ? (
                        <ActivityIndicator size="small" color={p.muted} />
                      ) : (
                        <Ionicons name="refresh" size={15} color={p.muted} />
                      )}
                      <Text style={[styles.presetStateText, { color: p.muted }]}>
                        공개 코스를 못 불러왔어요. 눌러서 다시 시도하기
                      </Text>
                    </Pressable>
                  ) : otherCourses !== null && otherCourses.length === 0 ? (
                    // 실패와 다르다. 서비스가 빈 게 아니라 아직 공개된 코스가 없는 상태다
                    <Text style={[styles.presetStateText, { color: p.muted }]}>
                      아직 공개된 코스가 없어요. 내 코스를 공개하면 여기에 처음으로 올라가요.
                    </Text>
                  ) : (
                    (otherCourses ?? []).map((c) => (
                      // 눌러서 내 코스로 담는다. 명세가 이 API의 쓸모로 적어둔 것이기도 하고,
                      // 목록만 보여주고 아무 데도 못 가면 눌러본 사람은 고장으로 읽는다.
                      <Pressable
                        key={c.courseId}
                        onPress={() => copyPublicCourse(c)}
                        disabled={copyingId === c.courseId}
                        style={({ pressed }) => [
                          styles.savedRow,
                          { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
                        ]}>
                        <Ionicons name="earth" size={15} color={p.accent} />
                        <View style={styles.publicTexts}>
                          <Text style={[styles.savedName, { color: p.ink }]} numberOfLines={1}>
                            {c.name}
                          </Text>
                          {c.ownerNickname !== '' && (
                            <Text style={[styles.savedMeta, { color: p.muted }]} numberOfLines={1}>
                              {c.ownerNickname}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.savedMeta, { color: p.muted, marginLeft: 'auto' }]}>
                          {c.stopIds.length}곳
                        </Text>
                        {copyingId === c.courseId ? (
                          <ActivityIndicator size="small" color={p.muted} />
                        ) : (
                          <Ionicons name="add-circle-outline" size={16} color={p.accent} />
                        )}
                      </Pressable>
                    ))
                  )}
                </View>
              )}

              {/* 지역×테마 추천 — 서버가 지역별로 만들어 준다. 로그인 없이도 쓸 수 있는 둘러보기 */}
              {regions.length > 0 && (
                <View style={styles.presetBlock}>
                  <Text style={[styles.blockLabel, { color: p.ink }]}>지역으로 코스 찾기</Text>

                  <Text style={[styles.filterLabel, { color: p.muted }]}>지역</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {regions.map((r) => (
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
                  {sido && sigunguOptions.length > 0 && (
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

                  <Text style={[styles.filterLabel, { color: p.muted }]}>테마 (여러 개 고를 수 있어요)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {themes.map((t) => (
                      <Chip
                        key={t.value}
                        label={t.label}
                        selected={pickedThemes.includes(t.value)}
                        onPress={() => toggleTheme(t.value)}
                      />
                    ))}
                  </ScrollView>

                  {distanceOptions.length > 0 && (
                    <>
                      <Text style={[styles.filterLabel, { color: p.muted }]}>스톱 간 최대 거리</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                        {distanceOptions.map((o) => (
                          <Chip
                            key={o.value}
                            label={o.label}
                            selected={maxDistance === o.value}
                            onPress={() => setMaxDistance(maxDistance === o.value ? null : o.value)}
                          />
                        ))}
                      </ScrollView>
                    </>
                  )}

                  {presetReady && presetLoading && (
                    <View style={styles.presetState}>
                      <ActivityIndicator color={p.accent} />
                      <Text style={[styles.presetStateText, { color: p.muted }]}>코스를 만드는 중…</Text>
                    </View>
                  )}
                  {presetReady && !presetLoading && presetError && (
                    <Text style={[styles.presetStateText, { color: p.muted }]}>{presetError}</Text>
                  )}
                  {(!presetReady || (!presetLoading && !presetError && preset?.key !== presetKey)) && (
                    <Text style={[styles.presetStateText, { color: p.muted }]}>
                      지역과 테마를 고르면 코스를 만들어 드려요.
                    </Text>
                  )}
                  {presetReady && !presetLoading && !presetError && preset?.key === presetKey && (
                    <>
                      <PresetCourseCard course={preset.course} />
                      <CourseCheckAction
                        label="이 코스로 다녀와도 될까요?"
                        disabled={selectedPetIds.length === 0}
                        running={courseCheckKey === checkSignature('preset', preset.course.stops.slice(0, 10).map((st) => st.facilityId))}
                        error={courseCheckError?.key === checkSignature('preset', preset.course.stops.slice(0, 10).map((st) => st.facilityId)) ? courseCheckError.message : null}
                        onPress={() => runCourseCheck('preset', preset.course.stops)}
                      />
                      <SaveCourseAction
                        running={savingKey === 'preset'}
                        onPress={() => saveCourse('preset', preset.course.title, preset.course.stops)}
                      />
                      {courseCheck?.key === checkSignature('preset', preset.course.stops.slice(0, 10).map((st) => st.facilityId)) && (
                    <CourseCheckPanel result={courseCheck.result} />
                  )}
                    </>
                  )}
                </View>
              )}

              <Pressable
                onPress={() => setPicking(true)}
                style={({ pressed }) => [
                  styles.buildBtn,
                  { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
                ]}>
                <Ionicons name="add-circle-outline" size={18} color={p.accent} />
                <Text style={[styles.buildText, { color: p.ink }]}>직접 코스 만들기</Text>
              </Pressable>
            </View>
          )}

          {/* 코스 빌더 — 스톱 목록 */}
          {stopFacilities.length > 0 && (
            <View style={styles.builder} onLayout={(e) => { builderY.current = e.nativeEvent.layout.y; }}>
              <View style={styles.builderHead}>
                <View style={styles.builderTitle}>
                  <Text style={[styles.blockLabel, { color: p.ink }]}>
                    {openedCourse ? openedCourse.name : '내 코스'} · {stopFacilities.length}곳
                  </Text>
                  {openedCourse && (
                    <Text style={[styles.builderSub, { color: p.muted }]} numberOfLines={1}>
                      담아둔 코스를 열었어요 · 고치면 「이 코스로 저장」으로 새로 담겨요
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => { setStopIds([]); setOpenedCourse(null); setCourseCheck(null); setCourseCheckError(null); }}>
                  <Text style={[styles.clear, { color: p.muted }]}>비우기</Text>
                </Pressable>
              </View>

              {/* 순서를 손가락으로 바꾸는 길. 행마다 있는 화살표는 한 칸씩 옮길 때 그대로 쓴다 */}
              {stopFacilities.length > 1 && (
                <Pressable
                  onPress={() => setReordering(true)}
                  style={({ pressed }) => [
                    styles.reorderBtn,
                    { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
                  ]}>
                  <Ionicons name="reorder-three" size={16} color={p.accent} />
                  <Text style={[styles.reorderBtnText, { color: p.accent }]}>순서 바꾸기</Text>
                </Pressable>
              )}

              {stopFacilities.map((f, i) => {
                const stopResult =
                  courseCheck?.key === builderSig
                    ? courseCheck.result.stops.find((st) => st.facility.facilityId === f.facilityId)
                    : undefined;
                return (
                  <View key={f.facilityId} style={[styles.stopRow, { borderColor: p.line }]}>
                    <View style={styles.stopOrder}>
                      <View style={[styles.orderDot, { backgroundColor: p.accentSoft }]}>
                        <Text style={[styles.orderNum, { color: p.accent }]}>{i + 1}</Text>
                      </View>
                      {i < stopFacilities.length - 1 && (
                        <View style={[styles.orderLine, { backgroundColor: p.line }]} />
                      )}
                    </View>

                    {/* 이름 영역만 눌리게 한다 — 옆의 순서 이동·삭제 버튼과 겹치면 안 된다 */}
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/facility/[id]',
                          params: { id: String(f.facilityId) },
                        })
                      }
                      // 꾹 누르면 순서 바꾸기로 간다. 목록이 세로 스크롤 안에 있어 여기서 바로
                      // 끌게 하면 스크롤과 다투므로, 끌기 전용 시트를 여는 것까지만 한다
                      onLongPress={stopFacilities.length > 1 ? () => setReordering(true) : undefined}
                      delayLongPress={280}
                      style={({ pressed }) => [styles.stopBody, { opacity: pressed ? 0.6 : 1 }]}>
                      <View style={styles.stopTop}>
                        <Text style={[styles.stopCat, { color: p.accent }]}>
                          {CATEGORY_LABEL[f.category]}
                        </Text>
                        {stopResult && <ResultBadge result={stopResult.overall} />}
                      </View>
                      <Text style={[styles.stopName, { color: p.ink }]}>{f.name}</Text>
                      <Text style={[styles.stopMeta, { color: p.muted }]}>
                        {formatDistance(f.distanceM)}
                      </Text>
                    </Pressable>

                    {/*
                      방문 시각. 시설 이름을 누르면 상세로 가므로 **Pressable 바깥**에 둔다 —
                      안에 넣으면 시간을 고치려다 화면이 넘어간다.
                    */}
                    <View style={styles.stopTime}>
                      <StopTimeField
                        value={plan[String(f.facilityId)]}
                        outOfOrder={outOfOrder.has(f.facilityId)}
                        onChange={(t) => setStopTime(planKey, f.facilityId, t)}
                      />
                    </View>

                    <View style={styles.stopActions}>
                      <Pressable
                        onPress={() => moveStop(i, -1)}
                        disabled={i === 0}
                        style={styles.iconBtn}>
                        <Ionicons name="chevron-up" size={18} color={i === 0 ? p.line : p.muted} />
                      </Pressable>
                      <Pressable
                        onPress={() => moveStop(i, 1)}
                        disabled={i === stopFacilities.length - 1}
                        style={styles.iconBtn}>
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={i === stopFacilities.length - 1 ? p.line : p.muted}
                        />
                      </Pressable>
                      <Pressable onPress={() => removeStop(f.facilityId)} style={styles.iconBtn}>
                        <Ionicons name="close" size={18} color={p.muted} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              <Pressable
                onPress={() => setPicking((v) => !v)}
                style={({ pressed }) => [
                  styles.addStopBtn,
                  { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' },
                ]}>
                <Ionicons name={picking ? 'remove' : 'add'} size={17} color={p.accent} />
                <Text style={[styles.addStopText, { color: p.accent }]}>
                  {picking ? '닫기' : '스톱 추가'}
                </Text>
              </Pressable>

              {/*
                빌더로 짠 코스를 담는다. 예전에는 추천 카드에만 저장 버튼이 있어서, 직접
                고른 코스는 화면을 떠나는 순간 사라졌다 — 스톱 순서와 시간까지 정해 놓고도.

                담은 코스를 열어 고친 경우에도 **새 코스로** 담긴다. 서버의 덮어쓰기
                (`PUT /courses/{id}`)는 스톱을 전부 다시 실어야 하는데, 원본을 바꿔버리면
                남이 담아간 코스와 어긋난다. 원본은 두고 새로 담는 쪽이 덜 놀랍다.
              */}
              <Pressable
                onPress={() => void saveBuilderCourse()}
                disabled={savingKey === BUILDER_PLAN_KEY}
                style={({ pressed }) => [
                  styles.saveCourseBtn,
                  {
                    borderColor: p.accent,
                    backgroundColor: pressed || savingKey === BUILDER_PLAN_KEY ? p.accentSoft : 'transparent',
                  },
                ]}>
                {savingKey === BUILDER_PLAN_KEY ? (
                  <ActivityIndicator color={p.accent} size="small" />
                ) : (
                  <Ionicons name="bookmark-outline" size={16} color={p.accent} />
                )}
                <Text style={[styles.saveCourseText, { color: p.accent }]}>
                  {openedCourse ? '고친 대로 새로 담기' : '이 코스로 저장'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* 시설 선택 목록 (추가용) — 관광공사 시설을 서버에서 찾는다 */}
          {picking && (
            <View style={[styles.pickList, { backgroundColor: p.surface, borderColor: p.line }]}>
              <TextInput
                value={pickQuery}
                onChangeText={setPickQuery}
                placeholder="시설명이나 지역으로 검색"
                placeholderTextColor={p.muted}
                returnKeyType="search"
                style={[styles.pickSearch, { color: p.ink, borderColor: p.line, backgroundColor: p.card }]}
              />
              {pickLoading ? (
                <View style={styles.pickState}>
                  <ActivityIndicator color={p.accent} />
                  <Text style={[styles.pickEmpty, { color: p.muted }]}>시설을 찾는 중…</Text>
                </View>
              ) : pickFailed ? (
                // 실패와 '결과 없음'을 나눈다. 전자는 재시도, 후자는 검색어를 바꿀 일이다.
                <Pressable onPress={() => setPickRetry((n) => n + 1)} style={styles.pickState}>
                  <Text style={[styles.pickEmpty, { color: p.accent }]}>
                    시설을 못 불러왔어요. 눌러서 다시 시도하기
                  </Text>
                </Pressable>
              ) : available.length === 0 ? (
                <Text style={[styles.pickEmpty, { color: p.muted }]}>
                  {pickQuery.trim() ? '검색 결과가 없어요. 다른 이름으로 찾아보세요.' : '주변에 추가할 시설이 없어요.'}
                </Text>
              ) : (
                available
                  .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
                  .map((f) => (
                    <Pressable
                      key={f.facilityId}
                      onPress={() => addStop(f.facilityId)}
                      style={({ pressed }) => [styles.pickItem, { opacity: pressed ? 0.6 : 1 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickName, { color: p.ink }]}>{f.name}</Text>
                        <Text style={[styles.pickMeta, { color: p.muted }]}>
                          {CATEGORY_LABEL[f.category]} · {formatDistance(f.distanceM)}
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={22} color={p.accent} />
                    </Pressable>
                  ))
              )}
            </View>
          )}

          {/* 판별 버튼 */}
          {stopFacilities.length > 0 && (
            <Pressable
              onPress={() => void runValidation()}
              disabled={builderRunning || chosenPets.length === 0}
              style={({ pressed }) => [
                styles.checkBtn,
                {
                  backgroundColor:
                    chosenPets.length === 0 ? p.line : pressed || builderRunning ? p.accentDark : p.accent,
                },
              ]}>
              {builderRunning ? (
                <>
                  <ActivityIndicator color={p.onAccent} size="small" />
                  <Text style={[styles.checkLabel, { color: p.onAccent }]}>코스 전체를 판별하고 있어요…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={17} color={p.onAccent} />
                  <Text style={[styles.checkLabel, { color: p.onAccent }]}>코스 전체 판별하기</Text>
                </>
              )}
            </Pressable>
          )}

          {/* 판별 결과 — 추천 코스와 같은 서버 응답을 같은 패널로 그린다 */}
          {courseCheck?.key === builderSig && (
            <CourseCheckPanel result={courseCheck.result} />
          )}
          {courseCheckError?.key === builderSig && (
            <Text style={[styles.courseCheckError, { color: p.muted }]}>{courseCheckError.message}</Text>
          )}
        </View>
      </ScrollView>
      {/* 어디서 눌렀든 보이게 화면 아래에 띄운다 — 배너를 블록 안에 두면 담기 버튼에서 멀다 */}
      <CourseActionNotice message={saveMessage} onDismiss={() => setSaveMessage(null)} />

      <StopReorderSheet
        visible={reordering}
        stops={stopFacilities}
        onClose={() => setReordering(false)}
        onConfirm={(ids) => {
          setStopIds(ids);
          setReordering(false);
          // 순서가 바뀌면 이전 판별 결과는 더 이상 이 코스의 답이 아니다
          setCourseCheck(null);
          setCourseCheckError(null);
        }}
      />
    </SafeAreaView>
  );
}

/**
 * 지역×테마 추천 결과 카드.
 *
 * `isMealStop`은 서버가 자동으로 끼워 넣은 식사 스톱이다 — 개인화·취향 매치 결과가 아니라
 * "테마 하나로만 채워지는 걸 완화하려고" 붙인 것이라, 만족도나 취향 문구를 붙이면 거짓이 된다.
 * 그래서 별도 태그로 구분해 표시한다(명세의 요구).
 */
/**
 * 좋아한 곳 카드. 만족도 문구는 **식사 스톱이 아닐 때만** 붙인다 —
 * 식사 스톱은 서버가 동선 근처에서 자동으로 끼워 넣은 것이라 만족도가 더미값(0)이고,
 * 거기에 "9.4점" 같은 문구를 붙이면 그냥 거짓말이 된다.
 */
/**
 * 서버 코스 판별 결과 패널.
 *
 * `time`은 **데모용 고정값**(첫 스톱 10:00, 스톱마다 +90분)이라 실제 방문 시간과 무관하다.
 * 그대로 시간표처럼 보여주면 사용자가 실제 일정으로 오해하므로 "예상(참고용)"임을 밝힌다.
 *
 * `alternative`가 없다고 "대안이 없다"고 단정하지 않는다 — 서버는 반경 30km 상위 20곳 안에서만
 * 찾으므로 **"가까운 곳 중엔 없다"**가 정확한 뜻이다.
 */
/** 서버 코스를 그대로 일괄 판별에 넘기는 버튼. 아이를 안 고르면 판별할 대상이 없다. */
/** 추천 코스를 내 코스로 담는다. 서버는 stopIds만 저장한다. */

const styles = StyleSheet.create({
  presetBlock: { gap: 10, marginTop: 4 },
  filterLabel: { fontSize: Type.footnote, fontWeight: '800', letterSpacing: 0.3 },
  chips: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.xl },
  presetState: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  presetStateText: { fontSize: Type.body, textAlign: 'center', lineHeight: 19 },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: 11, paddingHorizontal: Spacing.lg,
  },
  savedTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedName: { fontSize: Type.body, fontWeight: '700', flexShrink: 1 },
  savedMeta: { fontSize: Type.caption },
  // 공개 코스는 이름 아래에 올린 사람을 함께 보여준다 — 남의 코스라는 게 한눈에 보여야 한다
  publicTexts: { flexShrink: 1, gap: 1 },
  retryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: Spacing.lg,
  },
  courseCheckError: { fontSize: Type.footnote, marginTop: 4, paddingHorizontal: 2 },
  /**
   * 순서 배지. **원은 View, 숫자는 Text**로 나눈다.
   *
   * 예전에는 Text 하나에 크기·원형·정렬을 다 걸었는데, Text는 flex 컨테이너가 아니라
   * `alignItems`·`justifyContent`가 먹지 않는다. 그래서 숫자가 원 안에서 한쪽으로 쏠렸다.
   * 글씨 크기 설정을 키우면 더 어긋난다 — 글자만 커지고 원은 고정이라서다.
   */
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 64, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.lg, paddingTop: Spacing.sm },
  head: { gap: 4 },
  eyebrow: { fontSize: Type.caption, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  title: { fontSize: Type.screenTitle, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { fontSize: Type.body, lineHeight: 20, marginTop: 4 },

  petRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  petChipText: { fontSize: Type.body, fontWeight: '700' },

  presetWrap: { gap: Spacing.sm },
  blockLabel: { fontSize: Type.callout, fontWeight: '800' },
  buildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 13,
  },
  buildText: { fontSize: Type.bodyLg, fontWeight: '800' },

  builder: { gap: Spacing.sm },
  builderTitle: { flex: 1, gap: 2 },
  builderSub: { fontSize: Type.caption },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 8,
    marginBottom: 2,
  },
  reorderBtnText: { fontSize: Type.footnote, fontWeight: '800' },
  builderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clear: { fontSize: Type.footnote, fontWeight: '700' },
  stopRow: { flexDirection: 'row', gap: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md },
  stopOrder: { alignItems: 'center', width: 26 },
  orderDot: { width: 26, height: 26, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  orderNum: { fontSize: Type.body, fontWeight: '900' },
  orderLine: { width: 2, flex: 1, marginTop: 2 },
  stopBody: { flex: 1, gap: 2 },
  stopTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  stopCat: { fontSize: Type.micro, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  stopName: { fontSize: Type.callout, fontWeight: '800', letterSpacing: -0.3 },
  stopMeta: { fontSize: Type.footnote },
  saveCourseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 11,
  },
  saveCourseText: { fontSize: Type.callout, fontWeight: '800' },
  stopTime: { justifyContent: 'center' },
  stopActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 4 },
  addStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 12,
  },
  addStopText: { fontSize: Type.body, fontWeight: '800' },

  pickList: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.sm },
  pickSearch: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
    fontSize: Type.bodyLg,
    marginBottom: 4,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  shareInput: { flex: 1, fontSize: Type.bodyLg, padding: 0 },
  shareBtn: { fontSize: Type.body, fontWeight: '800' },
  pickState: { alignItems: 'center', gap: 8, paddingVertical: Spacing.lg },
  pickEmpty: { fontSize: Type.body, textAlign: 'center', paddingVertical: Spacing.lg },
  pickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
  },
  pickName: { fontSize: Type.bodyLg, fontWeight: '700' },
  pickMeta: { fontSize: Type.footnote, marginTop: 1 },

  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.full,
    paddingVertical: 16,
  },
  checkLabel: { fontSize: Type.callout, fontWeight: '800' },

});
