import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { LoadState } from '@/components/load-state';
import { TiltPressable } from '@/components/motion/tilt-pressable';
import { PawChooser } from '@/components/paw-chooser';
import { ChestCard, ChestOpening } from '@/components/quest/chest';
import { StreakCard } from '@/components/quest/streak-card';
import { Wardrobe } from '@/components/quest/wardrobe';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { BADGE_DOMAINS, tiersOf } from '@/data/badges';
import { TIER_ANIMAL_LABEL } from '@/data/level';
import { itemById, type ItemId } from '@/data/quest-journey';
import { useQuestJourney } from '@/hooks/use-quest-journey';
import { usePalette } from '@/hooks/use-theme';
import type { QuestSource } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { notify } from '@/lib/notify';
import { useAppStore } from '@/store/app-store';


/**
 * 지금 가장 가까운 배지 하나.
 *
 * 배지 벽(도장첩)은 아홉 줄을 한꺼번에 보여준다 — 전체를 훑기엔 좋지만 "그래서 지금 뭘 하면
 * 되는지"가 묻힌다. 퀘스트 화면은 **오늘 할 일**을 보는 곳이라, 가장 적게 남은 것 하나만
 * 골라 붙인다.
 *
 * 서버가 누적 횟수(`progress[]`)를 줘야 "몇 번 더"를 셀 수 있다. 안 주는 옛 서버에서는
 * 아무것도 그리지 않는다 — 기준 횟수만 적으면 이미 채운 사람에게도 남은 것처럼 보인다.
 */
function NextBadgeLine() {
  const p = usePalette();
  const router = useRouter();
  const { gamification } = useAppStore();
  if (!gamification || gamification.progress.length === 0) return null;

  const earned = new Set(gamification.badges.map((b) => b.code));
  const countOf = new Map(gamification.progress.map((g) => [g.family, g.count] as const));

  let best: { label: string; unit: string; left: number; tierLabel: string } | null = null;
  for (const d of BADGE_DOMAINS) {
    const count = countOf.get(d.prefix);
    if (count === undefined) continue;
    const next = tiersOf(d).find((t) => !earned.has(`${d.prefix}_${t.tier}`));
    if (!next) continue;
    const left = Math.max(0, next.threshold - count);
    // 이미 조건을 채웠는데 아직 안 들어온 배지는 건너뛴다 — "0번 더"는 할 일이 아니다
    if (left === 0) continue;
    if (!best || left < best.left) {
      best = { label: d.label, unit: d.unit, left, tierLabel: next.label };
    }
  }
  if (!best) return null;

  return (
    <Pressable
      onPress={() => router.push('/stamps')}
      style={({ pressed }) => [
        styles.nextBadge,
        { borderColor: p.line, backgroundColor: pressed ? p.surface : p.card },
      ]}>
      <Ionicons name="ribbon" size={16} color={p.accent} />
      <Text style={[styles.nextBadgeText, { color: p.ink }]} numberOfLines={1}>
        다음 배지 · <Text style={{ fontWeight: '900' }}>{best.label} {best.tierLabel}</Text>까지{' '}
        {best.left}{best.unit} 더
      </Text>
      <Ionicons name="chevron-forward" size={15} color={p.muted} />
    </Pressable>
  );
}

