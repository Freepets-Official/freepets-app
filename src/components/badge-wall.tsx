import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Type } from '@/constants/theme';
import { BADGE_DOMAINS, parseBadgeCode, tiersOf } from '@/data/badges';
import { XP_RULES } from '@/data/level';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 배지 벽 — 도메인마다 6단계를 한 줄로, 받은 것은 색을 켜고 못 받은 것은 흐리게.
 *
 * 다음 목표가 보여야 다음 행동을 한다. 서버가 누적 횟수를 주면(`progress[]`) "몇 번 더"까지
 * 적고, 옛 서버면 다음 단계의 기준 횟수만 적는다. 모르는 접두사를 새로 보내면 "그 외" 줄에 모은다.
 *
 * 단계 수는 도메인마다 다를 수 있다 — 정복자만 4단계다(`tiersOf`).
 */
export function BadgeWall() {
  const p = usePalette();
  const { gamification } = useAppStore();
  if (!gamification) return null;

  const earned = new Map<string, string>(); // code → earnedAt
  for (const b of gamification.badges) earned.set(b.code, b.earnedAt ?? '');
  const known = new Set(BADGE_DOMAINS.map((d) => d.prefix));
  const extras = gamification.badges.filter((b) => {
    const parsed = parseBadgeCode(b.code);
    return !parsed || !known.has(parsed.prefix);
  });

  // 서버가 누적 횟수를 주면(progress[]) "몇 번 더"까지 적는다. 옛 서버면 기준만
  const countOf = new Map(gamification.progress.map((g) => [g.family, g.count] as const));

  return (
    <View style={styles.wall}>
      {BADGE_DOMAINS.map((d) => {
        // 정복자만 4단계라 도메인별 단계를 쓴다 — 공통 6단계로 그리면 못 받을 칸이 둘 생긴다
        const tiers = tiersOf(d);
        const got = tiers.filter((t) => earned.has(`${d.prefix}_${t.tier}`));
        const next = tiers.find((t) => !earned.has(`${d.prefix}_${t.tier}`));
        const count = countOf.get(d.prefix);
        const ratio = next && count !== undefined ? Math.min(1, count / next.threshold) : null;
        return (
          <View key={d.prefix} style={[styles.row, { backgroundColor: p.card, borderColor: p.line }]}>
            <View style={styles.rowHead}>
              <Ionicons name={d.icon as never} size={15} color={got.length ? p.accent : p.muted} />
              <Text style={[styles.rowTitle, { color: p.ink }]}>{d.label}</Text>
              <Text style={[styles.rowCount, { color: p.muted }]}>
                {got.length}/{tiers.length}
              </Text>
            </View>
            <View style={styles.tiers}>
              {tiers.map((t) => {
                const on = earned.has(`${d.prefix}_${t.tier}`);
                return (
                  <View key={t.tier} style={styles.tier}>
                    <View
                      style={[
                        styles.gem,
                        on
                          ? { backgroundColor: t.color, borderColor: t.color }
                          : { backgroundColor: p.surface, borderColor: p.line },
                      ]}>
                      <Ionicons name={on ? 'ribbon' : 'lock-closed-outline'} size={13} color={on ? p.onAccent : p.muted} />
                    </View>
                    <Text style={[styles.tierLabel, { color: on ? p.ink : p.muted }]}>{t.label}</Text>
                  </View>
                );
              })}
            </View>
            {ratio !== null && next && (
              <View style={[styles.track, { backgroundColor: p.surface }]}>
                <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: next.color }]} />
              </View>
            )}
            <Text style={[styles.hint, { color: p.muted }]} numberOfLines={1}>
              {!next
                ? '전부 모았어요!'
                : count !== undefined
                  ? `${next.label}까지 ${Math.max(0, next.threshold - count)}${d.unit} 더 (${count}/${next.threshold}) · ${d.how}`
                  : `다음 · ${next.label} — ${next.threshold}${d.unit} · ${d.how}`}
            </Text>
          </View>
        );
      })}
      {extras.length > 0 && (
        <View style={[styles.row, { backgroundColor: p.card, borderColor: p.line }]}>
          <View style={styles.rowHead}>
            <Ionicons name="sparkles" size={15} color={p.accent} />
            <Text style={[styles.rowTitle, { color: p.ink }]}>그 외</Text>
          </View>
          {extras.map((b) => (
            <Text key={b.code} style={[styles.hint, { color: p.ink }]}>
              {b.label}
              {b.description ? ` · ${b.description}` : ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * 경험치 얻는 법 — "레벨이 왜 오르는지" 퀘스트처럼.
 *
 * 서버는 XP를 조용히 지급하고 응답에 표시도 없다. 규칙표를 보여주지 않으면 사용자는 레벨이
 * 어떻게 오르는지 모른다. 하루 상한까지 적어야 "왜 오늘은 안 오르지"가 설명된다.
 * 오늘 몇 번 했는지는 서버가 안 알려줘 적지 않는다.
 */
export function QuestList() {
  const p = usePalette();
  const router = useRouter();
  return (
    <View style={styles.quests}>
      {XP_RULES.map((q) => (
        <Pressable
          key={q.title}
          onPress={() => router.push(q.route as never)}
          style={({ pressed }) => [
            styles.quest,
            { backgroundColor: pressed ? p.surface : p.card, borderColor: p.line },
          ]}>
          <View style={[styles.questXp, { backgroundColor: p.accentSoft }]}>
            <Text style={[styles.questXpText, { color: p.accent }]}>+{q.xp}</Text>
          </View>
          <View style={styles.questBody}>
            <Text style={[styles.questTitle, { color: p.ink }]}>{q.title}</Text>
            <Text style={[styles.questSub, { color: p.muted }]} numberOfLines={1}>
              {q.cap ? `하루 ${q.cap}회까지` : '횟수 제한 없음'}
              {q.note ? ` · ${q.note}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={p.muted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { gap: 8 },
  row: { borderWidth: 1, borderRadius: Radius.md, padding: 12, gap: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontSize: Type.bodyLg, fontWeight: '800' },
  rowCount: { fontSize: Type.caption, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  tiers: { flexDirection: 'row', justifyContent: 'space-between' },
  tier: { alignItems: 'center', gap: 3, width: 44 },
  gem: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tierLabel: { fontSize: Type.micro, fontWeight: '700' },
  hint: { fontSize: Type.caption, lineHeight: 16 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  quests: { gap: 8 },
  quest: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  questXp: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3, minWidth: 44, alignItems: 'center' },
  questXpText: { fontSize: Type.footnote, fontWeight: '900', fontVariant: ['tabular-nums'] },
  questBody: { flex: 1 },
  questTitle: { fontSize: Type.body, fontWeight: '700' },
  questSub: { fontSize: Type.caption, marginTop: 1 },
});
