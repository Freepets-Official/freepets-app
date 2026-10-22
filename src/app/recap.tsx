import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompanionMascot } from '@/components/companion/mascot';
import { AnimatedText, Text } from '@/components/text';
import { LevelUpFonts, Radius, Type } from '@/constants/theme';
import { hasBatchim, type WeatherProp } from '@/data/companion';
import type { Recap } from '@/data/recap';
import { NEXT_SEASON, SEASON_LABEL, daysInclusive, type Season, type SeasonSpan } from '@/data/seasons';
import { useQuestJourney } from '@/hooks/use-quest-journey';
import { recapTitle, useRecapDetail, useRecaps } from '@/hooks/use-season-recap';
import { copyText } from '@/lib/clipboard';
import { haptic } from '@/lib/haptics';
import { notify } from '@/lib/notify';
import { useAppStore } from '@/store/app-store';

/**
 * 계절 리캡 — 인스타 스토리처럼 한 장씩 넘겨 본다.
 *
 * 오른쪽을 누르면 다음, 왼쪽은 이전, 꾹 누르면 멈춘다. 한 장은 5.5초 뒤 저절로 넘어간다.
 * 계절마다 색과 떨어지는 것(꽃잎·반짝임·낙엽·눈)이 다르다 — 화면은 테마와 상관없이 계절 색이다.
 */
const PAGE_MS = 5500;

const LOOK: Record<Season, { bg: [string, string, string]; ink: string; sub: string; accent: string; card: string; drop: string; props: WeatherProp[] }> = {
  SPRING: { bg: ['#FFE1EA', '#FFEFF0', '#FFF6E8'], ink: '#4A2A35', sub: '#8A5A68', accent: '#E0698A', card: 'rgba(255,255,255,0.72)', drop: 'flower', props: ['sparkles'] },
  SUMMER: { bg: ['#CDEFF2', '#E6F7F2', '#FFF6D4'], ink: '#1E3940', sub: '#4E727A', accent: '#1F9AAD', card: 'rgba(255,255,255,0.7)', drop: 'sparkles', props: ['heat'] },
  AUTUMN: { bg: ['#FFD9BF', '#FFE9D6', '#FFF5E8'], ink: '#4A2A17', sub: '#86593C', accent: '#C9622E', card: 'rgba(255,255,255,0.7)', drop: 'leaf', props: [] },
  WINTER: { bg: ['#DCE6FF', '#ECEBFF', '#F7F4FF'], ink: '#24304A', sub: '#56638A', accent: '#4F6FCC', card: 'rgba(255,255,255,0.72)', drop: 'snow', props: ['scarf'] },
};

type Page = { key: string; node: ReactNode };

