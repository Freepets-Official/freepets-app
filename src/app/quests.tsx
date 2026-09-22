import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PawChooser } from '@/components/paw-chooser';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { CardShadow, Radius, Spacing, Type } from '@/constants/theme';
import { TIER_ANIMAL_LABEL } from '@/data/level';
import { usePalette } from '@/hooks/use-theme';
import { questsApi, type DailyQuests, type QuestSource } from '@/lib/api';
import { useAppStore } from '@/store/app-store';

/** 퀘스트를 실제로 할 수 있는 화면. 라벨만 보여주고 갈 곳이 없으면 퀘스트가 아니다 */
const QUEST_META: Record<QuestSource, { icon: keyof typeof Ionicons.glyphMap; hint: string; route: Href; xp: number }> = {
  PETCHECK: { icon: 'search', hint: '시설 상세에서 우리 아이 기준으로 판별해요', route: '/(tabs)/explore', xp: 5 },
  REVIEW: { icon: 'create', hint: '다녀온 시설에 리뷰를 남겨요', route: '/(tabs)/explore', xp: 20 },
  REPORT: { icon: 'megaphone', hint: '문 앞에서 거부당했다면 제보해요', route: '/(tabs)/explore', xp: 15 },
  SATISFACTION: { icon: 'happy', hint: '아이가 그곳을 얼마나 좋아했는지 남겨요', route: '/(tabs)/explore', xp: 10 },
  COURSE_PUBLISHED: { icon: 'earth', hint: '내가 만든 코스를 공개해요', route: '/course', xp: 20 },
  COURSE_SHARED_COPY: { icon: 'share-social', hint: '내 공유 코스를 다른 집사가 담으면 올라가요', route: '/course', xp: 15 },
};

