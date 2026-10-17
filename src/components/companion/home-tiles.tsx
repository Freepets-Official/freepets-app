import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
  type WithTimingConfig,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ResultBadge } from '@/components/badge';
import { TiltPressable } from '@/components/motion/tilt-pressable';
import { PawBurst } from '@/components/paw-burst';
import { Text } from '@/components/text';
import { ClayShadow, Radius, Spacing, Type } from '@/constants/theme';
import { clockWord, type NextSchedule } from '@/data/companion';
import { CAL_EVENT_META, CATEGORY_LABEL, type Category, type CheckResult } from '@/data/types';
import { useColorScheme, usePalette } from '@/hooks/use-theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const SLAM = Easing.bezier(0.2, 0.8, 0.2, 1);

/**
 * 눌리는 점토 타일. 누르면 0.96으로 들어가고(120ms), 놓으면 ease-out으로 돌아온다.
 * 첫 등장은 아래에서 살짝 올라오며 차례로(50ms 간격) — 탭을 오갈 때는 화면이 살아 있어
 * 다시 재생되지 않는다. 자주 보는 화면이라 등장 연출은 그 한 번이면 충분하다.
 */
function Tile({
  children,
  onPress,
  order,
  style,
  label,
  tint,
}: {
  children: ReactNode;
  onPress?: () => void;
  order: number;
  style?: StyleProp<ViewStyle>;
  label?: string;
  /** 바탕색을 바꿀 때(급한 건강 일정은 옅은 빨강) */
  tint?: string;
}) {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const surface = { backgroundColor: tint ?? p.card };
  return (
    <Animated.View entering={FadeInDown.delay(80 + order * 50).duration(300).easing(EASE_OUT)} style={style}>
      {onPress ? (
        // 누른 자리 쪽으로 3D로 눌려 들어간다(점토를 누르는 손맛). 눌린 동안 바닥 그림자가 줄어든다
        <TiltPressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          containerStyle={styles.grow}
          style={(pressed) => [styles.tile, surface, { boxShadow: pressed ? clay.pressed : clay.rest }]}>
          {children}
        </TiltPressable>
      ) : (
        // 안에 따로 누르는 것이 있는 타일은 통째로 버튼이면 안 된다(웹에서 버튼 속 버튼)
        <View style={[styles.tile, surface, { boxShadow: clay.rest }]}>{children}</View>
      )}
    </Animated.View>
  );
}

/**
 * 타일마다 **한 번만** 재생하는 작은 동작. 등장이 끝날 즈음(타일 순서만큼 늦게) 시작한다.
 * 계속 움직이면 홈이 산만해진다 — 뜻이 있는 순간에 한 번(도장 쾅, 비행기 착륙, 두근)만.
 */
function useOnce(
  order: number,
  enabled: boolean,
  duration: number,
  easing: WithTimingConfig['easing'] = EASE_OUT,
): SharedValue<number> {
  const reduce = useReducedMotion();
  // 0 → 1. 동작 줄이기면 처음부터 끝 상태(1)
  const v = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!enabled || reduce) {
      v.set(1);
      return;
    }
    v.set(withDelay(380 + order * 50, withTiming(1, { duration, easing })));
  }, [enabled, reduce, order, duration, easing, v]);
  return v;
}

function TileKey({
  icon,
  label,
  color,
  iconStyle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  iconStyle?: ComponentProps<typeof Animated.View>['style'];
}) {
  const p = usePalette();
  return (
    <View style={styles.key}>
      <Animated.View style={iconStyle}>
        <Ionicons name={icon} size={15} color={color ?? p.muted} />
      </Animated.View>
      <Text style={[styles.keyText, { color: color ?? p.muted }]}>{label}</Text>
    </View>
  );
}

/* ───────── 어디 갈까요? ───────── */

const EXAMPLES = ['강릉 안목해변', '애견 동반 카페', '제주 숙소', '한옥 마을'];