/** "3시간 뒤 초기화" — 자정까지 남은 시간. 날짜만 알려주면 언제 리셋인지 계산을 사용자가 한다 */
function resetHint(resetsAt: string | null): string {
  if (!resetsAt) return '매일 자정(KST)에 새로 시작해요';
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '곧 새로 시작해요';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분 뒤 새로 시작해요` : `${m}분 뒤 새로 시작해요`;
}

/** 보너스 경험치 목록의 이름 — 세 가지에 없는 행동도 경험치는 그대로 쌓인다 */
const BONUS_LABEL: Record<QuestSource, string> = {
  PETCHECK: '판별 요청',
  REVIEW: '리뷰 쓰기',
  REPORT: '현장 거부 제보(겪었을 때만)',
  SATISFACTION: '아이 만족도',
  COURSE_PUBLISHED: '코스 공개',
  COURSE_SHARED_COPY: '내 코스가 담기면',
};

/**
 * 오늘의 퀘스트 2.0 — 연속 기록 · 오늘의 세 가지 · 간식 상자 · 꾸미기.
 *
 * 규칙은 `data/quest-journey.ts`에 있다. 이 화면은 "지치지 않게"가 원칙이다 — 할 일은 세 개,
 * 하나만 해도 연속 기록은 지켜지고, 빠진 날은 이용권이 막아 준다. 경험치는 지금처럼 서버가
 * 각 행동마다 주므로 여기서 뭘 눌러도 XP가 생기지 않는다(상자는 꾸미기 소품만 준다).
 */
export default function QuestsScreen() {
  const p = usePalette();
  const router = useRouter();
  const focused = useIsFocused();
  /**
   * 발바닥은 이 화면에서 고른다. 처음 들어오면(고른 적 없으면) 퀘스트 대신 고르는 화면을
   * 먼저 보여준다 — 레벨 배지가 내 아이와 무관한 모양으로 시작하지 않게.
   */
  const { settings, updateSettings, pets } = useAppStore();
  const [choosing, setChoosing] = useState(false);
  const needsPaw = settings.pawAnimal === '';
  const j = useQuestJourney(true, { fresh: true });
  const [opening, setOpening] = useState<{ item: ItemId | null } | null>(null);
  // 연속 기록이 늘 때마다 1씩 — 카드가 그 순간 한 번 축하한다
  const [celebrate, setCelebrate] = useState(0);
  const [unlocked, setUnlocked] = useState<ItemId[]>([]);
  const [showBonus, setShowBonus] = useState(false);

  // 방금 생긴 일 — 연속 +1이면 숫자가 통, 새 소품이 열렸으면 알림 줄. 한 번 보여주고 비운다
  useEffect(() => {
    if (!j.events.length) return;
    const grew = j.events.some((e) => e.kind === 'continued' || e.kind === 'started' || e.kind === 'saved-by-pass');
    const items = j.events.flatMap((e) => (e.kind === 'item-unlocked' ? [e.item] : []));
    const t = setTimeout(() => {
      if (grew) {
        setCelebrate((c) => c + 1);
        haptic.success();
      }
      if (items.length) setUnlocked(items);
      j.consumeEvents();
    }, 350);
    return () => clearTimeout(t);
  }, [j.events, j]);

  const firstPetIsCat = pets[0]?.kind === 'CAT';
  const quests = j.quests?.quests ?? [];
  const xpToday = quests.reduce((sum, q) => sum + q.earnedXpToday, 0);

  if (needsPaw || choosing) {
    return (
      <Screen hasNavHeader eyebrow="오늘의 퀘스트" title="발바닥 정하기">
        <Stack.Screen options={{ title: '오늘의 퀘스트', headerBackButtonDisplayMode: 'minimal' }} />
        <PawChooser
          onPick={(animal) => {
            updateSettings({ pawAnimal: animal });
            setChoosing(false);
          }}
          onSkip={choosing ? () => setChoosing(false) : undefined}
        />
      </Screen>
    );
  }

  return (
    <Screen hasNavHeader eyebrow="오늘의 퀘스트" title="하나만 해도 충분해요" subtitle={resetHint(j.quests?.resetsAt ?? null)} onRefresh={j.reload}>
      <Stack.Screen options={{ title: '오늘의 퀘스트', headerBackButtonDisplayMode: 'minimal' }} />

      {j.status === 'failed' ? (
        <LoadState kind="failed" message="퀘스트를 불러오지 못했어요." onRetry={j.reload} />
      ) : j.status !== 'ready' ? (
        <LoadState kind="loading" />
      ) : (
        <View style={styles.stack}>
          <StreakCard
            journey={j.journey}
            today={j.today}
            count={j.streak.count}
            doneToday={j.streak.doneToday}
            celebrate={celebrate}
          />

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: p.ink }]}>오늘의 세 가지</Text>
            <Text style={[styles.sectionCount, { color: p.muted }]}>
              {j.trioDone}/{j.trio.length}
            </Text>
          </View>
          <View style={styles.trio}>
            {j.trio.map((q, i) => (
              <Animated.View key={q.source} entering={FadeInDown.delay(60 + i * 50).duration(280)}>
                <TiltPressable
                  onPress={() => router.push(q.route)}
                  accessibilityRole="button"
                  accessibilityLabel={`${q.title}${q.done ? ', 완료' : ''}`}
                  style={[styles.quest, { backgroundColor: p.card, borderColor: q.done ? p.success : p.line }]}>
                  <View style={[styles.questIcon, { backgroundColor: q.done ? p.successSoft : p.accentSoft }]}>
                    {q.done ? (
                      <Animated.View entering={ZoomIn.springify().damping(10)}>
                        <Ionicons name="checkmark" size={20} color={p.success} />
                      </Animated.View>
                    ) : (
                      <Ionicons name={q.icon as keyof typeof Ionicons.glyphMap} size={19} color={p.accentDark} />
                    )}
                  </View>
                  <View style={styles.questBody}>
                    <Text
                      style={[styles.questLabel, { color: q.done ? p.muted : p.ink }, q.done && styles.strike]}
                      numberOfLines={1}>
                      {q.title}
                    </Text>
                    <Text style={[styles.questHint, { color: p.muted }]} numberOfLines={1}>
                      {q.done ? '오늘 몫 완료!' : q.hint}
                    </Text>
                  </View>
                  <View style={[styles.xpChip, { backgroundColor: q.done ? p.successSoft : p.surface }]}>
                    <Text style={[styles.xpText, { color: q.done ? p.success : p.accentDark }]}>+{q.xp}</Text>
                  </View>
                </TiltPressable>
              </Animated.View>
            ))}
          </View>

          <ChestCard
            done={j.trioDone}
            total={j.trio.length}
            ready={j.chestReady}
            openedToday={j.journey.chestDay === j.today}
            lastItem={j.journey.chestDay === j.today ? j.journey.chestItem : null}
            // 두 번 빨리 눌러도 처음 연 결과를 지킨다(두 번째는 같은 날이라 빈손이다)
            onOpen={() => {
              if (!opening) setOpening({ item: j.openChest() });
            }}
          />

          {unlocked.length ? (
            <Animated.View entering={FadeInDown.duration(260)} style={[styles.unlocked, { backgroundColor: p.accentSoft }]}>
              <Ionicons name="gift" size={16} color={p.accentDark} />
              <Text style={[styles.unlockedText, { color: p.ink }]}>
                연속 기록 선물 — 「{unlocked.map((id) => itemById(id).name).join('」 「')}」이 열렸어요!
              </Text>
            </Animated.View>
          ) : null}

          <Wardrobe journey={j.journey} onToggle={j.toggleItem} active={focused} initialWho={firstPetIsCat ? 'cat' : 'dog'} />

          <NextBadgeLine />

          <View style={[styles.bonus, { borderColor: p.line, backgroundColor: p.card }]}>
            <Pressable
              onPress={() => setShowBonus((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showBonus }}
              style={styles.bonusHead}>
              <Ionicons name="sparkles" size={15} color={p.accent} />
              <Text style={[styles.bonusTitle, { color: p.ink }]}>
                오늘 받은 경험치 <Text style={{ color: p.accentDark }}>+{xpToday.toLocaleString()} XP</Text>
              </Text>
              <Ionicons name={showBonus ? 'chevron-up' : 'chevron-down'} size={15} color={p.muted} />
            </Pressable>
            {showBonus ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.bonusList}>
                <Text style={[styles.bonusNote, { color: p.muted }]}>
                  세 가지 말고도 평소 하던 행동마다 경험치가 쌓여요. 하루 상한까지만 쌓이고 자정에 다시 시작해요.
                </Text>
                {quests.map((q) => (
                  <View key={q.sourceType} style={styles.bonusRow}>
                    <Text style={[styles.bonusLabel, { color: p.ink }]} numberOfLines={1}>
                      {BONUS_LABEL[q.sourceType]}
                    </Text>
                    <Text style={[styles.bonusCount, { color: p.muted }]}>
                      {q.completed}/{q.target}
                    </Text>
                    <Text style={[styles.bonusXp, { color: q.earnedXpToday ? p.accentDark : p.muted }]}>
                      +{q.earnedXpToday}
                    </Text>
                  </View>
                ))}
              </Animated.View>
            ) : null}
          </View>

          {Platform.OS !== 'web' ? (
            <View style={[styles.row, { borderColor: p.line }]}>
              <Ionicons name="notifications-outline" size={16} color={p.accent} />
              <View style={styles.flex}>
                <Text style={[styles.rowText, { color: p.ink }]}>저녁 8시에 살짝 알려 주기</Text>
                <Text style={[styles.rowSub, { color: p.muted }]}>그날 이미 했으면 울리지 않아요</Text>
              </View>
              <Switch
                value={j.journey.reminder}
                onValueChange={async (on) => {
                  const ok = await j.setReminder(on);
                  if (!ok) notify('알림을 켤 수 없어요', '설정 앱에서 반갑꼬리 알림을 허용해 주세요.');
                }}
                trackColor={{ true: p.accent, false: p.line }}
              />
            </View>
          ) : null}

          <Pressable
            onPress={() => setChoosing(true)}
            style={({ pressed }) => [styles.row, { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' }]}>
            <Ionicons name="paw" size={15} color={p.accent} />
            <Text style={[styles.rowText, styles.flex, { color: p.ink }]}>
              내 발바닥 · {settings.pawAnimal ? TIER_ANIMAL_LABEL[settings.pawAnimal] : '미선택'}
            </Text>
            <Text style={[styles.rowAction, { color: p.accent }]}>바꾸기</Text>
          </Pressable>
        </View>
      )}

      {/* 열 때마다 새로 띄운다 — 장면이 처음부터 다시 재생된다 */}
      {opening ? (
        <ChestOpening
          visible
          item={opening.item}
          onClose={() => setOpening(null)}
          onWear={(id) => {
            j.toggleItem(firstPetIsCat ? 'cat' : 'dog', id);
            setOpening(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: Spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 },
  sectionTitle: { fontSize: Type.sectionTitle - 2, fontWeight: '800', letterSpacing: -0.4 },
  sectionCount: { fontSize: Type.footnote, fontWeight: '800', fontVariant: ['tabular-nums'] },
  trio: { gap: Spacing.sm },
  quest: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1.5, borderRadius: 20, padding: 14 },
  questIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  questBody: { flex: 1, gap: 2 },
  questLabel: { fontSize: Type.callout, fontWeight: '800', letterSpacing: -0.3 },
  strike: { textDecorationLine: 'line-through' },
  questHint: { fontSize: Type.caption },
  xpChip: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  xpText: { fontSize: Type.caption, fontWeight: '900', fontVariant: ['tabular-nums'] },
  unlocked: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.lg, padding: 12 },
  unlockedText: { flex: 1, fontSize: Type.footnote, fontWeight: '700' },
  nextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  nextBadgeText: { flex: 1, fontSize: Type.footnote, fontWeight: '700' },
  bonus: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg },
  bonusHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13 },
  bonusTitle: { flex: 1, fontSize: Type.body, fontWeight: '800' },
  bonusList: { gap: 8, paddingBottom: 14 },
  bonusNote: { fontSize: Type.caption, lineHeight: 17 },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bonusLabel: { flex: 1, fontSize: Type.footnote, fontWeight: '700' },
  bonusCount: { fontSize: Type.caption, fontVariant: ['tabular-nums'] },
  bonusXp: { width: 44, textAlign: 'right', fontSize: Type.footnote, fontWeight: '800', fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  rowText: { fontSize: Type.body, fontWeight: '800' },
  rowSub: { fontSize: Type.caption, marginTop: 1 },
  rowAction: { fontSize: Type.body, fontWeight: '800' },
});