/** "3시간 뒤 초기화" — 자정까지 남은 시간. 날짜만 알려주면 언제 리셋인지 계산을 사용자가 한다 */
function resetHint(resetsAt: string | null): string {
  if (!resetsAt) return '매일 자정(KST)에 새로 시작해요';
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '곧 새로 시작해요';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분 뒤 새로 시작해요` : `${m}분 뒤 새로 시작해요`;
}

/**
 * 오늘의 퀘스트 — `GET /me/gamification/quests`.
 *
 * 퀘스트를 "받는" 행위는 없다. 이미 XP를 주던 6개 행동의 **오늘 진행률**을 보여주는 화면이라,
 * 여기서 뭘 눌러도 XP가 지급되지 않는다(지급은 각 행동을 실제로 했을 때 서버가 한다).
 * 그래서 각 줄은 "그 행동을 하러 가는 길"로 연결한다.
 */
export default function QuestsScreen() {
  const p = usePalette();
  const router = useRouter();
  /**
   * 발바닥은 이 화면에서 고른다. 처음 들어오면(고른 적 없으면) 퀘스트 대신 고르는 화면을
   * 먼저 보여준다 — 레벨 배지가 내 아이와 무관한 모양으로 시작하지 않게.
   */
  const { settings, updateSettings } = useAppStore();
  const [choosing, setChoosing] = useState(false);
  const needsPaw = settings.pawAnimal === '';
  const [data, setData] = useState<DailyQuests | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    questsApi
      .today()
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setData(null);
    setAttempt((a) => a + 1);
  }, []);

  const quests = data?.quests ?? [];
  const doneCount = quests.filter((q) => q.completed >= q.target).length;
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
          // 처음 진입이면 건너뛸 수 있게 — 퀘스트를 보러 왔는데 선택을 강요하지 않는다
          onSkip={choosing ? () => setChoosing(false) : undefined}
        />
      </Screen>
    );
  }

  return (
    <Screen
      hasNavHeader
      eyebrow="오늘의 퀘스트"
      title="오늘 할 일"
      subtitle={resetHint(data?.resetsAt ?? null)}>
      <Stack.Screen options={{ title: '오늘의 퀘스트', headerBackButtonDisplayMode: 'minimal' }} />

      {failed ? (
        <Pressable onPress={retry} style={[styles.state, { borderColor: p.line, backgroundColor: p.card }]}>
          <Ionicons name="cloud-offline-outline" size={26} color={p.muted} />
          <Text style={[styles.stateText, { color: p.muted }]}>퀘스트를 불러오지 못했어요. 눌러서 다시 시도</Text>
        </Pressable>
      ) : !data ? (
        <ActivityIndicator color={p.accent} style={{ paddingVertical: 40 }} />
      ) : quests.length === 0 ? (
        <Text style={[styles.stateText, { color: p.muted, paddingVertical: 32 }]}>오늘 받을 수 있는 퀘스트가 없어요.</Text>
      ) : (
        <>
          <View style={[styles.summary, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: p.ink }]}>
                {doneCount}
                <Text style={[styles.summaryUnit, { color: p.muted }]}> / {quests.length}</Text>
              </Text>
              <Text style={[styles.summaryLabel, { color: p.muted }]}>오늘 채운 퀘스트</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: p.line }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: p.accent }]}>
                +{xpToday.toLocaleString()}
                <Text style={[styles.summaryUnit, { color: p.muted }]}> XP</Text>
              </Text>
              <Text style={[styles.summaryLabel, { color: p.muted }]}>오늘 받은 경험치</Text>
            </View>
          </View>

          <View style={styles.list}>
            {quests.map((q) => {
              const meta = QUEST_META[q.sourceType];
              const done = q.completed >= q.target;
              const ratio = Math.min(q.completed / q.target, 1);
              return (
                <Pressable
                  key={q.sourceType}
                  onPress={() => router.push(meta.route)}
                  style={({ pressed }) => [
                    styles.quest,
                    { backgroundColor: p.card, borderColor: done ? p.success : p.line, opacity: pressed ? 0.94 : 1 },
                  ]}>
                  <View style={[styles.questIcon, { backgroundColor: done ? p.successSoft : p.accentSoft }]}>
                    <Ionicons name={done ? 'checkmark' : meta.icon} size={17} color={done ? p.success : p.accent} />
                  </View>
                  <View style={styles.questBody}>
                    <View style={styles.questTop}>
                      <Text style={[styles.questLabel, { color: p.ink }]} numberOfLines={1}>
                        {q.label || q.sourceType}
                      </Text>
                      <Text style={[styles.questXp, { color: p.accent }]}>+{meta.xp}</Text>
                      <Text style={[styles.questCount, { color: done ? p.success : p.muted }]}>
                        {q.completed}/{q.target}
                      </Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: p.surface }]}>
                      <View style={[styles.fill, { width: `${Math.max(ratio * 100, done ? 100 : 3)}%`, backgroundColor: done ? p.success : p.accent }]} />
                    </View>
                    <Text style={[styles.questHint, { color: p.muted }]} numberOfLines={1}>
                      {done ? '오늘 몫을 다 채웠어요' : meta.hint}
                      {q.earnedXpToday > 0 ? ` · +${q.earnedXpToday} XP` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={p.muted} />
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setChoosing(true)}
            style={({ pressed }) => [styles.pawRow, { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' }]}>
            <Ionicons name="paw" size={15} color={p.accent} />
            <Text style={[styles.pawRowText, { color: p.ink }]}>
              내 발바닥 · {settings.pawAnimal ? TIER_ANIMAL_LABEL[settings.pawAnimal] : '미선택'}
            </Text>
            <Text style={[styles.pawRowAction, { color: p.accent }]}>바꾸기</Text>
          </Pressable>

          <View style={[styles.howCard, { borderColor: p.line, backgroundColor: p.card }]}>
            <Text style={[styles.howTitle, { color: p.ink }]}>레벨은 이렇게 올라요</Text>
            <Text style={[styles.howBody, { color: p.muted }]}>
              위 여섯 가지 행동에 경험치가 붙고, 그게 모여 <Text style={{ fontWeight: '800', color: p.ink }}>집사 레벨</Text>이 올라가요.
              레벨이 오를 때마다 발바닥 색이 진해지고(투명도 80%→0%), 다섯 칸을 다 채우면 다음 무지개 색으로 넘어가요.
            </Text>
            <Text style={[styles.howBody, { color: p.muted }]}>
              퀘스트는 따로 받는 게 아니라 평소 하던 행동이 오늘 몇 번째인지 보여주는 거예요. 하루 상한을 채우면 그 행동의 경험치는 내일 다시 쌓여요.
            </Text>
            <Pressable onPress={() => router.push('/stamps')} style={styles.howLink}>
              <Ionicons name="footsteps-outline" size={14} color={p.accent} />
              <Text style={[styles.howLinkText, { color: p.accent }]}>경험치 규칙 전체 보기 (도장첩)</Text>
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: Radius.lg, paddingVertical: 28, paddingHorizontal: Spacing.xl },
  stateText: { fontSize: Type.body, lineHeight: 20, textAlign: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.lg, paddingVertical: Spacing.lg },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  summaryValue: { fontSize: Type.headline, fontWeight: '900', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  summaryUnit: { fontSize: Type.body, fontWeight: '800' },
  summaryLabel: { fontSize: Type.caption, fontWeight: '700' },
  list: { gap: Spacing.sm, marginTop: Spacing.lg },
  quest: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg },
  questIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  questBody: { flex: 1, gap: 5 },
  questTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  questLabel: { flex: 1, fontSize: Type.bodyLg, fontWeight: '800' },
  questXp: { fontSize: Type.caption, fontWeight: '800' },
  questCount: { fontSize: Type.footnote, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  questHint: { fontSize: Type.caption },
  pawRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    marginTop: Spacing.lg,
  },
  pawRowText: { flex: 1, fontSize: Type.body, fontWeight: '800' },
  pawRowAction: { fontSize: Type.body, fontWeight: '800' },
  howCard: { gap: 7, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, marginTop: Spacing.lg },
  howTitle: { fontSize: Type.bodyLg, fontWeight: '800' },
  howBody: { fontSize: Type.footnote, lineHeight: 19 },
  howLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 2 },
  howLinkText: { fontSize: Type.footnote, fontWeight: '800' },
});