export default function RecapScreen() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { span, live, recap, ready } = useRecapDetail(id);
  const { markSeen } = useRecaps();
  const { pets, facilityById, loadFacility, session } = useAppStore();
  const journey = useQuestJourney(session.authed);

  // 끝난 계절 리캡을 열면 "봤다"로 남긴다 — 홈 말풍선이 같은 리캡을 계속 권하지 않게
  useEffect(() => {
    if (span && !live && recap) markSeen(id);
  }, [span, live, recap, id, markSeen]);

  // 자주 간 곳 이름이 도장에 없으면 시설 정보를 받아 온다
  const topId = recap?.topPlace && !recap.topPlace.name ? recap.topPlace.facilityId : null;
  useEffect(() => {
    if (topId != null && !facilityById(topId)) void loadFacility(topId);
  }, [topId, facilityById, loadFacility]);

  const names = pets.map((p) => p.name);
  const who = names.length === 0 ? '우리' : names.length <= 2 ? names.join('·') : `${names[0]}${hasBatchim(names[0]) ? '과' : '와'} 친구들`;

  const pages = useMemo<Page[]>(() => {
    if (!span || !recap) return [];
    const look = LOOK[span.season];
    const out: Page[] = [
      { key: 'cover', node: <Cover span={span} live={live} who={who} look={look} width={width} outfit={journey.journey.outfit} /> },
    ];
    const nums = [
      { label: '판별', value: recap.checks, unit: '번', icon: 'shield-checkmark' },
      { label: '같이 들어간 곳', value: recap.allowedPlaces, unit: '곳', icon: 'paw' },
      { label: '여권 도장', value: recap.stamps, unit: '개', icon: 'ribbon' },
      { label: '여행', value: recap.travelDays, unit: '일', icon: 'airplane' },
      { label: '하루 기록', value: recap.diaryDays, unit: '일', icon: 'book' },
    ].filter((n) => n.value > 0);
    if (nums.length) out.push({ key: 'nums', node: <Numbers nums={nums} look={look} season={span.season} /> });
    if (recap.regions.length) out.push({ key: 'regions', node: <Regions recap={recap} look={look} /> });
    if (recap.photos.length) out.push({ key: 'photos', node: <Photos recap={recap} look={look} width={width} /> });
    if (recap.topPlace) {
      const name = recap.topPlace.name ?? facilityById(recap.topPlace.facilityId)?.name ?? '자주 찾은 곳';
      out.push({ key: 'top', node: <TopPlace name={name} count={recap.topPlace.count} look={look} /> });
    }
    out.push({
      key: 'outro',
      node: <Outro span={span} live={live} recap={recap} who={who} look={look} onExplore={() => router.replace('/(tabs)/explore')} />,
    });
    return out;
  }, [span, recap, live, who, width, journey.journey.outfit, facilityById, router]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const page = Math.min(index, Math.max(0, pages.length - 1));
  const last = page >= pages.length - 1;

  // 한 장씩 저절로 넘긴다(마지막 장에서 멈춘다)
  useEffect(() => {
    if (paused || last || pages.length === 0) return;
    const t = setTimeout(() => setIndex((i) => i + 1), PAGE_MS);
    return () => clearTimeout(t);
  }, [page, paused, last, pages.length]);

  const go = (d: 1 | -1) => {
    haptic.light();
    setIndex((i) => Math.max(0, Math.min(pages.length - 1, i + d)));
  };

  if (!span) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: '#FFF6EF' }]}>
        <Text style={styles.missing}>리캡을 찾지 못했어요.</Text>
        <Pressable onPress={() => router.back()} style={styles.missingBtn} accessibilityRole="button">
          <Text style={styles.missingBtnText}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }
  const look = LOOK[span.season];

  return (
    <View style={styles.fill}>
      <LinearGradient colors={look.bg} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} />
      {!reduce ? <Drops icon={look.drop} color={look.accent} /> : null}

      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        {/* 진행 막대 + 닫기 */}
        <View style={styles.top}>
          <View style={styles.bars}>
            {pages.map((p, i) => (
              <Bar key={p.key} state={i < page || (last && i === page) ? 'done' : i === page ? 'now' : 'todo'} paused={paused} color={look.ink} />
            ))}
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="닫기" style={styles.close}>
            <Ionicons name="close" size={24} color={look.ink} />
          </Pressable>
        </View>

        {/* 왼쪽 30% 이전 · 나머지 다음 · 꾹 누르면 멈춤 */}
        <View style={styles.fill}>
          {!ready && !recap ? (
            <View style={[styles.fill, styles.center]}>
              <Text style={[styles.loading, { color: look.sub }]}>{SEASON_LABEL[span.season]}을 모으는 중…</Text>
            </View>
          ) : (
            <Animated.View key={pages[page]?.key} entering={reduce ? undefined : FadeIn.duration(260)} style={styles.fill}>
              {pages[page]?.node}
            </Animated.View>
          )}
          {!last ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View style={styles.zones} pointerEvents="box-none">
                <Pressable
                  style={styles.zoneL}
                  onPress={() => go(-1)}
                  onLongPress={() => setPaused(true)}
                  onPressOut={() => setPaused(false)}
                  accessibilityRole="button"
                  accessibilityLabel="이전"
                />
                <Pressable
                  style={styles.zoneR}
                  onPress={() => go(1)}
                  onLongPress={() => setPaused(true)}
                  onPressOut={() => setPaused(false)}
                  accessibilityRole="button"
                  accessibilityLabel="다음"
                />
              </View>
            </View>
          ) : page > 0 ? (
            <Pressable onPress={() => go(-1)} style={styles.backChip} accessibilityRole="button" accessibilityLabel="이전 장">
              <Ionicons name="chevron-back" size={16} color={look.sub} />
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ───────── 장들 ───────── */

type Look = (typeof LOOK)[Season];

const md = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;

function Cover({ span, live, who, look, width, outfit }: { span: SeasonSpan; live: boolean; who: string; look: Look; width: number; outfit: ReturnType<typeof useQuestJourney>['journey']['outfit'] }) {
  const end = span.endsOn;
  const days = end ? daysInclusive(span.startsOn, end) : null;
  return (
    <View style={[styles.page, styles.center]}>
      <AnimatedText entering={FadeInDown.delay(80).duration(380)} style={[styles.eyebrow, { color: look.accent }]}>
        {recapTitle(span)} 리캡{live ? ' · 미리 보기' : ''}
      </AnimatedText>
      <AnimatedText entering={FadeInDown.delay(180).duration(420)} style={[styles.hero, { color: look.ink }]}>
        {who}의 {SEASON_LABEL[span.season]}
      </AnimatedText>
      <AnimatedText entering={FadeInDown.delay(280).duration(420)} style={[styles.sub, { color: look.sub }]}>
        {md(span.startsOn)} ~ {end ? `${md(end)} · ${days}일` : '오늘 · 아직 진행 중'}
      </AnimatedText>
      <Animated.View entering={ZoomIn.delay(360).springify().damping(13)} style={styles.coverMascot}>
        <CompanionMascot width={Math.min(320, width - 48)} speaker="dog" mood="happy" props={look.props} cue={`recap-${span.season}`} active outfit={outfit} />
      </Animated.View>
      <Text style={[styles.hint, { color: look.sub }]}>오른쪽을 눌러 넘겨 보세요</Text>
    </View>
  );
}

function Numbers({ nums, look, season }: { nums: { label: string; value: number; unit: string; icon: string }[]; look: Look; season: Season }) {
  return (
    <View style={styles.page}>
      <AnimatedText entering={FadeInDown.duration(380)} style={[styles.title, { color: look.ink }]}>
        이번 {SEASON_LABEL[season]}, 우리는
      </AnimatedText>
      <View style={styles.numList}>
        {nums.map((n, i) => (
          <Animated.View
            key={n.label}
            entering={FadeInDown.delay(160 + i * 140).springify().damping(15)}
            style={[styles.numCard, { backgroundColor: look.card }]}>
            <View style={[styles.numIcon, { backgroundColor: look.accent }]}>
              <Ionicons name={n.icon as never} size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.numLabel, { color: look.sub }]}>{n.label}</Text>
            <View style={styles.numValueRow}>
              <CountUp to={n.value} delay={260 + i * 140} style={[styles.numValue, { color: look.ink }]} />
              <Text style={[styles.numUnit, { color: look.ink }]}>{n.unit}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function Regions({ recap, look }: { recap: Recap; look: Look }) {
  return (
    <View style={styles.page}>
      <AnimatedText entering={FadeInDown.duration(380)} style={[styles.title, { color: look.ink }]}>
        다녀온 곳
      </AnimatedText>
      {recap.firstRegion ? (
        <Animated.View entering={ZoomIn.delay(180).springify().damping(12)} style={[styles.firstCard, { backgroundColor: look.accent }]}>
          <Text style={styles.firstLabel}>처음 가 본 곳</Text>
          <Text style={styles.firstName}>{recap.firstRegion}</Text>
        </Animated.View>
      ) : null}
      <View style={styles.chips}>
        {recap.regions.map((r, i) => (
          <Animated.View key={r} entering={ZoomIn.delay(320 + i * 90).springify().damping(13)} style={[styles.chip, { backgroundColor: look.card }]}>
            <Ionicons name="location" size={13} color={look.accent} />
            <Text style={[styles.chipText, { color: look.ink }]}>{r}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const TILT = [-4, 3, -2, 4, -3, 2, -1.5, 3.5, -2.5];

function Photos({ recap, look, width }: { recap: Recap; look: Look; width: number }) {
  const n = recap.photos.length;
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
  const size = Math.min(150, (Math.min(width, 520) - 48 - (cols - 1) * 12) / cols);
  return (
    <View style={styles.page}>
      <AnimatedText entering={FadeInDown.duration(380)} style={[styles.title, { color: look.ink }]}>
        남겨 둔 순간들
      </AnimatedText>
      <View style={[styles.collage, { width: cols * size + (cols - 1) * 12 }]}>
        {recap.photos.map((p, i) => (
          <Animated.View
            key={`${p.date}-${i}`}
            entering={ZoomIn.delay(140 + i * 110).springify().damping(12)}
            style={[styles.polaroid, { width: size, transform: [{ rotate: `${TILT[i % TILT.length]}deg` }] }]}>
            <Image source={{ uri: p.uri }} style={{ width: size - 12, height: size - 12, borderRadius: 6 }} contentFit="cover" />
            <Text style={styles.polaroidDate}>{md(p.date)}</Text>
          </Animated.View>
        ))}
      </View>
      {recap.bestDay ? (
        <Animated.View entering={FadeIn.delay(400 + n * 110).duration(400)} style={[styles.quote, { backgroundColor: look.card }]}>
          <Text style={[styles.quoteText, { color: look.ink }]} numberOfLines={3}>
            “{recap.bestDay.note}”
          </Text>
          <Text style={[styles.quoteDate, { color: look.sub }]}>{md(recap.bestDay.date)}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function TopPlace({ name, count, look }: { name: string; count: number; look: Look }) {
  return (
    <View style={[styles.page, styles.center]}>
      <AnimatedText entering={FadeInDown.duration(380)} style={[styles.title, { color: look.ink, textAlign: 'center' }]}>
        제일 자주 찾은 곳
      </AnimatedText>
      <Animated.View entering={ZoomIn.delay(200).springify().damping(11)} style={[styles.topCard, { backgroundColor: look.card }]}>
        <View style={[styles.topBadge, { backgroundColor: look.accent }]}>
          <Ionicons name="heart" size={22} color="#FFFFFF" />
        </View>
        <Text style={[styles.topName, { color: look.ink }]}>{name}</Text>
        <Text style={[styles.topCount, { color: look.sub }]}>판별·도장 {count}번</Text>
      </Animated.View>
    </View>
  );
}

function Outro({ span, live, recap, who, look, onExplore }: { span: SeasonSpan; live: boolean; recap: Recap; who: string; look: Look; onExplore: () => void }) {
  const next = SEASON_LABEL[NEXT_SEASON[span.season]];
  const season = SEASON_LABEL[span.season];
  const headline = live
    ? `${season}이 끝나면\n리캡이 완성돼요`
    : recap.size === 'LIGHT'
      ? `조용한 ${season}이었어요.\n다음 ${next}엔 더 많이 다니자!`
      : `다음 ${next}엔\n어디 갈까?`;
  const share = async () => {
    haptic.light();
    const parts = [
      recap.checks ? `판별 ${recap.checks}번` : null,
      recap.allowedPlaces ? `같이 들어간 곳 ${recap.allowedPlaces}곳` : null,
      recap.stamps ? `도장 ${recap.stamps}개` : null,
      recap.regions.length ? `${recap.regions.length}개 지역` : null,
    ].filter(Boolean);
    const message = `${who}의 ${recapTitle(span)} 🐾\n${parts.join(' · ')}\n반갑꼬리로 같이 갈 수 있는 곳 찾기 → https://freepets-app.vercel.app`;
    try {
      await Share.share({ message });
    } catch {
      // 웹에서 공유 시트가 없으면 복사해 둔다 — 아무 일도 안 일어나는 버튼이 되면 안 된다
      const ok = await copyText(message);
      notify(ok ? '복사했어요' : '공유하지 못했어요', ok ? '원하는 곳에 붙여 넣어 공유해 주세요.' : '이 브라우저는 공유를 지원하지 않아요.');
    }
  };
  return (
    <View style={[styles.page, styles.center]}>
      <AnimatedText entering={FadeInDown.duration(420)} style={[styles.outro, { color: look.ink }]}>
        {headline}
      </AnimatedText>
      <View style={styles.outroBtns}>
        {!live ? (
          <Animated.View entering={FadeInDown.delay(220).duration(360)}>
            <Pressable onPress={share} accessibilityRole="button" style={({ pressed }) => [styles.primary, { backgroundColor: look.accent, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              <Ionicons name="share-social" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>리캡 공유하기</Text>
            </Pressable>
          </Animated.View>
        ) : null}
        <Animated.View entering={FadeInDown.delay(320).duration(360)}>
          <Pressable onPress={onExplore} accessibilityRole="button" style={({ pressed }) => [styles.secondary, { backgroundColor: look.card, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Ionicons name="compass" size={18} color={look.ink} />
            <Text style={[styles.secondaryText, { color: look.ink }]}>같이 갈 곳 찾아보기</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

/* ───────── 작은 조각 ───────── */

/** 숫자가 0부터 차오른다 */
function CountUp({ to, delay, style }: { to: number; delay: number; style: object }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (reduce) return;
    const start = Date.now() + delay;
    const dur = Math.min(900, 300 + to * 40);
    const tick = () => {
      const t = Math.max(0, Math.min(1, (Date.now() - start) / dur));
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [to, delay, reduce]);
  return <Text style={style}>{reduce ? to : n}</Text>;
}

function Bar({ state, paused, color }: { state: 'done' | 'now' | 'todo'; paused: boolean; color: string }) {
  const p = useSharedValue(state === 'done' ? 1 : 0);
  useEffect(() => {
    if (state === 'now' && !paused) p.set(withTiming(1, { duration: PAGE_MS * (1 - p.get()), easing: Easing.linear }));
    else if (state === 'now') cancelAnimation(p);
    else p.set(state === 'done' ? 1 : 0);
  }, [state, paused, p]);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={[styles.bar, { backgroundColor: `${color}26` }]}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, fill]} />
    </View>
  );
}

/** 계절마다 떨어지는 것 — 꽃잎·반짝임·낙엽·눈 */
function Drops({ icon, color }: { icon: string; color: string }) {
  const { width, height } = useWindowDimensions();
  const items = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        x: ((i * 37) % 100) / 100,
        size: 12 + ((i * 7) % 10),
        dur: 7000 + ((i * 1300) % 5000),
        delay: (i * 900) % 6000,
        spin: i % 2 ? 1 : -1,
      })),
    [],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((it, i) => (
        <Drop key={i} {...it} icon={icon} color={color} w={width} h={height} />
      ))}
    </View>
  );
}

function Drop({ x, size, dur, delay, spin, icon, color, w, h }: { x: number; size: number; dur: number; delay: number; spin: number; icon: string; color: string; w: number; h: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false)));
    return () => cancelAnimation(t);
  }, [t, delay, dur]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 0.35,
    transform: [
      { translateX: x * w + Math.sin(t.value * Math.PI * 4) * 18 },
      { translateY: -40 + t.value * (h + 80) },
      { rotate: `${spin * t.value * 360}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.drop, style]}>
      <Ionicons name={icon as never} size={size} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 8, zIndex: 3 },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  zones: { flex: 1, flexDirection: 'row' },
  zoneL: { width: '30%', height: '100%' },
  zoneR: { flex: 1, height: '100%' },
  backChip: { position: 'absolute', left: 16, bottom: 16, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  // 내용이 적은 장도 화면 가운데에 모이게 — 위에만 붙으면 아래가 텅 빈 장이 된다
  page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 56, gap: 18 },
  eyebrow: { fontSize: Type.footnote, fontWeight: '800', letterSpacing: 0.6, textAlign: 'center' },
  hero: { fontFamily: LevelUpFonts.ko, fontSize: 42, lineHeight: 50, textAlign: 'center' },
  sub: { fontSize: Type.callout, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  coverMascot: { marginTop: 8 },
  hint: { fontSize: Type.caption, fontWeight: '700', marginTop: 8 },
  loading: { fontSize: Type.callout, fontWeight: '700' },
  title: { fontFamily: LevelUpFonts.ko, fontSize: 32, lineHeight: 40 },
  numList: { gap: 12 },
  numCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 14 },
  numIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numLabel: { flex: 1, fontSize: Type.callout, fontWeight: '800' },
  numValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  numValue: { fontFamily: LevelUpFonts.latin, fontSize: 34, lineHeight: 40, fontVariant: ['tabular-nums'] },
  numUnit: { fontSize: Type.callout, fontWeight: '800' },
  firstCard: { borderRadius: Radius.xl, paddingHorizontal: 20, paddingVertical: 18, gap: 4, transform: [{ rotate: '-1.5deg' }] },
  firstLabel: { color: 'rgba(255,255,255,0.85)', fontSize: Type.footnote, fontWeight: '800' },
  firstName: { color: '#FFFFFF', fontFamily: LevelUpFonts.ko, fontSize: 30, lineHeight: 36 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: Type.body, fontWeight: '800' },
  collage: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignSelf: 'center' },
  polaroid: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 6, paddingBottom: 4, alignItems: 'center', gap: 2, boxShadow: '0 10px 18px -10px rgba(60,35,20,0.45)' },
  polaroidDate: { fontSize: Type.micro, fontWeight: '800', color: '#7A6A60' },
  quote: { borderRadius: Radius.lg, padding: 16, gap: 4 },
  quoteText: { fontSize: Type.callout, fontWeight: '700', lineHeight: 22 },
  quoteDate: { fontSize: Type.caption, fontWeight: '700' },
  topCard: { alignItems: 'center', gap: 8, borderRadius: Radius.xl, paddingHorizontal: 24, paddingVertical: 28, minWidth: 240 },
  topBadge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  topName: { fontFamily: LevelUpFonts.ko, fontSize: 28, lineHeight: 34, textAlign: 'center' },
  topCount: { fontSize: Type.callout, fontWeight: '700' },
  outro: { fontFamily: LevelUpFonts.ko, fontSize: 34, lineHeight: 44, textAlign: 'center' },
  outroBtns: { gap: 10, alignItems: 'stretch', width: 260, marginTop: 12 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.full, paddingVertical: 15 },
  primaryText: { color: '#FFFFFF', fontSize: Type.callout, fontWeight: '800' },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.full, paddingVertical: 15 },
  secondaryText: { fontSize: Type.callout, fontWeight: '800' },
  drop: { position: 'absolute', top: 0, left: 0 },
  missing: { fontSize: Type.callout, fontWeight: '700', color: '#2D2622' },
  missingBtn: { marginTop: 12, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#DB7850' },
  missingBtnText: { color: '#FFFFFF', fontWeight: '800' },
});
