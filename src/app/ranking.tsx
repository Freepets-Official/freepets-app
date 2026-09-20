import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TierDot } from '@/components/tier-paw';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { NotDeployedError, rankingApi, type OverallRanking } from '@/lib/api';
import { useAppStore } from '@/store/app-store';

/** "오늘 새벽 기준" — 스냅샷이면 언제 집계된 값인지 밝혀야 순위가 안 움직이는 이유가 설명된다 */
function updatedText(iso: string | null): string {
  if (!iso) return '집계 기준 시각은 서버가 알려주는 대로 표시돼요';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffH = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (diffH < 1) return '방금 집계된 순위예요';
  if (diffH < 24) return `${diffH}시간 전 집계 기준이에요`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 집계 기준이에요`;
}

/**
 * 전체 랭킹 — 모든 집사 사이에서 내 자리.
 *
 * 레벨·XP는 서버에 있는데 비교 대상이 없어 "쌓이기만 하는 숫자"였다. 순위는 **앱이 계산할 수
 * 없다**(전체 목록을 받을 수 없고 페이징이 걸리면 내 위치를 모른다) — 서버의 `me.rank`와
 * `me.participantCount`를 그대로 문장에 끼워 넣는다.
 *
 * 지역(시/도·시/군/구) 단위는 XP 적립 로그에 지역 코드가 쌓여야 해서 후속으로 미뤘다(`docs/13`).
 * 이 화면은 좌표를 보내지 않는다 — 위치정보를 수집하지 않는다.
 */
export default function RankingScreen() {
  const p = usePalette();
  const { gamification, pets } = useAppStore();
  const [data, setData] = useState<OverallRanking | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'failed' | 'not-deployed'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      void (async () => {
        setState('loading');
        try {
          const d = await rankingApi.overall();
          if (!alive) return;
          setData(d);
          setState('ok');
        } catch (e) {
          if (!alive) return;
          setState(e instanceof NotDeployedError ? 'not-deployed' : 'failed');
        }
      })();
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [attempt]);

  const me = data?.me ?? null;
  /** "몽이 집사" — 아이가 여럿이면 첫 아이 + 외 N */
  const myPetLabel =
    pets.length === 0 ? null : pets.length === 1 ? `${pets[0].name} 집사` : `${pets[0].name} 외 ${pets.length - 1}마리의 집사`;

  return (
    <Screen hasNavHeader eyebrow="전체 랭킹" title="집사 랭킹" subtitle="판별·리뷰·제보로 쌓은 경험치로 줄 세운 순위예요.">
      <Stack.Screen options={{ title: '전체 랭킹', headerBackButtonDisplayMode: 'minimal' }} />

      {state === 'not-deployed' ? (
        <View style={[styles.state, { borderColor: p.line, backgroundColor: p.card }]}>
          <Ionicons name="construct-outline" size={26} color={p.muted} />
          <Text style={[styles.stateTitle, { color: p.ink }]}>곧 열려요</Text>
          <Text style={[styles.stateText, { color: p.muted }]}>
            랭킹은 서버에서 준비 중이에요. 그동안 쌓은 경험치는 그대로 반영되니 판별·리뷰를 계속 남겨 두세요.
          </Text>
        </View>
      ) : state === 'failed' ? (
        <Pressable onPress={() => setAttempt((a) => a + 1)} style={[styles.state, { borderColor: p.line, backgroundColor: p.card }]}>
          <Ionicons name="cloud-offline-outline" size={26} color={p.muted} />
          <Text style={[styles.stateText, { color: p.muted }]}>순위를 불러오지 못했어요. 눌러서 다시 시도</Text>
        </Pressable>
      ) : state === 'loading' ? (
        <ActivityIndicator color={p.accent} style={{ paddingVertical: 40 }} />
      ) : (
        <>
          {/* 내 자리 — 이 화면의 핵심. 순위는 서버가 계산한 값을 그대로 쓴다 */}
          <View style={[styles.meCard, CardShadow, { backgroundColor: p.card, borderColor: p.accent }]}>
            {me && me.ranked ? (
              <>
                <Text style={[styles.meLabel, { color: p.muted }]}>{myPetLabel ?? '전체'}, 지금 내 자리</Text>
                <Text style={[styles.meRank, { color: p.ink }]}>
                  {me.participantCount.toLocaleString()}명 중 <Text style={{ color: p.accent }}>{me.rank.toLocaleString()}번째</Text>
                </Text>
                <Text style={[styles.meSub, { color: p.muted }]}>
                  집사 Lv.{me.level} · 누적 {me.xp.toLocaleString()} XP
                </Text>
              </>
            ) : me && !me.ranked ? (
              <>
                <Text style={[styles.meLabel, { color: p.muted }]}>전체 랭킹</Text>
                <Text style={[styles.meRank, { color: p.ink }]}>아직 집계 전이에요</Text>
                <Text style={[styles.meSub, { color: p.muted }]}>참여한 집사가 아직 적어요. 조금 더 모이면 순위가 열려요.</Text>
              </>
            ) : (
              <>
                <Text style={[styles.meLabel, { color: p.muted }]}>전체 랭킹</Text>
                <Text style={[styles.meRank, { color: p.ink }]}>아직 기록이 없어요</Text>
                <Text style={[styles.meSub, { color: p.muted }]}>
                  판별하거나 리뷰를 남기면 순위에 들어가요{gamification ? ` (지금 집사 Lv.${gamification.level})` : ''}.
                </Text>
              </>
            )}
          </View>

          <View style={styles.list}>
            {data && data.items.length === 0 ? (
              <Text style={[styles.stateText, { color: p.muted, paddingVertical: 24 }]}>아직 집계된 집사가 없어요.</Text>
            ) : (
              data?.items.map((e) => (
                <View
                  key={`${e.rank}-${e.userId ?? e.nickname}`}
                  style={[
                    styles.row,
                    { borderColor: e.isMe ? p.accent : p.line, backgroundColor: e.isMe ? p.accentSoft : p.card },
                  ]}>
                  <Text style={[styles.rank, { color: e.rank <= 3 ? p.accent : p.muted }]}>{e.rank}</Text>
                  <View style={styles.dot}>
                    <TierDot level={e.level} size={10} />
                  </View>
                  <View style={styles.who}>
                    <Text style={[styles.nickname, { color: p.ink }]} numberOfLines={1}>
                      {e.nickname}
                      {e.isMe ? ' (나)' : ''}
                    </Text>
                    {/*
                      내 줄에만 아이 이름을 얹는다 — 남의 아이 정보는 서버 응답에 없다
                      (`items[].petName` 추가를 요청해 둔 상태다).
                    */}
                    {e.isMe && myPetLabel ? (
                      <Text style={[styles.petLine, { color: p.muted }]} numberOfLines={1}>
                        {myPetLabel}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.level, { color: p.muted }]}>Lv.{e.level}</Text>
                  <Text style={[styles.xp, { color: p.ink }]}>{e.xp.toLocaleString()}</Text>
                </View>
              ))
            )}
          </View>

          <Text style={[styles.note, { color: p.muted }]}>{updatedText(data?.updatedAt ?? null)}</Text>
          <Text style={[styles.note, { color: p.muted }]}>지역별 랭킹은 준비 중이에요.</Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: Radius.lg, paddingVertical: 28, paddingHorizontal: Spacing.xl, marginTop: Spacing.sm },
  stateTitle: { fontSize: 15, fontWeight: '900' },
  stateText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  meCard: { gap: 3, borderWidth: 1.5, borderRadius: Radius.lg, padding: Spacing.lg, marginTop: Spacing.sm },
  meLabel: { fontSize: 11.5, fontWeight: '700' },
  meRank: { fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  meSub: { fontSize: 12.5, lineHeight: 18 },
  list: { gap: 6, marginTop: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11 },
  rank: { width: 24, fontSize: 13.5, fontWeight: '900', fontVariant: ['tabular-nums'] },
  dot: { width: 10, height: 10 },
  who: { flex: 1, gap: 1 },
  nickname: { fontSize: 13.5, fontWeight: '800' },
  petLine: { fontSize: 10.5, fontWeight: '700' },
  level: { fontSize: 12, fontWeight: '700' },
  xp: { width: 62, fontSize: 12.5, fontWeight: '800', textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: { fontSize: 11.5, textAlign: 'center', marginTop: Spacing.sm },
});
