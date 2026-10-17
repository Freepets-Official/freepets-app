import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused, useRouter, useScrollToTop } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  LinearTransition,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollOffset,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompanionMascot } from '@/components/companion/mascot';
import {
  HealthTile,
  QuestTile,
  RecentTile,
  ScheduleTile,
  SearchTile,
  StampTile,
  type HealthItem,
  type RecentRow,
} from '@/components/companion/home-tiles';
import { SpeechBubble } from '@/components/companion/speech-bubble';
import { GameCardFx } from '@/components/game-card-fx';
import { GuestScreen } from '@/components/guest-prompt';
import { PetAvatar } from '@/components/pet-avatar';
import { PetIdCard } from '@/components/pet-id-card';
import { QuestScrollIcon } from '@/components/quest-scroll-icon';
import { useTabChrome } from '@/components/tab-bar';
import { Text } from '@/components/text';
import { MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import {
  buildCompanionQueue,
  clockWord,
  nextSchedule,
  type CompanionAction,
  type DenialNews,
} from '@/data/companion';
import { FACILITIES } from '@/data/mock';
import { uniqueRegionCount } from '@/data/stamps';
import { ymd, type Pet } from '@/data/types';
import { useQuestProgress } from '@/hooks/use-daily-quests';
import { usePalette } from '@/hooks/use-theme';
import { useWalkWeather } from '@/hooks/use-walk-weather';
import { haptic } from '@/lib/haptics';
import { DENIAL_REASON_LABEL, useAppStore } from '@/store/app-store';

/** 최근 판별 타일에 보여 줄 줄 수. 이름을 알아야 하므로 시설도 이만큼만 불러온다 */
const RECENT_MAX = 4;
/** 마스코트 그림의 가로. 말풍선 꼬리가 강아지·고양이를 가리키는 위치도 이 값에서 나온다 */
const MASCOT_W = 280;
/** 첫 소식은 짧게 보여주고 날씨로 넘어간다. 그 뒤는 천천히 */
const FIRST_MS = 3800;
const NEXT_MS = 7000;
/** 사용자가 직접 넘기거나 아이를 고르면 그만큼 자동 넘김을 늦춘다 — 읽는 중에 바뀌면 안 된다 */
const HOLD_MS = 8000;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

/**
 * 홈 — 「꼬리 친구」.
 *
 * 앱 아이콘의 강아지·고양이가 지금 가장 급한 소식을 말풍선으로 알려주고(현장 거부 → 접종 →
 * 오늘 약 → …), 몇 초 뒤 오늘 산책 날씨를 말한다. 아이가 여럿이면 아이마다 가장 급한 소식을
 * 하나씩 먼저 돌린다(순서 규칙은 `data/companion.ts`). 그 아래는 눌리는 점토 타일:
 * 출입 판별 검색 · 건강 · 다음 여행(없으면 다음 일정) · 도장 · 퀘스트 · 최근 판별, 맨 아래 여권.
 *
 * 예전 홈의 여권 카드 더미는 맨 아래 「○○ 여권」으로 옮겼다. 위에서 고른 아이의 여권이 보인다.
 */
export default function HomeScreen() {
  const p = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chrome = useTabChrome();
  const reduce = useReducedMotion();
  const focused = useIsFocused();
  const {
    session,
    pets,
    checks,
    plannedDenialAlerts,
    upcomingVaccinations,
    stamps,
    facilityById,
    loadFacility,
    hideCheck,
    reloadAll,
    eventsOn,
    isMedTaken,
    toggleMedTaken,
  } = useAppStore();

  /**
   * 이력에 담긴 시설을 캐시에 채운다. 이름을 보여주려면 시설을 알아야 하는데 판별 이력에는
   * facilityId만 들어 있다.
   *
   * **한 번 시도한 시설은 다시 부르지 않는다.** 서버에 없는 시설이면 캐시가 끝내 비어 있어
   * 리렌더마다 같은 요청을 반복하게 된다 — 탭을 오갈 때마다 실패할 요청이 쌓인다.
   */
  const triedFacilities = useRef<Set<number>>(new Set());
  useEffect(() => {
    for (const c of checks.slice(0, RECENT_MAX)) {
      if (triedFacilities.current.has(c.facilityId)) continue;
      if (facilityById(c.facilityId)) continue;
      triedFacilities.current.add(c.facilityId);
      void loadFacility(c.facilityId);
    }
  }, [checks, facilityById, loadFacility]);

  // 뱃지 기준과 같은 값(서로 다른 시군구 수)을 쓴다 — 홈과 도장첩이 다른 숫자를 보이면 안 된다
  const stampCount = useMemo(() => uniqueRegionCount(stamps), [stamps]);
  const quests = useQuestProgress(session.authed);
  const weather = useWalkWeather(session.authed);
  const alerts = useMemo(() => plannedDenialAlerts(), [plannedDenialAlerts]);
  const vax = useMemo(() => upcomingVaccinations(), [upcomingVaccinations]);
  // 흩어져 있던 푸시성 알림(현장 거부·접종 기한)은 우측 상단 종 버튼 → 알림 페이지로 모았다.
  const alertCount = alerts.length + vax.length;

  // 말이 시각에 따라 달라진다("벌써 오후 7시가 지났어") — 1분마다 다시 짠다
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* ───────── 말풍선 ───────── */
  const [focusPet, setFocusPet] = useState<number | null>(null);
  // 지운 아이를 보고 있었다면 모두 보기로 돌아간다
  const focusId = focusPet !== null && pets.some((x) => x.petId === focusPet) ? focusPet : null;

  const denials = useMemo<DenialNews[]>(
    () =>
      alerts.map(({ facility, report }) => ({
        facilityId: facility.facilityId,
        facilityName: facility.name,
        reasonLabel: report.reason ? DENIAL_REASON_LABEL[report.reason] : null,
        createdAt: report.createdAt,
        petIds: [...new Set(checks.filter((c) => c.facilityId === facility.facilityId).flatMap((c) => c.petIds))],
      })),
    [alerts, checks],
  );
  const built = useMemo(
    () =>
      buildCompanionQueue(
        { now, pets, denials, vaccinations: vax, eventsOn, isMedTaken, weather: weather.state },
        focusId,
      ),
    [now, pets, denials, vax, eventsOn, isMedTaken, weather.state, focusId],
  );
  // 내용이 같으면 같은 배열을 쓴다 — 1분마다 다시 짜도 자동 넘김 타이머가 처음부터 다시 돌지 않게
  const builtKey = built.map((m) => `${m.id}:${m.text}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queue = useMemo(() => built, [builtKey]);

  const [msgId, setMsgId] = useState<string | null>(null);
  const idx = Math.max(
    0,
    queue.findIndex((m) => m.id === msgId),
  );
  const msg = queue[idx];
  const [typedId, setTypedId] = useState<string | null>(null);
  const holdUntil = useRef(0);

  // 화면 읽기 프로그램을 쓰는 중이면 저절로 넘기지 않는다 — 읽던 문장이 바뀌어 버린다(WCAG 2.2.2)
  // 웹(react-native-web)은 알아낼 방법이 없어 늘 true를 준다 — 믿으면 웹에서는 영영 안 넘어간다
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => sub.remove();
  }, []);

  // 다 써지고 나서 몇 초 뒤 다음 소식. 홈이 안 보이면 넘기지 않는다
  useEffect(() => {
    if (!focused || screenReader || !msg || typedId !== msg.id || queue.length < 2) return;
    const delay = (idx === 0 ? FIRST_MS : NEXT_MS) + Math.max(0, holdUntil.current - Date.now());
    const t = setTimeout(() => setMsgId(queue[(idx + 1) % queue.length].id), delay);
    return () => clearTimeout(t);
  }, [focused, screenReader, msg, typedId, idx, queue]);

  const next = () => {
    if (queue.length < 2) return;
    holdUntil.current = Date.now() + HOLD_MS;
    haptic.light();
    setMsgId(queue[(idx + 1) % queue.length].id);
  };
  const pickPet = (id: number | null) => {
    haptic.light();
    holdUntil.current = Date.now() + HOLD_MS / 2;
    setFocusPet((cur) => (cur === id ? null : id));
    setMsgId(null);
  };
  const runAction = (a: CompanionAction) => {
    holdUntil.current = Date.now() + HOLD_MS;
    if (a.kind === 'route') router.push(a.href);
    else if (a.kind === 'med-taken') {
      toggleMedTaken(a.eventId, a.date);
      haptic.success();
    } else void weather.enable();
  };

  // 아이마다 급한 소식이 있는지 — 아바타의 빨간 점
  const urgentPets = useMemo(() => {
    const all = buildCompanionQueue(
      { now, pets, denials, vaccinations: vax, eventsOn, isMedTaken, weather: { status: 'loading' } },
      null,
    );
    return new Set(all.filter((m) => m.priority <= 1).flatMap((m) => m.petIds));
  }, [now, pets, denials, vax, eventsOn, isMedTaken]);

  /* ───────── 타일 ───────── */
  const scoped = focusId === null ? pets : pets.filter((x) => x.petId === focusId);
  const today = ymd(now);
  const health = useMemo<HealthItem | null>(() => {
    const ids = new Set(scoped.map((x) => x.petId));
    const v = vax.find((x) => ids.has(x.pet.petId));
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const med = eventsOn(today).find(
      (e) => e.type === 'MED' && !isMedTaken(e.eventId, today) && (e.petId === null || ids.has(e.petId)),
    );
    const vaxItem: HealthItem | null = v
      ? {
          kind: 'vaccine',
          label: v.dday < 0 ? '접종 지남' : v.dday === 0 ? '오늘 접종' : '다음 접종',
          big: v.dday < 0 ? `D+${-v.dday}` : v.dday === 0 ? '오늘' : `D-${v.dday}`,
          sub: `${v.pet.name} · ${Number(v.date.slice(5, 7))}.${Number(v.date.slice(8, 10))}`,
          urgent: v.dday <= 0,
        }
      : null;
    const medItem: HealthItem | null = med
      ? {
          kind: 'med',
          label: '오늘 약',
          big: '오늘',
          sub: [
            med.petId !== null ? pets.find((x) => x.petId === med.petId)?.name : null,
            med.title,
            med.time ? clockWord(med.time) : null,
          ]
            .filter(Boolean)
            .join(' · '),
          urgent: !!med.time && med.time <= hhmm,
        }
      : null;
    // 기한 지난 접종이 가장 급하고, 그다음 오늘 약, 그다음 다가오는 접종
    if (vaxItem?.urgent) return vaxItem;
    return medItem ?? vaxItem;
  }, [scoped, vax, eventsOn, isMedTaken, today, now, pets]);
  // 아이를 골랐으면 그 아이 일정과 모두의 일정(여행 등)만 — 다른 아이 약이 뜨면 헷갈린다
  const schedule = useMemo(
    () =>
      nextSchedule(
        focusId === null ? eventsOn : (d) => eventsOn(d).filter((e) => e.petId === null || e.petId === focusId),
        now,
      ),
    [eventsOn, now, focusId],
  );
  const scheduleOwner = schedule?.event.petId != null ? pets.find((x) => x.petId === schedule.event.petId)?.name ?? null : null;

  const recentRows = useMemo<RecentRow[]>(
    () =>
      checks.slice(0, RECENT_MAX).map((c) => {
        // 스토어 캐시를 먼저 본다. 목 데이터에만 기대면 관광공사에서 온 실제 시설이
        // 전부 "알 수 없는 시설"로 뜬다 — 판별 이력은 대부분 그쪽이다.
        const facility = facilityById(c.facilityId) ?? FACILITIES.find((f) => f.facilityId === c.facilityId);
        // petIds를 쓴다 — 서버에서 불러온 이력엔 verdicts가 없어서 이름이 통째로 비어버린다
        const names = c.petIds.map((id) => pets.find((x) => x.petId === id)?.name).filter(Boolean);
        return {
          checkId: c.checkId,
          facilityId: c.facilityId,
          name: facility?.name ?? '알 수 없는 시설',
          meta: `${names.join(' · ')} · ${formatDate(c.createdAt)}`,
          result: c.overall,
        };
      }),
    [checks, facilityById, pets],
  );
  const passportPet: Pet | undefined = scoped[0];

  /* ───────── 스크롤 ───────── */
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  useScrollToTop(scrollRef as unknown as RefObject<ScrollView>);
  const offset = useScrollOffset(scrollRef);
  // 스크롤하면 친구들이 살짝 작아지며 뒤로 물러나고, 머리에는 바탕이 깔린다
  const heroStyle = useAnimatedStyle(() => {
    if (reduce) return {};
    const y = Math.max(0, offset.value);
    return {
      opacity: interpolate(y, [0, 260], [1, 0.45], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(y, [0, 260], [0, 38], Extrapolation.CLAMP) },
        { scale: interpolate(y, [0, 260], [1, 0.9], Extrapolation.CLAMP) },
      ],
    };
  });
  const headBg = useAnimatedStyle(() => ({ opacity: interpolate(offset.value, [0, 14], [0, 1], Extrapolation.CLAMP) }));
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    // 실제로 다시 불러온다. 최초 조회가 실패하면 여기가 빠져나올 길이다
    await reloadAll().finally(() => setRefreshing(false));
  };

  if (!session.authed) {
    return (
      <GuestScreen
        eyebrow="반갑꼬리"
        title="홈"
        body="내 아이 기준 판별 이력, 다음 접종, 좋아한 곳이 여기에 모여요. 탐색 탭은 로그인 없이도 볼 수 있어요."
      />
    );
  }

  const tailX = msg?.speaker === 'cat' ? (184 / 270) * MASCOT_W + 6 : (90 / 270) * MASCOT_W;
  const headerH = insets.top + 62;

  return (
    <View style={[styles.root, { backgroundColor: p.surface }]}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={() => chrome?.onScroll()}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: headerH + 8 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.accent} colors={[p.accent]} progressViewOffset={headerH} />
        }>
        <View style={styles.inner}>
          <Animated.View style={heroStyle}>
            {msg ? (
              <SpeechBubble
                message={msg}
                pets={pets}
                index={idx}
                total={queue.length}
                tailX={tailX}
                reduce={reduce}
                onNext={next}
                onAction={runAction}
                onTyped={() => setTypedId(msg.id)}
              />
            ) : null}
            <View style={styles.mascot}>
              <CompanionMascot
                width={MASCOT_W}
                speaker={msg?.speaker ?? 'dog'}
                mood={msg?.mood ?? 'idle'}
                props={msg?.props}
                cue={msg?.id ?? ''}
                active={focused}
              />
            </View>
          </Animated.View>

          <View style={styles.bento}>
            <SearchTile order={0} active={focused} />
            <View style={styles.pair}>
              <HealthTile order={1} item={health} />
              <ScheduleTile order={2} next={schedule} petName={scheduleOwner} />
            </View>
            <View style={styles.pair}>
              <StampTile order={3} count={stampCount} />
              <QuestTile order={4} progress={quests} />
            </View>
            <RecentTile
              order={5}
              rows={recentRows}
              total={checks.length}
              onOpen={(id) => router.push({ pathname: '/facility/[id]', params: { id: String(id) } })}
              onHide={hideCheck}
            />
          </View>

          {passportPet ? (
            <View style={styles.passport}>
              <View style={styles.passHead}>
                <Text style={[styles.passTitle, { color: p.ink }]}>{passportPet.name} 여권</Text>
                {pets.length > 1 ? (
                  <Text style={[styles.passHint, { color: p.muted }]}>위에서 아이를 고르면 바뀌어요</Text>
                ) : null}
              </View>
              <View style={styles.card}>
                <PetIdCard pet={passportPet} />
                <GameCardFx />
              </View>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* 머리 — 아이 고르기 · 퀘스트 · 알림. 스크롤하면 바탕이 깔린다 */}
      <View style={[styles.header, { paddingTop: insets.top + 8, height: headerH }]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.headBg, { backgroundColor: p.surface, borderBottomColor: p.line }, headBg]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pets} style={styles.petsScroll}>
          {pets.length > 1 ? (
            <PetChip label="모두" selected={focusId === null} onPress={() => pickPet(null)} />
          ) : null}
          {pets.map((pet) => (
            <PetChip
              key={pet.petId}
              pet={pet}
              label={pet.name}
              selected={pets.length === 1 || focusId === pet.petId}
              urgent={urgentPets.has(pet.petId)}
              onPress={pets.length > 1 ? () => pickPet(pet.petId) : undefined}
            />
          ))}
          {pets.length === 0 ? (
            <Text style={[styles.hello, { color: p.ink }]}>반가워요</Text>
          ) : null}
        </ScrollView>
        <View style={styles.headerActions}>
          {/* 퀘스트(두루마리)와 알림(종)을 나란히 — 둘 다 "지금 할 일"을 여는 입구다 */}
          <HeaderButton
            onPress={() => router.push('/quests')}
            label={quests === null ? '오늘의 퀘스트' : `오늘의 퀘스트, ${quests.left}개 남음`}
            badge={quests && quests.left > 0 ? quests.left : 0}>
            <QuestScrollIcon size={21} color={p.ink} />
          </HeaderButton>
          <HeaderButton
            onPress={() => router.push('/notifications')}
            label={alertCount > 0 ? `알림 ${alertCount}개` : '알림'}
            badge={alertCount}
            urgent={alerts.length > 0}>
            <Ionicons name="notifications-outline" size={22} color={p.ink} />
          </HeaderButton>
        </View>
      </View>
    </View>
  );
}

function PetChip({
  pet,
  label,
  selected,
  urgent,
  onPress,
}: {
  pet?: Pet;
  label: string;
  selected: boolean;
  urgent?: boolean;
  onPress?: () => void;
}) {
  const p = usePalette();
  return (
    <Animated.View layout={LinearTransition.duration(220)}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}${urgent ? ', 급한 소식 있음' : ''}`}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: selected ? p.accentSoft : p.card,
            borderColor: selected ? 'transparent' : p.line,
            paddingRight: selected ? 13 : 3,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}>
        {pet ? (
          <PetAvatar pet={pet} size={34} />
        ) : (
          <View style={[styles.allAvatar, { backgroundColor: p.accentSoft }]}>
            <Ionicons name="paw" size={17} color={p.accentDark} />
          </View>
        )}
        {selected ? <Text style={[styles.chipText, { color: p.accentDark }]}>{label}</Text> : null}
        {urgent ? <View style={[styles.urgentDot, { backgroundColor: p.dangerSolid, borderColor: p.surface }]} /> : null}
      </Pressable>
    </Animated.View>
  );
}

