import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { TIER_COLOR_HEX } from '@/data/level';
import { usePalette } from '@/hooks/use-theme';
import { NotDeployedError, regionRankingApi, type RankingScope, type RegionRanking } from '@/lib/api';
import { useAppStore } from '@/store/app-store';

/** "오늘 새벽 기준" — 스냅샷이면 언제 집계된 값인지 밝혀야 순위가 안 움직이는 이유가 설명된다 */
function updatedText(iso: string | null): string {
  if (!iso) return '집계 시각은 서버가 알려주는 대로 표시돼요';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffH = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (diffH < 1) return '방금 집계된 순위예요';
  if (diffH < 24) return `${diffH}시간 전 집계 기준이에요`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 집계 기준이에요`;
}

/**
 * 지역 랭킹 — 같은 지역을 다녀온 집사들 사이에서 내 자리.
 *
 * 레벨·XP는 서버에 있는데 비교 대상이 없어 "쌓이기만 하는 숫자"였다. 순위는 **앱이 계산할 수
 * 없다**(전체 목록을 받을 수 없고 페이징이 걸리면 내 위치를 모른다) — 서버의 `me.rank`와
 * `me.participantCount`를 그대로 문장에 끼워 넣는다. 명세: `docs/13-지역-랭킹.md`.
 *
 * 백엔드가 아직 만드는 중이라, 없으면(404) 오류가 아니라 **준비 중**으로 안내한다.
 */
export default function RegionRankingScreen() {
  const p = usePalette();
  const { stampRegions, reloadStampRegions, gamification } = useAppStore();

  const [scope, setScope] = useState<RankingScope>('SIDO');
  const [sidoCode, setSidoCode] = useState<string | null>(null);
  const [sigunguCode, setSigunguCode] = useState<string | null>(null);
  const [data, setData] = useState<RegionRanking | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'failed' | 'not-deployed'>('loading');
  const [attempt, setAttempt] = useState(0);

  const sido = useMemo(() => stampRegions.find((r) => r.sidoCode === sidoCode) ?? null, [stampRegions, sidoCode]);

  useEffect(() => {
    if (stampRegions.length === 0) void reloadStampRegions();
  }, [stampRegions.length, reloadStampRegions]);

  useEffect(() => {
    let alive = true;
    // 로딩 표시도 effect 안에서 동기로 바꾸지 않는다 — 조건이 바뀔 때마다 렌더가 연쇄된다
    const t = setTimeout(() => {
      void (async () => {
        setState('loading');
        try {
          const d = await regionRankingApi.get({ scope, sidoCode, sigunguCode });
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
  }, [scope, sidoCode, sigunguCode, attempt]);

  const pickSido = (code: string) => {
    setSidoCode(code);
    setSigunguCode(null);
    setScope('SIDO');
  };

  const me = data?.me ?? null;
  const regionName = data?.sigungu ?? data?.sido ?? (scope === 'NATION' ? '전국' : '이 지역');

  return (
    <Screen hasNavHeader eyebrow="지역 랭킹" title="이 지역의 집사들" subtitle="같은 지역을 다녀온 집사들 사이에서 내 자리예요.">
      <Stack.Screen options={{ title: '지역 랭킹', headerBackButtonDisplayMode: 'minimal' }} />

      {/* 범위 — 전국/시도/시군구 */}
      <View style={styles.scopeRow}>
        {([
          { v: 'NATION', label: '전국' },
          { v: 'SIDO', label: '시·도' },
          { v: 'SIGUNGU', label: '시·군·구' },
        ] as const).map((opt) => {
          const on = scope === opt.v;
          const disabled = (opt.v === 'SIDO' && !sidoCode) || (opt.v === 'SIGUNGU' && !sigunguCode);
          return (
            <Pressable
              key={opt.v}
              onPress={() => !disabled && setScope(opt.v)}
              style={[
                styles.scopeItem,
                { backgroundColor: on ? p.accent : p.surface, borderColor: on ? p.accent : p.line, opacity: disabled ? 0.45 : 1 },
              ]}>
              <Text style={[styles.scopeText, { color: on ? p.onAccent : p.muted }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {stampRegions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {stampRegions.map((r) => {
            const on = sidoCode === r.sidoCode;
            return (
              <Pressable
                key={r.sidoCode}
                onPress={() => pickSido(r.sidoCode)}
                style={[styles.chip, { backgroundColor: on ? p.accentSoft : p.surface, borderColor: on ? p.accent : p.line }]}>
                <Text style={[styles.chipText, { color: on ? p.accent : p.muted }]}>{r.sido}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {sido && sido.sigungus.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {sido.sigungus.map((sg) => {
            const on = sigunguCode === sg.sigunguCode;
            return (
              <Pressable
                key={sg.sigunguCode}
                onPress={() => {
                  setSigunguCode(on ? null : sg.sigunguCode);
                  setScope(on ? 'SIDO' : 'SIGUNGU');
                }}
                style={[styles.chipSm, { backgroundColor: on ? p.accent : p.surface, borderColor: on ? p.accent : p.line }]}>
                <Text style={[styles.chipSmText, { color: on ? p.onAccent : p.muted }]}>{sg.sigungu}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {state === 'not-deployed' ? (
        <View style={[styles.state, { borderColor: p.line, backgroundColor: p.card }]}>
          <Ionicons name="construct-outline" size={26} color={p.muted} />
          <Text style={[styles.stateTitle, { color: p.ink }]}>곧 열려요</Text>
          <Text style={[styles.stateText, { color: p.muted }]}>
            지역 랭킹은 서버에서 준비 중이에요. 그동안 쌓은 경험치는 그대로 반영되니 판별·리뷰를 계속 남겨 두세요.
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
                <Text style={[styles.meLabel, { color: p.muted }]}>{regionName}에서 내 자리</Text>
                <Text style={[styles.meRank, { color: p.ink }]}>
                  {me.participantCount.toLocaleString()}명 중 <Text style={{ color: p.accent }}>{me.rank.toLocaleString()}번째</Text>
                </Text>
                <Text style={[styles.meSub, { color: p.muted }]}>
                  집사 Lv.{me.level} · 누적 {me.xp.toLocaleString()} XP
                </Text>
              </>
            ) : me && !me.ranked ? (
              <>
                <Text style={[styles.meLabel, { color: p.muted }]}>{regionName}</Text>
                <Text style={[styles.meRank, { color: p.ink }]}>아직 집계 전이에요</Text>
                <Text style={[styles.meSub, { color: p.muted }]}>이 지역을 다녀온 집사가 아직 적어요. 조금 더 모이면 순위가 열려요.</Text>
              </>
            ) : (
              <>
                <Text style={[styles.meLabel, { color: p.muted }]}>{regionName}</Text>
                <Text style={[styles.meRank, { color: p.ink }]}>이 지역 기록이 아직 없어요</Text>
                <Text style={[styles.meSub, { color: p.muted }]}>
                  이 지역에서 판별하거나 리뷰를 남기면 순위에 들어가요{gamification ? ` (지금 집사 Lv.${gamification.level})` : ''}.
                </Text>
              </>
            )}
          </View>

          <View style={styles.list}>
            {data && data.items.length === 0 ? (
              <Text style={[styles.stateText, { color: p.muted, paddingVertical: 24 }]}>아직 이 지역에 집계된 집사가 없어요.</Text>
            ) : (
              data?.items.map((e) => (
                <View
                  key={`${e.rank}-${e.userId ?? e.nickname}`}
                  style={[
                    styles.row,
                    { borderColor: e.isMe ? p.accent : p.line, backgroundColor: e.isMe ? p.accentSoft : p.card },
                  ]}>
                  <Text style={[styles.rank, { color: e.rank <= 3 ? p.accent : p.muted }]}>{e.rank}</Text>
                  <View style={[styles.dot, { backgroundColor: TIER_COLOR_HEX[e.tierColor] }]} />
                  <Text style={[styles.nickname, { color: p.ink }]} numberOfLines={1}>
                    {e.nickname}
                    {e.isMe ? ' (나)' : ''}
                  </Text>
                  <Text style={[styles.level, { color: p.muted }]}>Lv.{e.level}</Text>
                  <Text style={[styles.xp, { color: p.ink }]}>{e.xp.toLocaleString()}</Text>
                </View>
              ))
            )}
          </View>

          <Text style={[styles.note, { color: p.muted }]}>{updatedText(data?.updatedAt ?? null)}</Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scopeRow: { flexDirection: 'row', gap: Spacing.sm },
  scopeItem: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: Radius.md, paddingVertical: 9 },
  scopeText: { fontSize: 13, fontWeight: '800' },
  chips: { gap: 6, paddingVertical: Spacing.sm, paddingRight: Spacing.lg },
  chip: { borderWidth: 1.5, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  chipSm: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  chipSmText: { fontSize: 12, fontWeight: '700' },
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
  dot: { width: 9, height: 9, borderRadius: 5 },
  nickname: { flex: 1, fontSize: 13.5, fontWeight: '800' },
  level: { fontSize: 12, fontWeight: '700' },
  xp: { width: 62, fontSize: 12.5, fontWeight: '800', textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: { fontSize: 11.5, textAlign: 'center', marginTop: Spacing.lg },
});
