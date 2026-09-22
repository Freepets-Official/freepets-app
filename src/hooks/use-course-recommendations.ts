import { useEffect, useState } from 'react';

import {
  type CourseDistanceOption,
  type CourseRegion,
  type CourseTheme,
  type LikedCourse,
  type PresetCourse,
  type SimilarCourse,
} from '@/data/types';
import { ApiError, coursesApi } from '@/lib/api';

/**
 * 서버가 만들어 주는 코스 추천 — 지역×테마와 개인화, 둘 다.
 *
 * `course.tsx`에서 떼어낸 조각이다. 둘을 한 훅에 둔 이유는 **입력을 공유하기 때문**이다:
 * 지역(`sido`/`sigungu`)과 최대 거리는 두 조회에 함께 들어간다. 나눠 두면 같은 값을 훅
 * 둘에 각각 넘기고 동기화까지 맞춰야 한다.
 *
 * 반대로 **빌더·판별·보관함과는 겹치지 않는다** — 이 훅은 무엇도 저장하지 않고, 화면이
 * 결과를 받아 그리기만 한다. 그 선을 따라 잘랐다.
 *
 * 고른 아이(`selectedPetIds`)만 바깥에서 받는다. 개인화 추천이 "누구 취향인지"를 그걸로
 * 정하기 때문이다.
 */
export function useCourseRecommendations(selectedPetIds: number[]) {
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

  return {
    // 재료
    regions,
    themes,
    distanceOptions,
    sigunguOptions,
    // 필터
    sido,
    setSido,
    sigungu,
    setSigungu,
    pickedThemes,
    toggleTheme,
    maxDistance,
    setMaxDistance,
    presetKey,
    presetReady,
    // 결과
    preset,
    presetLoading,
    presetError,
    liked,
    likedEmpty,
    similar,
    personalLoading,
    personalError,
  };
}