function HeaderButton({
  children,
  onPress,
  label,
  badge,
  urgent,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  badge: number;
  urgent?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.headerBtn,
        { borderColor: p.line, backgroundColor: p.card, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}>
      {children}
      {badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: urgent ? p.dangerSolid : p.accent, borderColor: p.surface }]}>
          <Text style={[styles.badgeText, { color: p.onAccent }]}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 140 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  mascot: { marginTop: 8, marginLeft: -4 },
  bento: { gap: 12, marginTop: 6 },
  pair: { flexDirection: 'row', gap: 12 },
  passport: { marginTop: 26, gap: 10 },
  passHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 2 },
  passTitle: { fontSize: Type.sectionTitle - 2, fontWeight: '800', letterSpacing: -0.4 },
  passHint: { fontSize: Type.caption },
  // 여권은 종이 질감이라 테마와 상관없이 같은 색이다(`pet-id-card.tsx`의 `CARD`)
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(120,101,66,0.32)',
    backgroundColor: '#F6F0E2',
    overflow: 'hidden',
    shadowColor: '#3A332A',
    shadowOpacity: 0.14,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 10,
  },
  headBg: { borderBottomWidth: StyleSheet.hairlineWidth, opacity: 0.96 },
  petsScroll: { flexGrow: 1, flexShrink: 1 },
  pets: { gap: 6, alignItems: 'center', paddingVertical: 4, paddingRight: 4 },
  hello: { fontSize: Type.headline, fontWeight: '800', letterSpacing: -0.5 },
  chip: {
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 3,
  },
  allAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: Type.bodyLg - 0.5, fontWeight: '800' },
  urgentDot: { position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: Type.micro, fontWeight: '900' },
});
