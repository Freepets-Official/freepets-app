import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { ResultBadge } from '@/components/badge';
import { Chip } from '@/components/chip';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  PRESET_COURSES,
  recommendCourse,
  recommendSimilarCourse,
  validateCourse,
  type Course,
  type StopResult,
} from '@/data/course';
import { formatDistance, isMockFacilityId } from '@/data/mock';
import { facilitiesApi } from '@/lib/api';
import { getCurrentLocation, type Coords } from '@/lib/location';
import {
  CATEGORY_LABEL,
  RESULT_LABEL,
  type CourseDistanceOption,
  type CourseRegion,
  type CourseCheckResult,
  type CourseStop,
  type CourseTheme,
  type LikedCourse,
  type Facility,
  type PresetCourse,
  type PublicCourse,
  type SavedCourse,
  type SimilarCourse,
} from '@/data/types';
import { ApiError, aiApi, coursesApi } from '@/lib/api';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 여행 코스 판별 (F3) — 하루 동선 전체를 한 번에 검증한다.
 * 낱개 시설이 "이 문"을 풀었다면, 코스는 "이 하루"를 푼다.
 */
/** 코스 빌더 검색 반경. 하루 동선이라 한 도시를 덮을 만큼이면 된다. */
const PICK_RADIUS_M = 30_000;
/** 위치를 못 받았을 때의 기준점(서울시청). 키워드로 전국을 찾을 수 있게 열어둔다. */
const PICK_FALLBACK_CENTER: Coords = { latitude: 37.5665, longitude: 126.978 };

