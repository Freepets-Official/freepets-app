import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { FACILITIES, formatDistance } from '@/data/mock';
import {
  CATEGORY_LABEL,
  RESULT_LABEL,
  type CourseDistanceOption,
  type CourseRegion,
  type CourseCheckResult,
  type CourseStop,
  type CourseTheme,
  type LikedCourse,
  type PresetCourse,
  type SimilarCourse,
} from '@/data/types';
import { ApiError, aiApi, coursesApi } from '@/lib/api';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 여행 코스 판별 (F3) — 하루 동선 전체를 한 번에 검증한다.
 * 낱개 시설이 "이 문"을 풀었다면, 코스는 "이 하루"를 푼다.
 */
export default function CourseScreen() {
  const p = usePalette();
  const { pets, satisfactions } = useAppStore();

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
  const [courseCheckError, setCourseCheckError] = useState<string | null>(null);

  /**
   * 판별 요청의 서명. 코스 종류만으로는 부족하다 — 같은 'liked'라도 고른 아이나 스톱이 바뀌면
   * 다른 요청이므로, 늦게 도착한 옛 응답이 새 입력의 결과인 것처럼 덮어쓰면 안 된다.
   * 방문 순서가 결과를 바꾸므로 facilityIds는 정렬하지 않는다.
   */
  const checkSignature = (key: string, facilityIds: number[]) =>
    `${key}|${[...selectedPetIds].sort((a, b) => a - b).join(',')}|${facilityIds.join(',')}`;

  const runCourseCheck = async (key: string, stops: CourseStop[]) => {
    if (selectedPetIds.length === 0 || stops.length === 0) return;
    // 배열 순서가 곧 방문 순서다. 서버는 1~10개만 받는다.
    const facilityIds = stops.slice(0, 10).map((st) => st.facilityId);
    const sig = checkSignature(key, facilityIds);
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
      setCourseCheckError(e instanceof Error ? e.message : '코스를 판별하지 못했어요');
    } finally {
      setCourseCheckKey((cur) => (cur === sig ? null : cur));
    }
  };
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);

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

  const result = useMemo(
    () => (validated ? validateCourse(stopIds, chosenPets) : null),
    [validated, stopIds, chosenPets],
  );

  const togglePet = (petId: number) => {
    setSelectedPetIds((prev) =>
      prev.includes(petId) ? prev.filter((x) => x !== petId) : [...prev, petId],
    );
    setValidated(false);
  };

  const loadCourse = (course: Course) => {
    setStopIds(course.stopIds);
    setValidated(false);
    setPicking(false);
  };

  const addStop = (facilityId: number) => {
    setStopIds((prev) => (prev.includes(facilityId) ? prev : [...prev, facilityId]));
    setValidated(false);
  };

  const removeStop = (facilityId: number) => {
    setStopIds((prev) => prev.filter((x) => x !== facilityId));
    setValidated(false);
  };

  const moveStop = (index: number, dir: -1 | 1) => {
    setStopIds((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setValidated(false);
  };

  const swapToAlternative = (fromId: number, toId: number) => {
    setStopIds((prev) => prev.map((x) => (x === fromId ? toId : x)));
    setValidated(false);
  };

  const runValidation = () => {
    if (stopIds.length === 0 || chosenPets.length === 0 || loading) return;
    setLoading(true);
    // 데모: 코스 전체를 AI로 검증하는 지연을 흉내. 실제 연동 시 POST /api/v1/ai/course-check.
    setTimeout(() => {
      setValidated(true);
      setLoading(false);
    }, 900);
  };

  const stopFacilities = stopIds
    .map((id) => FACILITIES.find((f) => f.facilityId === id))
    .filter((f): f is NonNullable<typeof f> => !!f);

  const available = FACILITIES.filter((f) => !stopIds.includes(f.facilityId));

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '여행 코스' }} />
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
                    onPress={() => runCourseCheck('liked', liked.stops)}
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
                    onPress={() => runCourseCheck('similar', similar.stops)}
                  />
                  {courseCheck?.key === checkSignature('similar', similar.stops.slice(0, 10).map((st) => st.facilityId)) && (
                    <CourseCheckPanel result={courseCheck.result} />
                  )}
                </>
              )}

              {courseCheckError && (
                <Text style={[styles.presetStateText, { color: p.muted }]}>{courseCheckError}</Text>
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
                        onPress={() => runCourseCheck('preset', preset.course.stops)}
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
                <Pressable onPress={() => { setStopIds([]); setValidated(false); }}>
                  <Text style={[styles.clear, { color: p.muted }]}>비우기</Text>
                </Pressable>
              </View>

              {stopFacilities.map((f, i) => {
                const stopResult = result?.stops.find((s) => s.facility.facilityId === f.facilityId);
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

                    <View style={styles.stopBody}>
                      <View style={styles.stopTop}>
                        <Text style={[styles.stopCat, { color: p.accent }]}>
                          {CATEGORY_LABEL[f.category]}
                        </Text>
                        {stopResult && <ResultBadge result={stopResult.group.overall} />}
                      </View>
                      <Text style={[styles.stopName, { color: p.ink }]}>{f.name}</Text>
                      <Text style={[styles.stopMeta, { color: p.muted }]}>
                        {formatDistance(f.distanceM)}
                      </Text>
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
            </View>
          )}

          {/* 시설 선택 목록 (추가용) */}
          {picking && (
            <View style={[styles.pickList, { backgroundColor: p.surface, borderColor: p.line }]}>
              {available.length === 0 ? (
                <Text style={[styles.pickEmpty, { color: p.muted }]}>추가할 시설이 없어요.</Text>
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
              onPress={runValidation}
              disabled={loading || chosenPets.length === 0}
              style={({ pressed }) => [
                styles.checkBtn,
                { backgroundColor: chosenPets.length === 0 ? p.line : pressed || loading ? p.accentDark : p.accent },
              ]}>
              {loading ? (
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

          {/* 판별 결과 요약 + 대체 제안 */}
          {result && result.stops.length > 0 && (
            <CourseResultView
              result={result}
              petCount={chosenPets.length}
              onSwap={swapToAlternative}
            />
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
function CourseCheckAction({
  label,
  disabled,
  running,
  onPress,
}: {
  label: string;
  disabled: boolean;
  running: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
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
  );
}

function CourseCheckPanel({ result }: { result: CourseCheckResult }) {
  const p = usePalette();
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
        <View key={st.facility.facilityId} style={styles.checkStop}>
          <Text style={[styles.checkTime, { color: p.muted }]}>{st.time}</Text>
          <View style={styles.checkStopBody}>
            <View style={styles.checkStopHead}>
              <Text style={[styles.checkStopName, { color: p.ink }]} numberOfLines={1}>
                {st.facility.name}
              </Text>
              <ResultBadge result={st.overall} />
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
          </View>
        </View>
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
            <Text style={[styles.presetOrder, { backgroundColor: p.accentSoft, color: p.accent }]}>
              {i + 1}
            </Text>
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
            <Text style={[styles.presetOrder, { backgroundColor: p.accentSoft, color: p.accent }]}>
              {i + 1}
            </Text>
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
          <Text style={[styles.presetOrder, { backgroundColor: p.accentSoft, color: p.accent }]}>
            {i + 1}
          </Text>
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
  const stops = course.stopIds
    .map((id) => FACILITIES.find((f) => f.facilityId === id)?.name)
    .filter(Boolean);
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
  presetBlock: { gap: 10, marginTop: 4 },
  filterLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  chips: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.xl },
  presetState: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  presetStateText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  presetCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: 10 },
  presetTitle: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3 },
  presetStop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  presetStopBlock: { gap: 3 },
  courseCheckBtn: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingVertical: 9, alignItems: 'center', marginTop: 4,
  },
  courseCheckBtnText: { fontSize: 13, fontWeight: '800' },
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
  checkAlt: { fontSize: 11.5, lineHeight: 17, fontWeight: '600' },
  stopReason: { fontSize: 11.5, lineHeight: 17, paddingLeft: 30 },
  coldStart: { fontSize: 12, lineHeight: 18 },
  presetOrder: {
    width: 20, height: 20, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: '800', overflow: 'hidden',
  },
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
