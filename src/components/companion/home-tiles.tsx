import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ResultBadge } from '@/components/badge';
import { Text } from '@/components/text';
import { ClayShadow, Radius, Spacing, Type } from '@/constants/theme';
import { clockWord, type NextSchedule } from '@/data/companion';
import { CAL_EVENT_META, CATEGORY_LABEL, type Category, type CheckResult } from '@/data/types';
import { useColorScheme, usePalette } from '@/hooks/use-theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

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
  return (
    <Animated.View entering={FadeInDown.delay(80 + order * 50).duration(300).easing(EASE_OUT)} style={style}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: tint ?? p.card, boxShadow: pressed ? clay.pressed : clay.rest },
          { transform: [{ scale: pressed ? 0.96 : 1 }] },
        ]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

function TileKey({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color?: string }) {
  const p = usePalette();
  return (
    <View style={styles.key}>
      <Ionicons name={icon} size={15} color={color ?? p.muted} />
      <Text style={[styles.keyText, { color: color ?? p.muted }]}>{label}</Text>
    </View>
  );
}

/* ───────── 어디 갈까요? ───────── */

const EXAMPLES = ['강릉 안목해변', '애견 동반 카페', '제주 숙소', '한옥 마을'];

/** 탐색 탭은 살아 있는 화면이라 같은 값으로 다시 보내면 반응하지 않는다 — 보낼 때마다 다른 표식 */
let nonce = 0;
const nextNonce = () => String(++nonce);
const QUICK: Category[] = ['CAFE', 'TOUR', 'STAY', 'RESTAURANT'];

export function SearchTile({ order }: { order: number }) {
  const p = usePalette();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    // 검색 예시를 천천히 돌려 "무엇을 넣으면 되는지" 보여준다. 글자 단위로 치면 다시 그리기가 잦다
    const t = setInterval(() => setI((x) => x + 1), 2600);
    return () => clearInterval(t);
  }, []);
  const go = (params: Record<string, string>) =>
    router.push({ pathname: '/(tabs)/explore', params: { ...params, t: nextNonce() } });

  return (
    <Tile order={order} onPress={() => go({ focus: 'search' })} label="장소를 검색해 출입 판별하기">
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
          <Ionicons name="arrow-forward" size={18} color={p.onAccent} />
        </View>
      </View>
      <View style={styles.cats}>
        {QUICK.map((c) => (
          <Pressable
            key={c}
            onPress={() => go({ category: c })}
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
  /** 큰 글씨 — D+5 · D-3 · 오늘 */
  big: string;
  sub: string;
  urgent: boolean;
}

export function HealthTile({ order, item }: { order: number; item: HealthItem | null }) {
  const p = usePalette();
  const router = useRouter();
  const tint = item?.urgent ? p.danger : p.ink;
  return (
    <Tile
      order={order}
      onPress={() => router.push('/(tabs)/calendar')}
      label={item ? `${item.kind === 'med' ? '오늘 약' : '접종'} ${item.big}, ${item.sub}` : '건강 일정 없음'}
      tint={item?.urgent ? p.dangerSoft : undefined}
      style={styles.half}>
        <TileKey
          icon={item?.kind === 'med' ? 'medical-outline' : 'medkit-outline'}
          label={item ? (item.kind === 'med' ? '오늘 약' : '접종 기한') : '건강 일정'}
          color={item?.urgent ? p.danger : undefined}
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
  const router = useRouter();
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
  const big = next.ongoing ? '여행 중' : next.dday === 0 ? '오늘' : next.dday === 1 ? '내일' : `D-${next.dday}`;
  const sub = [next.event.title, next.event.time ? clockWord(next.event.time) : null, petName].filter(Boolean).join(' · ');
  return (
    <Tile
      order={order}
      onPress={() => router.push('/(tabs)/calendar')}
      label={`${next.isTrip ? '다음 여행' : '다음 일정'} ${big}, ${sub}`}
      style={styles.half}>
      <TileKey icon={next.isTrip ? 'airplane-outline' : 'calendar-outline'} label={next.isTrip ? '다음 여행' : '다음 일정'} />
      <View style={[styles.badgeIcon, { backgroundColor: meta.soft }]}>
        <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={19} color={meta.color} />
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
  return (
    <Tile order={order} onPress={() => router.push('/stamps')} label={`여권 도장 ${count}개 지역`} style={styles.half}>
      <TileKey icon="flag-outline" label="여권 도장" />
      <Text style={[styles.big, { color: p.ink }]}>
        {count}
        <Text style={[styles.unit, { color: p.ink }]}> 개 지역</Text>
      </Text>
      <Text style={[styles.sub, { color: p.muted }]}>{count > 0 ? '도장첩 열어 보기' : '다녀온 곳에서 첫 도장을 찍어요'}</Text>
      <View style={styles.stampDeco} pointerEvents="none">
        <Ionicons name="paw" size={34} color={p.accent} style={{ opacity: 0.16 }} />
      </View>
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
          stroke={p.accent}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${RING_C} ${RING_C}`}
          animatedProps={ringProps}
          transform="rotate(-90 25 25)"
        />
      </Svg>
      <Text style={[styles.big, { color: p.ink }]}>
        {progress === null ? '–' : progress.left === 0 ? '완료' : progress.left}
        {progress && progress.left > 0 ? <Text style={[styles.unit, { color: p.ink }]}> 개 남음</Text> : null}
      </Text>
      <Text style={[styles.sub, { color: p.muted }]}>
        {progress ? `${progress.total}개 중 ${done}개 완료` : '퀘스트를 불러오는 중'}
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
  half: { flex: 1 },
  // 반 칸 타일 둘이 나란히 놓일 때 키가 같아야 해서 남는 높이를 채운다
  tile: { flexGrow: 1, borderRadius: 26, padding: 15, minHeight: 128, overflow: 'hidden' },
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
  stampDeco: { position: 'absolute', right: 10, bottom: 8, transform: [{ rotate: '-14deg' }] },
  ring: { position: 'absolute', right: 12, top: 12 },
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