export default function CourseScreen() {
  const p = usePalette();
  const router = useRouter();
  const { pets, satisfactions, facilityById, registerFacilities, loadFacility, lastCoords, setLastCoords } =
    useAppStore();

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

  // ── 내 코스 저장 ────────────────────────────────────────────────────
  // 서버는 stopIds만 저장한다. 추천 당시의 이름·카테고리·점수는 안 남으므로 목록을 그릴 땐
  // 그 ID로 시설을 다시 조회해야 한다 — 지금은 개수만 보여주고 상세는 다음 작업으로 둔다.
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  /**
   * 내 코스 동작의 결과 안내. 실패는 성공과 다르게 보여야 한다.
   *
   * 공개 토글은 서버가 COURSE4045("공개하려면 코스에 담긴 모든 시설에 판별 기록과 리뷰가
   * 있어야 합니다")로 거절할 수 있는데, 예전에는 이 문장을 블록 맨 아래 회색 작은 글씨로
   * 그려서 누른 자리에서 멀었다. 사용자는 아무 일도 안 일어난 것으로 봤다.
   */
  const [saveMessage, setSaveMessage] = useState<{ text: string; failed: boolean } | null>(null);

  // ── 둘러보기 (다른 사람이 공개한 코스) ────────────────────────────
  // 로그인 없이도 보이는 목록이라 내 코스와 따로 싣는다. 실패를 빈 목록과 구분해서
  // 들고 있어야 "아직 없어요"와 "못 불러왔어요"를 다르게 안내할 수 있다.
  const [publicCourses, setPublicCourses] = useState<PublicCourse[] | null>(null);
  const [publicTotal, setPublicTotal] = useState(0);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState(false);
  const [publicPendingId, setPublicPendingId] = useState<number | null>(null);

  /**
   * 둘러보기에서 **내 코스를 걸러낸다.**
   *
   * `GET /courses/public`은 인증이 없어 서버가 호출자를 모른다. 그래서 내가 공개한 코스도
   * 그대로 내려온다 — 거르지 않으면 같은 코스가 "내 코스"와 "다른 집사의 코스"에 동시에 뜨고,
   * 내 닉네임이 남의 것처럼 붙는다(실서버에서 확인).
   *
   * 로그인 전에는 `savedCourses`가 비어 거를 대상이 없다. 그때는 전부 남의 코스가 맞다.
   */
  /** 이번 세션에 담은 원본 공개 코스 ID. 목록에서 빼 중복 저장을 막는다. */
  const [copiedIds, setCopiedIds] = useState<ReadonlySet<number>>(() => new Set());
  const otherCourses = useMemo(() => {
    if (publicCourses === null) return null;
    const mine = new Set(savedCourses.map((c) => c.courseId));
    // 담은 코스는 **새 코스 ID**로 저장된다. 원본 ID와 겹치지 않으므로 `mine`만으로는
    // 걸러지지 않고, 같은 행을 다시 누르면 같은 동선이 또 저장된다. 원본 ID를 따로 센다.
    return publicCourses.filter((c) => !mine.has(c.courseId) && !copiedIds.has(c.courseId));
  }, [publicCourses, savedCourses, copiedIds]);


  /** 목록 새로고침. 실패하면 던진다 — 호출자가 "무엇이 실패했는지" 구분해 안내해야 한다. */
  const reloadSaved = useCallback(async () => {
    setSavedCourses(await coursesApi.list());
  }, []);

  /**
   * 둘러보기 새로고침. 화면에 재시도 버튼이 걸려 있다.
   *
   * 늦게 온 응답이 새 응답을 덮지 않게 요청마다 번호를 매긴다 — 실패 후 두 번 누르면
   * 먼저 보낸 요청이 나중에 도착할 수 있고, 그러면 옛 목록이 최종 화면이 된다.
   */
  const publicReqRef = useRef(0);
  const reloadPublic = useCallback(async () => {
    const seq = ++publicReqRef.current;
    setPublicLoading(true);
    try {
      const r = await coursesApi.publicList({ size: 10 });
      if (seq !== publicReqRef.current) return;
      setPublicCourses(r.items);
      setPublicTotal(r.total);
      setPublicError(false);
    } catch {
      if (seq !== publicReqRef.current) return;
      setPublicError(true);
    } finally {
      if (seq === publicReqRef.current) setPublicLoading(false);
    }
  }, []);

  // 초기 로드는 effect 안에서 직접 받는다. reloadSaved를 그대로 부르면 effect 본문에서
  // setState를 동기로 부르는 모양이 되어 연쇄 렌더 경고가 뜬다.
  useEffect(() => {
    let active = true;
    coursesApi
      .list()
      .then((list) => {
        if (active) setSavedCourses(list);
      })
      .catch(() => {
        // 저장된 코스를 못 받아도 추천·판별은 그대로 쓸 수 있어야 한다
      });
    return () => {
      active = false;
    };
  }, []);

  // 둘러보기는 인증이 없어 로그인 전에도 뜬다. 내 코스와 분리해 실패가 서로를 가리지 않게 한다.
  useEffect(() => {
    let active = true;
    coursesApi
      .publicList({ size: 10 })
      .then((r) => {
        if (active) {
          setPublicCourses(r.items);
          setPublicTotal(r.total);
          setPublicError(false);
        }
      })
      .catch(() => {
        // 못 불러온 것을 "공개된 코스가 없다"로 보여주면 서비스가 빈 것처럼 읽힌다.
        // 목록은 null로 남긴다 — []로 떨어뜨리면 length===0만 보는 코드가 장애를 빈 목록으로 읽는다.
        if (active) setPublicError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveCourse = async (key: string, name: string, stops: CourseStop[]) => {
    if (stops.length === 0) return;
    setSavingKey(key);
    setSaveMessage(null);
    try {
      // 서버는 1~10개만 받는다. 추천 stops의 facilityId를 순서 그대로 넣으면 내 코스가 된다.
      //
      // 담은 날짜를 이름에 남긴다. 서버 추천 제목은 그날그날 같은 문구가 오기 때문에
      // ("지금 인기 있는 곳" 등) 여러 번 담으면 목록에 같은 이름만 쌓여 구분이 안 된다.
      const stamp = new Date();
      const created = await coursesApi.create({
        name: `${name} · ${stamp.getMonth() + 1}/${stamp.getDate()}`,
        stopIds: stops.slice(0, 10).map((st) => st.facilityId),
      });
      // 저장 결과로 목록을 먼저 갱신한다. 목록 재조회가 실패해도 방금 담은 코스는 보여야 한다 —
      // 저장은 됐는데 목록에 없으면 사용자는 실패한 줄 안다.
      setSavedCourses((prev) => [created, ...prev.filter((c) => c.courseId !== created.courseId)]);
      setSaveMessage({ text: `'${name}'을(를) 내 코스에 담았어요`, failed: false });
      // 서버가 매긴 순서·필드로 맞춰두되, 실패는 저장 성공을 덮지 않는다
      reloadSaved().catch(() => {});
    } catch (e) {
      setSaveMessage({ text: e instanceof Error ? e.message : '코스를 저장하지 못했어요', failed: true });
    } finally {
      setSavingKey(null);
    }
  };

  const removeCourse = async (courseId: number) => {
    try {
      await coursesApi.remove(courseId);
      // 삭제 성공을 화면에 먼저 반영한다(같은 이유로 목록 재조회 실패에 기대지 않는다)
      setSavedCourses((prev) => prev.filter((c) => c.courseId !== courseId));
      setSaveMessage(null);
      reloadSaved().catch(() => {});
    } catch {
      setSaveMessage({ text: '코스를 삭제하지 못했어요', failed: true });
    }
  };

  /**
   * 남의 공개 코스를 내 코스로 담는다.
   *
   * 서버가 코스를 통째로 복제해주는 API는 없다. 대신 `stopIds`를 그대로 새 코스로 저장하면
   * 같은 동선이 내 것이 된다 — 명세도 이 엔드포인트의 쓸모를 그렇게 적어뒀다.
   * 이름에 누구 것인지 남겨, 나중에 목록에서 내가 만든 것과 구분되게 한다.
   */
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const copyPublicCourse = async (course: PublicCourse) => {
    setCopyingId(course.courseId);
    setSaveMessage(null);
    try {
      const created = await coursesApi.create({
        name: course.ownerNickname ? `${course.name} (${course.ownerNickname})` : course.name,
        description: course.description ?? undefined,
        stopIds: course.stopIds.slice(0, 10),
      });
      setSavedCourses((prev) => [created, ...prev.filter((c) => c.courseId !== created.courseId)]);
      setCopiedIds((prev) => new Set(prev).add(course.courseId));
      setSaveMessage({ text: `'${course.name}'을(를) 내 코스에 담았어요`, failed: false });
    } catch (e) {
      setSaveMessage({ text: e instanceof Error ? e.message : '코스를 담지 못했어요', failed: true });
    } finally {
      setCopyingId((cur) => (cur === course.courseId ? null : cur));
    }
  };

  /**
   * 내 코스를 공개/비공개로 바꾼다. 서버 `PUT /courses/{id}`는 부분 수정이 아니라 **전체 교체**라
   * 이름·설명·스톱을 그대로 다시 실어 보낸다 — 빠뜨리면 코스가 지워진 채로 저장된다.
   */
  const togglePublic = async (course: SavedCourse) => {
    const next = !course.isPublic;
    setPublicPendingId(course.courseId);
    setSaveMessage(null);
    try {
      // 토글 전용 엔드포인트. 이름·스톱을 다시 보내지 않으므로 스톱이 비어도 막히지 않는다.
      const updated = await coursesApi.setVisibility(course.courseId, next);
      setSavedCourses((prev) => prev.map((c) => (c.courseId === updated.courseId ? updated : c)));
      setSaveMessage({
        text: next ? `'${course.name}'을(를) 공개했어요` : `'${course.name}'을(를) 비공개로 바꿨어요`,
        failed: false,
      });
      // 둘러보기를 다시 부르지 않는다. 내 코스는 그 목록에서 걸러지므로 바뀔 게 없고,
      // 부르면 늦게 온 응답이 새 목록을 덮는 경합만 생긴다.
    } catch (e) {
      /**
       * COURSE4045 = 코스에 담긴 시설 전부에 판별 기록과 리뷰가 있어야 공개할 수 있다.
       * 서버 문구가 이미 그 뜻을 담고 있어 그대로 쓰되, 다음에 뭘 하면 되는지 덧붙인다.
       */
      const isNeedReview = e instanceof ApiError && e.code === 'COURSE4045';
      setSaveMessage({
        text: isNeedReview
          ? `${e.message}\n코스에 담긴 곳을 판별하고 리뷰를 남긴 뒤 다시 시도해 주세요.`
          : e instanceof Error
            ? e.message
            : '공개 설정을 바꾸지 못했어요',
        failed: true,
      });
    } finally {
      // 다른 코스의 토글이 이미 자리를 차지했으면 그쪽 스피너를 끄지 않는다
      setPublicPendingId((cur) => (cur === course.courseId ? null : cur));
    }
  };

  /**
   * 판별 요청의 서명. 코스 종류만으로는 부족하다 — 같은 'liked'라도 고른 아이나 스톱이 바뀌면
   * 다른 요청이므로, 늦게 도착한 옛 응답이 새 입력의 결과인 것처럼 덮어쓰면 안 된다.
   * 방문 순서가 결과를 바꾸므로 facilityIds는 정렬하지 않는다.
   */
  /** 빌더로 만든 코스의 판별 결과를 구분하는 키. 추천 코스(preset·liked·similar)와 섞이면 안 된다. */
  const BUILDER_KEY = 'builder';

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
    try {
      const res = await aiApi.courseCheck(selectedPetIds, facilityIds);
      // 그 사이 아이나 코스가 바뀌었으면 이 응답은 더 이상 화면의 답이 아니다
      if (checkSignature(key, facilityIds) !== sig) return;
      setCourseCheck({ key: sig, result: res });
    } catch (e) {
      if (checkSignature(key, facilityIds) !== sig) return;
      setCourseCheckError({
        key: sig,
        message: e instanceof Error ? e.message : '코스를 판별하지 못했어요',
      });
    } finally {
      setCourseCheckKey((cur) => (cur === sig ? null : cur));
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
          radiusM: PICK_RADIUS_M,
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
  const openSavedCourse = async (course: SavedCourse) => {
    setOpeningCourseId(course.courseId);
    try {
      const missing = course.stopIds.filter((id) => !facilityById(id));
      await Promise.all(missing.map((id) => loadFacility(id)));
    } finally {
      setOpeningCourseId(null);
    }
    setStopIds(course.stopIds);
    setPicking(false);
  };

  /**
   * 스톱 추가. **서버 판별이 10곳까지만 받는다.**
   *
   * 예전에는 제한 없이 담기고 판별은 앞 10곳만 보냈다. 11곳짜리 코스를 만들면 뒤 1곳은
   * 판별되지도 않았는데 결과가 "코스 전체"로 표시됐다 — 가장 위험한 종류의 거짓이다.
   * 담는 단계에서 막고 이유를 알린다.
   */
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <Text style={[styles.empty, { color: p.muted }]}>
              반려동물 탭에서 아이를 먼저 등록해 주세요.
            </Text>
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

              {saveMessage && (
                <View
                  style={[
                    styles.saveNotice,
                    saveMessage.failed
                      ? { backgroundColor: p.dangerSoft, borderColor: p.danger }
                      : { backgroundColor: p.successSoft, borderColor: p.success },
                  ]}>
                  <Ionicons
                    name={saveMessage.failed ? 'alert-circle' : 'checkmark-circle'}
                    size={16}
                    color={saveMessage.failed ? p.danger : p.success}
                  />
                  <Text
                    style={[
                      styles.saveNoticeText,
                      { color: saveMessage.failed ? p.danger : p.ink },
                    ]}>
                    {saveMessage.text}
                  </Text>
                </View>
              )}

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
            <View style={styles.builder}>
              <View style={styles.builderHead}>
                <Text style={[styles.blockLabel, { color: p.ink }]}>내 코스 · {stopFacilities.length}곳</Text>
                <Pressable onPress={() => { setStopIds([]); setCourseCheck(null); setCourseCheckError(null); }}>
                  <Text style={[styles.clear, { color: p.muted }]}>비우기</Text>
                </Pressable>
              </View>

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
                        router.push({ pathname: '/facility/[id]', params: { id: String(f.facilityId) } })
                      }
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
function SaveCourseAction({ running, onPress }: { running: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={running}
      style={({ pressed }) => [
        styles.saveBtn,
        { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
      ]}>
      {running ? (
        <ActivityIndicator color={p.muted} size="small" />
      ) : (
        <>
          <Ionicons name="bookmark-outline" size={15} color={p.muted} />
          <Text style={[styles.saveBtnText, { color: p.muted }]}>내 코스에 담기</Text>
        </>
      )}
    </Pressable>
  );
}

function CourseCheckAction({
  label,
  disabled,
  running,
  onPress,
  error,
}: {
  label: string;
  disabled: boolean;
  running: boolean;
  onPress: () => void;
  /** 이 버튼으로 낸 판별이 실패했을 때의 문구. 버튼 바로 아래에 붙어야 사용자가 본다. */
  error?: string | null;
}) {
  const p = usePalette();
  return (
    <>
    <Pressable
      onPress={onPress}
      disabled={disabled || running}
      style={({ pressed }) => [
        styles.courseCheckBtn,
        {
          borderColor: disabled ? p.line : p.accent,
          backgroundColor: pressed && !disabled ? p.accentSoft : 'transparent',
        },
      ]}>
      {running ? (
        <ActivityIndicator color={p.accent} size="small" />
      ) : (
        <Text style={[styles.courseCheckBtnText, { color: disabled ? p.muted : p.accent }]}>
          {disabled ? '데려갈 아이를 골라 주세요' : label}
        </Text>
      )}
    </Pressable>
    {error && <Text style={[styles.courseCheckError, { color: p.muted }]}>{error}</Text>}
    </>
  );
}

function CourseCheckPanel({ result }: { result: CourseCheckResult }) {
  const p = usePalette();
  const router = useRouter();
  /**
   * 스톱을 누르면 시설 상세로 간다.
   *
   * 「조건부」가 왜 조건부인지 확인하려면 시설이 게시한 원문을 봐야 하는데, 코스 판별
   * 응답에는 원문이 없다(FacilitySummary는 id·이름·카테고리뿐). 그래서 지금까지는
   * 코스를 벗어나 시설을 다시 검색해 들어갔다가 돌아와야 했다. 뒤로가기로 코스에
   * 그대로 돌아오므로 판별 결과도 남는다.
   */
  const openFacility = (facilityId: number) =>
    router.push({ pathname: '/facility/[id]', params: { id: String(facilityId) } });
  const tone =
    result.overall === 'DENIED' ? p.danger : result.overall === 'CONDITIONAL' ? p.warn : p.success;
  return (
    <View style={[styles.checkPanel, { borderColor: p.line, backgroundColor: p.surface }]}>
      <View style={styles.checkHead}>
        <Text style={[styles.checkOverall, { color: tone }]}>{RESULT_LABEL[result.overall]}</Text>
        {result.blockedCount > 0 && (
          <Text style={[styles.checkSub, { color: p.muted }]}>
            못 가는 곳 {result.blockedCount}곳
          </Text>
        )}
        <Text style={[styles.checkSub, { color: p.muted, marginLeft: 'auto' }]}>
          시간은 예상(참고용)
        </Text>
      </View>

      {result.stops.map((st) => (
        <Pressable
          key={st.facility.facilityId}
          onPress={() => openFacility(st.facility.facilityId)}
          style={({ pressed }) => [styles.checkStop, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.checkTime, { color: p.muted }]}>{st.time}</Text>
          <View style={styles.checkStopBody}>
            <View style={styles.checkStopHead}>
              <Text style={[styles.checkStopName, { color: p.ink }]} numberOfLines={1}>
                {st.facility.name}
              </Text>
              <ResultBadge result={st.overall} />
              <Ionicons name="chevron-forward" size={15} color={p.muted} />
            </View>
            {st.verdicts.map((v) => (
              <Text key={v.petId} style={[styles.checkReason, { color: p.muted }]}>
                {v.petName ? `${v.petName} · ` : ''}
                {v.reason}
              </Text>
            ))}
            {st.overall === 'DENIED' &&
              (st.alternative ? (
                <Text style={[styles.checkAlt, { color: p.accent }]}>
                  대신 {st.alternative.name} ({st.alternative.distanceKm.toFixed(1)}km)
                </Text>
              ) : (
                <Text style={[styles.checkAlt, { color: p.muted }]}>
                  가까운 곳 중엔 대체할 만한 시설을 찾지 못했어요. 이 스톱은 빼는 걸 권해요.
                </Text>
              ))}
            <Text style={[styles.checkOpen, { color: p.accent }]}>눌러서 시설 조건 원문 보기</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function LikedCourseCard({ course }: { course: LikedCourse }) {
  const p = usePalette();
  return (
    <View style={[styles.presetCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <Text style={[styles.presetTitle, { color: p.ink }]}>{course.title}</Text>
      {course.stops.map((st, i) => (
        <View key={st.facilityId} style={styles.presetStopBlock}>
          <View style={styles.presetStop}>
            <View style={[styles.presetOrder, { backgroundColor: p.accentSoft }]}>
              <Text style={[styles.presetOrderNum, { color: p.accent }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.presetStopName, { color: p.ink }]} numberOfLines={1}>
              {st.name}
            </Text>
            {st.isMealStop && (
              <Text style={[styles.mealTag, { backgroundColor: p.surface, color: p.muted }]}>식사</Text>
            )}
            <Text style={[styles.presetStopMeta, { color: p.muted, marginLeft: 'auto' }]}>
              {CATEGORY_LABEL[st.category]}
            </Text>
          </View>
          {!st.isMealStop && st.reasonPets.length > 0 && (
            <Text style={[styles.stopReason, { color: p.muted }]}>
              {st.reasonPets.map((rp) => `${rp.petName} ${rp.score.toFixed(1)}점`).join(' · ')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * 취향 비슷한 새곳 카드.
 *
 * `isPersonalized: false`면 취향 매치가 아니라 **리뷰 평점 기준 인기 코스**로 자동 전환된
 * 결과다. 그대로 "취향 기반"이라고 보여주면 사용자를 속이는 것이라, 제목 아래에 무엇을
 * 근거로 뽑았는지 밝힌다. 스톱별 `reason`은 서버 문구를 그대로 쓴다(재조합 금지).
 */
function SimilarCourseCard({ course }: { course: SimilarCourse }) {
  const p = usePalette();
  return (
    <View style={[styles.presetCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <Text style={[styles.presetTitle, { color: p.ink }]}>{course.title}</Text>
      {!course.isPersonalized && (
        <Text style={[styles.coldStart, { color: p.muted }]}>
          아직 취향 데이터가 없어 평점이 좋은 곳으로 보여드려요.
        </Text>
      )}
      {course.stops.map((st, i) => (
        <View key={st.facilityId} style={styles.presetStopBlock}>
          <View style={styles.presetStop}>
            <View style={[styles.presetOrder, { backgroundColor: p.accentSoft }]}>
              <Text style={[styles.presetOrderNum, { color: p.accent }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.presetStopName, { color: p.ink }]} numberOfLines={1}>
              {st.name}
            </Text>
            {st.isMealStop && (
              <Text style={[styles.mealTag, { backgroundColor: p.surface, color: p.muted }]}>식사</Text>
            )}
          </View>
          {!!st.reason && <Text style={[styles.stopReason, { color: p.muted }]}>{st.reason}</Text>}
        </View>
      ))}
    </View>
  );
}

function PresetCourseCard({ course }: { course: PresetCourse }) {
  const p = usePalette();
  return (
    <View style={[styles.presetCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <Text style={[styles.presetTitle, { color: p.ink }]}>{course.title}</Text>
      {course.stops.map((st, i) => (
        <View key={st.facilityId} style={styles.presetStop}>
          <View style={[styles.presetOrder, { backgroundColor: p.accentSoft }]}>
            <Text style={[styles.presetOrderNum, { color: p.accent }]}>{i + 1}</Text>
          </View>
          <Text style={[styles.presetStopName, { color: p.ink }]} numberOfLines={1}>
            {st.name}
          </Text>
          {st.isMealStop && (
            <Text style={[styles.mealTag, { backgroundColor: p.surface, color: p.muted }]}>식사</Text>
          )}
          <Text style={[styles.presetStopMeta, { color: p.muted, marginLeft: 'auto' }]}>
            {CATEGORY_LABEL[st.category]}
            {i > 0 ? ` · ${formatDistance(st.distanceM)}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CoursePickCard({
  course,
  highlight,
  onPress,
}: {
  course: Course;
  highlight?: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  const { facilityById } = useAppStore();
  const stops = course.stopIds.map((id) => facilityById(id)?.name).filter(Boolean);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickCard,
        CardShadow,
        {
          backgroundColor: highlight ? p.accentSoft : p.card,
          borderColor: highlight ? p.accent : p.line,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View style={styles.pickCardTop}>
        <Ionicons
          name={course.source === 'RECOMMENDED' ? 'heart' : 'map'}
          size={15}
          color={p.accent}
        />
        <Text style={[styles.pickCardName, { color: p.ink }]}>{course.name}</Text>
      </View>
      {course.description && (
        <Text style={[styles.pickCardDesc, { color: p.muted }]}>{course.description}</Text>
      )}
      <Text style={[styles.pickCardStops, { color: p.accent }]} numberOfLines={1}>
        {stops.join(' → ')}
      </Text>
    </Pressable>
  );
}

function CourseResultView({
  result,
  petCount,
  onSwap,
}: {
  result: ReturnType<typeof validateCourse>;
  petCount: number;
  onSwap: (fromId: number, toId: number) => void;
}) {
  const p = usePalette();

  const tone = {
    ALLOWED: { color: p.success, soft: p.successSoft },
    CONDITIONAL: { color: p.warn, soft: p.warnSoft },
    DENIED: { color: p.danger, soft: p.dangerSoft },
  }[result.overall];

  const summary =
    result.overall === 'ALLOWED'
      ? petCount > 1
        ? '모든 스톱에 다 함께 갈 수 있어요'
        : '모든 스톱에 갈 수 있어요'
      : result.overall === 'CONDITIONAL'
        ? '조건만 지키면 코스 전체를 돌 수 있어요'
        : `${result.blockedCount}곳에서 막혀요 — 아래 대체를 확인하세요`;

  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.resultWrap}>
      <View style={[styles.resultBanner, { backgroundColor: tone.soft, borderColor: tone.color }]}>
        <Text style={[styles.resultTitle, { color: tone.color }]}>{summary}</Text>
        <ResultBadge result={result.overall} />
      </View>

      {result.stops.map((s, i) => (
        <StopResultCard key={s.facility.facilityId} stop={s} index={i} onSwap={onSwap} />
      ))}
    </Animated.View>
  );
}

function StopResultCard({
  stop,
  index,
  onSwap,
}: {
  stop: StopResult;
  index: number;
  onSwap: (fromId: number, toId: number) => void;
}) {
  const p = usePalette();
  const denied = stop.group.overall === 'DENIED';
  const tone = {
    ALLOWED: p.success,
    CONDITIONAL: p.warn,
    DENIED: p.danger,
  }[stop.group.overall];

  return (
    <View style={[styles.resCard, CardShadow, { backgroundColor: p.card, borderColor: denied ? p.danger : p.line }]}>
      <View style={styles.resTop}>
        <View style={styles.resTime}>
          <Ionicons name="time-outline" size={13} color={p.muted} />
          <Text style={[styles.resTimeText, { color: p.muted }]}>{stop.time}</Text>
        </View>
        <ResultBadge result={stop.group.overall} />
      </View>
      <Text style={[styles.resName, { color: p.ink }]}>
        {index + 1}. {stop.facility.name}
      </Text>

      {/* 아이별 결과 */}
      <View style={styles.resVerdicts}>
        {stop.group.verdicts.map((v) => {
          const vTone = { ALLOWED: p.success, CONDITIONAL: p.warn, DENIED: p.danger }[v.result];
          return (
            <View key={v.petId} style={styles.resVerdictRow}>
              <Ionicons
                name={
                  v.result === 'ALLOWED'
                    ? 'checkmark-circle'
                    : v.result === 'CONDITIONAL'
                      ? 'alert-circle'
                      : 'close-circle'
                }
                size={15}
                color={vTone}
              />
              <Text style={[styles.resReason, { color: p.ink }]}>{v.reason}</Text>
            </View>
          );
        })}
      </View>

      {/* 막힌 스톱의 대체 제안 */}
      {denied && stop.alternative && (
        <View style={[styles.altBox, { backgroundColor: p.successSoft, borderColor: p.success }]}>
          <View style={styles.altHead}>
            <Ionicons name="swap-horizontal" size={15} color={p.success} />
            <Text style={[styles.altLabel, { color: p.success }]}>이렇게 바꾸면 다 함께 갈 수 있어요</Text>
          </View>
          <Text style={[styles.altName, { color: p.ink }]}>{stop.alternative.name}</Text>
          <Text style={[styles.altMeta, { color: p.muted }]}>
            {CATEGORY_LABEL[stop.alternative.category]} · {formatDistance(stop.alternative.distanceM)}
          </Text>
          <Pressable
            onPress={() => onSwap(stop.facility.facilityId, stop.alternative!.facilityId)}
            style={({ pressed }) => [
              styles.altBtn,
              { backgroundColor: pressed ? p.successSoft : p.card, borderColor: p.success },
            ]}>
            <Text style={[styles.altBtnText, { color: p.success }]}>이 곳으로 바꾸기</Text>
          </Pressable>
        </View>
      )}
      {denied && !stop.alternative && (
        <Text style={[styles.noAlt, { color: p.muted }]}>
          같은 성격의 대체 시설을 찾지 못했어요. 이 스톱은 빼는 것을 권장해요.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  saveNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 11,
    paddingHorizontal: Spacing.lg,
  },
  saveNoticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  presetBlock: { gap: 10, marginTop: 4 },
  filterLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  chips: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.xl },
  presetState: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  presetStateText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  presetCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: 10 },
  presetTitle: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3 },
  presetStop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  presetStopBlock: { gap: 3 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: 9, marginTop: 4,
  },
  saveBtnText: { fontSize: 12.5, fontWeight: '700' },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: 11, paddingHorizontal: Spacing.lg,
  },
  savedTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedName: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  savedMeta: { fontSize: 11.5 },
  // 공개 코스는 이름 아래에 올린 사람을 함께 보여준다 — 남의 코스라는 게 한눈에 보여야 한다
  publicTexts: { flexShrink: 1, gap: 1 },
  retryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: Spacing.lg,
  },
  courseCheckBtn: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingVertical: 9, alignItems: 'center', marginTop: 4,
  },
  courseCheckBtnText: { fontSize: 13, fontWeight: '800' },
  courseCheckError: { fontSize: 12, marginTop: 4, paddingHorizontal: 2 },
  checkPanel: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, gap: 10, marginTop: 6 },
  checkHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  checkOverall: { fontSize: 14, fontWeight: '800' },
  checkSub: { fontSize: 11.5 },
  checkStop: { flexDirection: 'row', gap: 10 },
  checkTime: { fontSize: 11.5, fontWeight: '700', width: 42, fontVariant: ['tabular-nums'] },
  checkStopBody: { flex: 1, gap: 3 },
  checkStopHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkStopName: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  checkReason: { fontSize: 11.5, lineHeight: 17 },
  checkOpen: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  checkAlt: { fontSize: 11.5, lineHeight: 17, fontWeight: '600' },
  stopReason: { fontSize: 11.5, lineHeight: 17, paddingLeft: 30 },
  coldStart: { fontSize: 12, lineHeight: 18 },
  /**
   * 순서 배지. **원은 View, 숫자는 Text**로 나눈다.
   *
   * 예전에는 Text 하나에 크기·원형·정렬을 다 걸었는데, Text는 flex 컨테이너가 아니라
   * `alignItems`·`justifyContent`가 먹지 않는다. 그래서 숫자가 원 안에서 한쪽으로 쏠렸다.
   * 글씨 크기 설정을 키우면 더 어긋난다 — 글자만 커지고 원은 고정이라서다.
   */
  presetOrder: {
    width: 22, height: 22, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  presetOrderNum: { fontSize: 11, fontWeight: '800' },
  presetStopName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  presetStopMeta: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
  mealTag: {
    fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.sm, overflow: 'hidden',
  },
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 64, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.lg, paddingTop: Spacing.sm },
  head: { gap: 4 },
  eyebrow: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { fontSize: 13.5, lineHeight: 20, marginTop: 4 },
  empty: { fontSize: 13.5, paddingVertical: Spacing.xl, textAlign: 'center' },

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
  petChipText: { fontSize: 13.5, fontWeight: '700' },

  presetWrap: { gap: Spacing.sm },
  blockLabel: { fontSize: 15, fontWeight: '800' },
  pickCard: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.lg, gap: 5 },
  pickCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pickCardName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  pickCardDesc: { fontSize: 12.5, lineHeight: 18 },
  pickCardStops: { fontSize: 12, fontWeight: '700' },
  buildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 13,
  },
  buildText: { fontSize: 14, fontWeight: '800' },

  builder: { gap: Spacing.sm },
  builderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clear: { fontSize: 12.5, fontWeight: '700' },
  stopRow: { flexDirection: 'row', gap: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md },
  stopOrder: { alignItems: 'center', width: 26 },
  orderDot: { width: 26, height: 26, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  orderNum: { fontSize: 13, fontWeight: '900' },
  orderLine: { width: 2, flex: 1, marginTop: 2 },
  stopBody: { flex: 1, gap: 2 },
  stopTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  stopCat: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  stopName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  stopMeta: { fontSize: 12 },
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
  addStopText: { fontSize: 13.5, fontWeight: '800' },

  pickList: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.sm },
  pickSearch: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 4,
  },
  pickState: { alignItems: 'center', gap: 8, paddingVertical: Spacing.lg },
  pickEmpty: { fontSize: 13, textAlign: 'center', paddingVertical: Spacing.lg },
  pickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
  },
  pickName: { fontSize: 14.5, fontWeight: '700' },
  pickMeta: { fontSize: 12, marginTop: 1 },

  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.full,
    paddingVertical: 16,
  },
  checkLabel: { fontSize: 15.5, fontWeight: '800' },

  resultWrap: { gap: Spacing.md },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  resultTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.4, flexShrink: 1 },
  resCard: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.lg, gap: 7 },
  resTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resTimeText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  resName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4 },
  resVerdicts: { gap: 5, marginTop: 2 },
  resVerdictRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  resReason: { fontSize: 12.5, lineHeight: 18, flexShrink: 1 },
  altBox: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, gap: 3, marginTop: 4 },
  altHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  altLabel: { fontSize: 12, fontWeight: '800' },
  altName: { fontSize: 14.5, fontWeight: '800', marginTop: 2 },
  altMeta: { fontSize: 12 },
  altBtn: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 10,
    marginTop: 6,
  },
  altBtnText: { fontSize: 13.5, fontWeight: '800' },
  noAlt: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
});