/**
 * 탐색 탭은 살아 있는 화면이라 같은 값으로 다시 보내면 반응하지 않는다 — 보낼 때마다 다른 표식.
 * 시각을 섞는다: 웹은 새로고침하면 카운터가 1로 돌아가 주소에 남은 옛 값과 겹칠 수 있다.
 */
let nonce = 0;
const nextNonce = () => `${Date.now()}-${++nonce}`;
const QUICK: Category[] = ['CAFE', 'TOUR', 'STAY', 'RESTAURANT'];

export function SearchTile({ order, active }: { order: number; active: boolean }) {
  const p = usePalette();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    // 검색 예시를 천천히 돌려 "무엇을 넣으면 되는지" 보여준다. 글자 단위로 치면 다시 그리기가 잦다.
    // 홈이 안 보이면 멈춘다
    if (!active) return;
    const t = setInterval(() => setI((x) => x + 1), 2600);
    return () => clearInterval(t);
  }, [active]);
  // 화살표가 두 번 콕콕 — "여기를 누르면 된다"는 신호. 처음 한 번만
  const nudge = useOnce(order + 8, true, 900, Easing.linear);
  const nudgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(0, Math.sin(nudge.value * Math.PI * 4)) * 5 * (1 - nudge.value * 0.3) }],
  }));
  const go = (params: Record<string, string>) =>
    router.push({ pathname: '/(tabs)/explore', params: { ...params, t: nextNonce() } });

  return (
    <Tile order={order}>
      <Pressable
        onPress={() => go({ focus: 'search', category: '' })}
        accessibilityRole="button"
        accessibilityLabel="장소를 검색해 출입 판별하기"
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <TileKey icon="shield-checkmark-outline" label="출입 판별" />
      <Text style={[styles.question, { color: p.ink }]}>어디 갈까요?</Text>
      <View style={[styles.input, { backgroundColor: p.surface }]}>
        <Ionicons name="search" size={18} color={p.muted} />
        <Animated.View key={i} entering={reduce ? undefined : FadeIn.duration(260)} style={styles.flex}>
          <Text style={[styles.inputText, { color: p.muted }]} numberOfLines={1}>
            {EXAMPLES[i % EXAMPLES.length]}
          </Text>
        </Animated.View>
        <View style={[styles.go, { backgroundColor: p.accent }]}>
          <Animated.View style={nudgeStyle}>
            <Ionicons name="arrow-forward" size={18} color={p.onAccent} />
          </Animated.View>
        </View>
      </View>
      </Pressable>
      <View style={styles.cats}>
        {QUICK.map((c) => (
          <Pressable
            key={c}
            onPress={() => go({ category: c, focus: '' })}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${CATEGORY_LABEL[c]} 찾기`}
            style={({ pressed }) => [
              styles.cat,
              { borderColor: p.line, backgroundColor: pressed ? p.accentSoft : 'transparent' },
            ]}>
            <Text style={[styles.catText, { color: p.ink }]}>{CATEGORY_LABEL[c]}</Text>
          </Pressable>
        ))}
      </View>
    </Tile>
  );
}

/* ───────── 건강 ───────── */

export interface HealthItem {
  kind: 'vaccine' | 'med';
  /** 머리말 — 접종 지남 · 오늘 접종 · 다음 접종 · 오늘 약 */
  label: string;
  /** 큰 글씨 — D+5 · D-3 · 오늘 */
  big: string;
  sub: string;
  urgent: boolean;
}

export function HealthTile({ order, item }: { order: number; item: HealthItem | null }) {
  const p = usePalette();
  const router = useRouter();
  const tint = item?.urgent ? p.danger : p.ink;
  const beat = useOnce(order, !!item?.urgent, 900, Easing.linear);
  // 두근두근 — 0~1 동안 두 번 부풀었다 돌아온다
  const beatStyle = useAnimatedStyle(() => {
    const k = beat.value;
    const pulse = Math.max(0, Math.sin(k * Math.PI * 2 * 2));
    return { transform: [{ scale: 1 + (k < 1 ? pulse * 0.28 : 0) }] };
  });
  return (
    <Tile
      order={order}
      onPress={() => router.push('/(tabs)/calendar')}
      label={item ? `${item.label} ${item.big}, ${item.sub}` : '건강 일정 없음'}
      tint={item?.urgent ? p.dangerSoft : undefined}
      style={styles.half}>
        <TileKey
          icon={item?.kind === 'med' ? 'medical-outline' : 'medkit-outline'}
          label={item ? item.label : '건강 일정'}
          color={item?.urgent ? p.danger : undefined}
          iconStyle={beatStyle}
        />
        <Text style={[styles.big, { color: tint }]}>{item ? item.big : '여유'}</Text>
        <Text style={[styles.sub, { color: item?.urgent ? p.danger : p.muted }]} numberOfLines={2}>
          {item ? item.sub : '30일 안에 챙길 접종·약이 없어요'}
        </Text>
    </Tile>
  );
}

/* ───────── 다음 여행 / 다음 일정 ───────── */

export function ScheduleTile({ order, next, petName }: { order: number; next: NextSchedule | null; petName: string | null }) {
  const p = usePalette();
  const scheme = useColorScheme();
  const router = useRouter();
  // 여행이면 비행기가 왼쪽 아래에서 미끄러져 내려앉고, 하루 이틀 남은 일정은 아이콘이 톡톡 흔들린다
  const trip = !!next?.isTrip;
  const soon = !!next && !next.isTrip && next.dday <= 1;
  const v = useOnce(order, trip || soon, trip ? 700 : 520);
  const iconMotion = useAnimatedStyle(() => {
    const k = v.value;
    if (trip)
      return {
        opacity: Math.min(1, k * 2),
        transform: [{ translateX: -18 * (1 - k) }, { translateY: 10 * (1 - k) }, { rotate: `${-18 * (1 - k)}deg` }],
      };
    return { transform: [{ rotate: `${Math.sin(k * Math.PI * 4) * 10 * (1 - k)}deg` }] };
  });
  if (!next) {
    return (
      <Tile order={order} onPress={() => router.push('/calendar-event')} label="일정 추가하기" style={styles.half}>
        <TileKey icon="calendar-outline" label="다음 일정" />
        <View style={[styles.badgeIcon, { backgroundColor: p.surface }]}>
          <Ionicons name="add" size={20} color={p.muted} />
        </View>
        <Text style={[styles.big, { color: p.ink }]}>없음</Text>
        <Text style={[styles.sub, { color: p.muted }]}>눌러서 일정을 추가해요</Text>
      </Tile>
    );
  }
  const meta = CAL_EVENT_META[next.event.type];
  // 일정 종류 색의 연한 바탕은 라이트용이라 다크에서 번쩍인다 — 다크는 면 색 위에 아이콘 색만
  const iconBg = scheme === 'dark' ? p.surface : meta.soft;
  const big = next.ongoing ? '여행 중' : next.dday === 0 ? '오늘' : next.dday === 1 ? '내일' : `D-${next.dday}`;
  const sub = [next.event.title, next.event.time ? clockWord(next.event.time) : null, petName].filter(Boolean).join(' · ');
  return (
    <Tile
      order={order}
      onPress={() => router.push('/(tabs)/calendar')}
      label={`${next.isTrip ? '다음 여행' : '다음 일정'} ${big}, ${sub}`}
      style={styles.half}>
      <TileKey icon={next.isTrip ? 'airplane-outline' : 'calendar-outline'} label={next.isTrip ? '다음 여행' : '다음 일정'} />
      <View style={[styles.badgeIcon, { backgroundColor: iconBg }]}>
        <Animated.View style={iconMotion}>
          <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={19} color={meta.color} />
        </Animated.View>
      </View>
      <Text style={[styles.big, { color: p.ink }]} numberOfLines={1}>
        {big}
      </Text>
      <Text style={[styles.sub, { color: p.muted }]} numberOfLines={2}>
        {sub}
      </Text>
    </Tile>
  );
}

/* ───────── 도장 · 퀘스트 ───────── */

export function StampTile({ order, count }: { order: number; count: number }) {
  const p = usePalette();
  const router = useRouter();
  // 모은 도장이 있으면 도장이 위에서 "쾅" 찍힌다(1.7배 → 살짝 눌림 → 제자리, 비뚤게)
  const v = useOnce(order, count > 0, 360, SLAM);
  const stamp = useAnimatedStyle(() => {
    const k = v.value;
    const s = k < 0.6 ? 1.7 - (0.75 * k) / 0.6 : 0.95 + (0.05 * (k - 0.6)) / 0.4;
    return { opacity: Math.min(1, k * 3), transform: [{ scale: s }, { rotate: `${-8 * k}deg` }] };
  });
  return (
    <Tile order={order} onPress={() => router.push('/stamps')} label={`여권 도장 ${count}개 지역`} style={styles.half}>
      <TileKey icon="flag-outline" label="여권 도장" />
      <Text style={[styles.big, { color: p.ink }]}>
        {count}
        <Text style={[styles.unit, { color: p.ink }]}> 개 지역</Text>
      </Text>
      <Animated.View style={[styles.badgeIcon, styles.stampMark, { borderColor: p.accent }, stamp]} pointerEvents="none">
        <Ionicons name="paw" size={18} color={p.accent} />
      </Animated.View>
      <Text style={[styles.sub, { color: p.muted }]}>{count > 0 ? '도장첩 열어 보기' : '첫 도장을 찍어 보세요'}</Text>
    </Tile>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_R = 20;
const RING_C = 2 * Math.PI * RING_R;

export function QuestTile({ order, progress }: { order: number; progress: { left: number; total: number } | null }) {
  const p = usePalette();
  const router = useRouter();
  const done = progress ? progress.total - progress.left : 0;
  const ratio = progress && progress.total > 0 ? done / progress.total : 0;
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withTiming(ratio, { duration: 900, easing: EASE_OUT }));
  }, [ratio, v]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_C * (1 - v.value) }));
  const complete = !!progress && progress.total > 0 && progress.left === 0;
  const reduce = useReducedMotion();
  return (
    <Tile
      order={order}
      onPress={() => router.push('/quests')}
      label={progress ? `오늘 퀘스트 ${progress.left}개 남음` : '오늘 퀘스트'}
      style={styles.half}>
      <TileKey icon="ribbon-outline" label="오늘 퀘스트" />
      <Svg width={50} height={50} viewBox="0 0 50 50" style={styles.ring}>
        <Circle cx={25} cy={25} r={RING_R} stroke={p.line} strokeWidth={6} fill="none" />
        <AnimatedCircle
          cx={25}
          cy={25}
          r={RING_R}
          stroke={complete ? p.success : p.accent}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${RING_C} ${RING_C}`}
          animatedProps={ringProps}
          transform="rotate(-90 25 25)"
        />
      </Svg>
      {complete ? (
        <View style={styles.ringCheck} pointerEvents="none">
          <Ionicons name="checkmark" size={22} color={p.success} />
          {/* 다 끝낸 날엔 고리에서 발자국이 퍼진다(홈을 처음 그릴 때 한 번) */}
          {!reduce ? <PawBurst color={p.success} size={12} /> : null}
        </View>
      ) : null}
      <Text style={[styles.big, { color: p.ink }]}>
        {progress === null ? '–' : progress.left === 0 ? '완료' : progress.left}
        {progress && progress.left > 0 ? <Text style={[styles.unit, { color: p.ink }]}> 개 남음</Text> : null}
      </Text>
      <Text style={[styles.sub, { color: p.muted }]}>
        {progress ? `${progress.total}개 중 ${done}개 완료` : '눌러서 오늘 할 일 보기'}
      </Text>
    </Tile>
  );
}

/* ───────── 최근 판별 ───────── */

export interface RecentRow {
  checkId: number;
  facilityId: number;
  name: string;
  meta: string;
  result: CheckResult;
}

export function RecentTile({
  order,
  rows,
  total,
  onOpen,
  onHide,
}: {
  order: number;
  rows: RecentRow[];
  total: number;
  onOpen: (facilityId: number) => void;
  onHide: (checkId: number) => void;
}) {
  const p = usePalette();
  return (
    <Tile order={order}>
      <View style={styles.listHead}>
        <Text style={[styles.listTitle, { color: p.ink }]}>최근 판별</Text>
        <Text style={[styles.listCount, { color: p.muted }]}>{total}건</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={[styles.empty, { color: p.muted }]}>판별한 곳이 여기에 모여요</Text>
      ) : (
        rows.map((r, i) => (
          <Swipeable
            key={r.checkId}
            friction={2}
            rightThreshold={40}
            // 목록에서만 지운다. 서버에 삭제 API가 없어 다시 불러오면 되살아나므로
            // 스토어가 지운 id를 기기에 남겨 걸러낸다.
            renderRightActions={() => (
              <Pressable
                onPress={() => onHide(r.checkId)}
                accessibilityLabel={`${r.name} 이력 지우기`}
                style={[styles.delete, { backgroundColor: p.danger }]}>
                <Ionicons name="trash" size={17} color={p.onAccent} />
                <Text style={[styles.deleteText, { color: p.onAccent }]}>삭제</Text>
              </Pressable>
            )}>
            <Pressable
              onPress={() => onOpen(r.facilityId)}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}, ${r.meta}`}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: pressed ? p.surface : p.card },
                i < rows.length - 1 && { borderBottomColor: p.line, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}>
              <View style={styles.flex}>
                <Text style={[styles.rowName, { color: p.ink }]} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={[styles.rowMeta, { color: p.muted }]} numberOfLines={1}>
                  {r.meta}
                </Text>
              </View>
              <ResultBadge result={r.result} />
            </Pressable>
          </Swipeable>
        ))
      )}
    </Tile>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  // 반 칸 타일은 숫자 하나가 크게 들어가 키를 맞춘다. 목록·검색 타일은 내용만큼
  half: { flex: 1, minHeight: 128 },
  grow: { flexGrow: 1 },
  // 도장 — 잉크 테두리 원
  stampMark: { borderWidth: 2, borderRadius: 20, borderStyle: 'dashed' },
  // 반 칸 타일 둘이 나란히 놓일 때 키가 같아야 해서 남는 높이를 채운다
  tile: { flexGrow: 1, borderRadius: 26, padding: 15, overflow: 'hidden' },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyText: { fontSize: Type.footnote, fontWeight: '800' },
  question: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },
  input: {
    marginTop: 10,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 15,
    paddingRight: 5,
  },
  inputText: { fontSize: Type.callout - 0.5, fontWeight: '600' },
  go: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cats: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  cat: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 11, paddingVertical: 6 },
  catText: { fontSize: Type.footnote - 0.5, fontWeight: '700' },
  big: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 'auto',
    paddingTop: 14,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: Type.bodyLg, fontWeight: '700', letterSpacing: -0.2 },
  sub: { fontSize: Type.caption + 0.5, marginTop: 3, lineHeight: 16 },
  badgeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute', right: 12, top: 12 },
  ringCheck: { position: 'absolute', right: 12, top: 12, width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 },
  listTitle: { fontSize: Type.cardTitle, fontWeight: '800', letterSpacing: -0.3 },
  listCount: { fontSize: Type.caption, fontWeight: '600' },
  empty: { fontSize: Type.body, textAlign: 'center', paddingVertical: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowName: { fontSize: Type.bodyLg + 0.5, fontWeight: '800', letterSpacing: -0.3 },
  rowMeta: { fontSize: Type.caption + 0.5, marginTop: 2 },
  delete: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    width: 72,
    marginLeft: 8,
    marginVertical: 4,
    borderRadius: Radius.md,
  },
  deleteText: { fontSize: Type.caption, fontWeight: '800' },
});
