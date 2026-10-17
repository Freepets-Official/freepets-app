import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PawBurst } from '@/components/paw-burst';
import { Text } from '@/components/text';
import { ClayShadow, Radius, Type } from '@/constants/theme';
import { daysBetween, MAX_PASSES, type JourneyState } from '@/data/quest-journey';
import { useColorScheme, usePalette } from '@/hooks/use-theme';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

/**
 * 연속 기록 카드 — 퀘스트 화면 맨 위.
 *
 * 숫자 하나(며칠째)와 이번 주 일곱 칸만 보여준다. 길게 설명하지 않는다 — "오늘 하나만 하면
 * N일째"라는 한 줄이 돌아올 이유다. 빠뜨린 날을 빨간 X로 표시하지 않는다(죄책감은 이탈로
 * 이어진다). 이용권으로 지킨 날은 달 아이콘으로 "쉬어 간 날"이라고만 보여준다.
 */
export function StreakCard({
  journey,
  today,
  count,
  doneToday,
  celebrate,
}: {
  journey: JourneyState;
  today: string;
  count: number;
  doneToday: boolean;
  /** 하루가 더해질 때마다 1씩 오른다 — 그때 숫자가 통 튀고 발자국이 퍼진다 */
  celebrate: number;
}) {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const reduce = useReducedMotion();
  const pop = useSharedValue(1);
  useEffect(() => {
    if (!celebrate || reduce) return;
    pop.set(withSequence(withTiming(1.35, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 8, stiffness: 220 })));
  }, [celebrate, reduce, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  // 이번 주 월요일부터 일요일까지
  const now = new Date(`${today}T00:00:00`);
  const mondayOffset = (now.getDay() + 6) % 7;
  const week = DAYS.map((label, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - mondayOffset + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const diff = daysBetween(today, key);
    return {
      label,
      key,
      done: journey.history.includes(key),
      rest: journey.passDays.includes(key),
      isToday: diff === 0,
      future: diff > 0,
    };
  });

  const line = doneToday
    ? count >= 2
      ? `오늘도 지켰어요! 내일 오면 ${count + 1}일째`
      : '첫날 시작! 내일 또 와서 이어 가요'
    : count > 0
      ? `오늘 하나만 하면 ${count + 1}일째예요`
      : '오늘 퀘스트 하나로 연속 기록을 시작해요';

  return (
    <View style={[styles.card, { backgroundColor: p.card, boxShadow: clay.rest }]}>
      <View style={styles.top}>
        <Animated.View style={[styles.flame, { backgroundColor: count > 0 ? p.accent : p.surface }, popStyle]}>
          <Ionicons name="paw" size={26} color={count > 0 ? p.onAccent : p.muted} />
          {celebrate && !reduce ? (
            <View key={celebrate} style={styles.burst} pointerEvents="none">
              <PawBurst color={p.accent} size={14} />
            </View>
          ) : null}
        </Animated.View>
        <View style={styles.flex}>
          <Text style={[styles.count, { color: p.ink }]}>
            {count}
            <Text style={[styles.unit, { color: p.ink }]}>일 연속</Text>
          </Text>
          <Text style={[styles.line, { color: p.muted }]}>{line}</Text>
        </View>
      </View>

      <View style={styles.week}>
        {week.map((d) => (
          <View key={d.key} style={styles.day}>
            <View
              style={[
                styles.dot,
                d.done
                  ? { backgroundColor: p.accent, borderColor: p.accent }
                  : d.rest
                    ? { backgroundColor: p.surface, borderColor: p.line }
                    : d.isToday
                      ? { borderColor: p.accent, borderStyle: 'dashed', backgroundColor: 'transparent' }
                      : { borderColor: p.line, backgroundColor: 'transparent', opacity: d.future ? 0.5 : 1 },
              ]}>
              {d.done ? <Ionicons name="paw" size={13} color={p.onAccent} /> : d.rest ? <Ionicons name="moon" size={12} color={p.muted} /> : null}
            </View>
            <Text style={[styles.dayLabel, { color: d.isToday ? p.accentDark : p.muted }]}>{d.isToday ? '오늘' : d.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.pass, { backgroundColor: p.surface }]}>
        <Ionicons name="moon" size={14} color={p.accentDark} />
        <Text style={[styles.passText, { color: p.ink }]}>
          쉬는 날 이용권 <Text style={{ fontWeight: '900' }}>{journey.passes}</Text>/{MAX_PASSES}
        </Text>
        <Text style={[styles.passHint, { color: p.muted }]} numberOfLines={1}>
          7일마다 1장 · 빠진 날 자동 사용
        </Text>
      </View>
      {journey.best > count ? (
        <Text style={[styles.best, { color: p.muted }]}>가장 길었던 기록 {journey.best}일</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 26, padding: 18, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flame: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  burst: { position: 'absolute', left: 28, top: 28, width: 0, height: 0 },
  count: { fontSize: 34, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'], lineHeight: 38 },
  unit: { fontSize: Type.cardTitle, fontWeight: '800', letterSpacing: -0.3 },
  line: { fontSize: Type.footnote, fontWeight: '700', marginTop: 2 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 5, flex: 1 },
  dot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontSize: Type.micro, fontWeight: '800' },
  pass: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  passText: { fontSize: Type.footnote, fontWeight: '700' },
  passHint: { flex: 1, textAlign: 'right', fontSize: Type.micro },
  best: { fontSize: Type.caption, textAlign: 'right', marginTop: -6 },
});
