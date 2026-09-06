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
  type CourseTheme,
  type PresetCourse,
} from '@/data/types';
import { coursesApi } from '@/lib/api';
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
                    <PresetCourseCard course={preset.course} />
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
