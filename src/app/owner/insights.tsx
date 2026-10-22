import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedProps, useReducedMotion, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { CountUp } from '@/components/count-up';
import { TiltPressable } from '@/components/motion/tilt-pressable';
import { OwnerLoadState } from '@/components/owner-load-state';
import { Text } from '@/components/text';
import { ClayShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { completeness, confirmBadge, hesitations, isoWeek, upsertWeek, weekChange, type WeekSnap } from '@/data/owner-insights';
import { kstYmd } from '@/data/quest-journey';
import { useOwnerFacilities } from '@/hooks/use-owner-facilities';
import { useColorScheme, usePalette } from '@/hooks/use-theme';
import { inquiryApi, ownerApi, subscriptionApi, type OwnerDenialAlert } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { loadWeeks, saveWeeks } from '@/lib/owner-weeks';
import { loadWaitlist, saveWaitlist, type WaitlistRecord } from '@/lib/waitlist-store';
import { useAppStore } from '@/store/app-store';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * 반려 손님 리포트(무료판) — 사장님이 앱을 열 이유.
 *
 * 이번 주 숫자 → 매장 완성도(무엇을 하면 손님이 믿는지) → 확정 배지 → 손님이 망설인 이유 → 플러스 미리보기.
 * 숫자만 보여 주지 않고 **다음에 할 일**로 잇는다. 서버 인사이트 API 전까지 지금 있는 사장님 API로 만든다.
 */
export default function OwnerInsightsScreen() {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const router = useRouter();
  const reduce = useReducedMotion();
  const { facilityId: idParam } = useLocalSearchParams<{ facilityId?: string }>();
  const facilityId = Number(idParam);
  const { facilities, failed, refresh } = useOwnerFacilities();
  const facility = facilities?.find((f) => f.facilityId === facilityId) ?? null;
  const { session, myUserId } = useAppStore();
  const account = session.authed ? (myUserId != null ? `u${myUserId}` : session.email ? `e${session.email}` : '') : null;
  const today = kstYmd();
  const week = isoWeek(today);

  const [extra, setExtra] = useState<{ interest: number; inquiries: number; benefits: number; denials: OwnerDenialAlert[] } | null>(null);
  const [weeks, setWeeks] = useState<WeekSnap[]>([]);

  useEffect(() => {
    if (!Number.isFinite(facilityId)) return;
    let alive = true;
    void Promise.all([
      ownerApi.reviewStats(facilityId).then((s) => s.interestCount).catch(() => 0),
      inquiryApi.count(facilityId).catch(() => 0),
      ownerApi.benefits(facilityId).then((b) => b.filter((x) => x.isEnabled).length).catch(() => 0),
      ownerApi.denialAlerts(facilityId).catch(() => [] as OwnerDenialAlert[]),
    ]).then(([interest, inquiries, benefits, denials]) => {
      if (alive) setExtra({ interest, inquiries, benefits, denials });
    });
    return () => {
      alive = false;
    };
  }, [facilityId]);

  // 이번 주 숫자를 남기고, 지난 주들과 비교한다
  const checks = facility?.stats.weeklyPetCheckCount ?? 0;
  const reviews = facility?.stats.reviewCount ?? 0;
  useEffect(() => {
    if (!account || !facility || !extra) return;
    let alive = true;
    void loadWeeks(account, facility.facilityId).then((list) => {
      const next = upsertWeek(list, { week, checks, interest: extra.interest, inquiries: extra.inquiries, reviews });
      void saveWeeks(account, facility.facilityId, next);
      if (alive) setWeeks(next);
    });
    return () => {
      alive = false;
    };
  }, [account, facility, extra, week, checks, reviews]);

  const comp = useMemo(() => (facility ? completeness(facility, extra?.benefits ?? 0, today) : null), [facility, extra, today]);
  const badge = facility ? confirmBadge(facility.entryCondition.confirmedAt, today) : null;
  const why = useMemo(() => hesitations((extra?.denials ?? []).map((d) => d.reason), extra?.inquiries ?? 0), [extra]);
  const change = weekChange(weeks, week, 'checks');

  if (!facility || !comp || !badge) {
    return (
      <View style={[styles.fill, { backgroundColor: p.surface }]}>
        <Stack.Screen options={{ title: '반려 손님 리포트', headerBackButtonDisplayMode: 'minimal' }} />
        <OwnerLoadState facilities={facilities} failed={failed} refresh={refresh} />
      </View>
    );
  }
  const go = (to: string) => router.push({ pathname: to as never, params: { facilityId: String(facility.facilityId) } });
  const todo = comp.items.filter((i) => !i.done);

  return (
    <View style={[styles.fill, { backgroundColor: p.surface }]}>
      <Stack.Screen options={{ title: '반려 손님 리포트', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* 이번 주 */}
        <Animated.View entering={reduce ? undefined : FadeInDown.duration(320)} style={[styles.hero, { boxShadow: clay.rest }]}>
          <LinearGradient colors={[p.accentSoft, p.card]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <Text style={[styles.heroEyebrow, { color: p.accentDark }]}>{facility.name} · 이번 주</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroMain}>
              <Text style={[styles.heroLabel, { color: p.ink }]}>반려 손님이 우리 매장을</Text>
              <View style={styles.bigRow}>
                <CountUp value={checks} style={[styles.big, { color: p.ink }]} />
                <Text style={[styles.bigUnit, { color: p.ink }]}>번 판별했어요</Text>
              </View>
              {change != null ? (
                <View style={[styles.delta, { backgroundColor: change >= 0 ? p.successSoft : p.dangerSoft }]}>
                  <Ionicons name={change >= 0 ? 'trending-up' : 'trending-down'} size={13} color={change >= 0 ? p.success : p.danger} />
                  <Text style={[styles.deltaText, { color: change >= 0 ? p.success : p.danger }]}>
                    지난주보다 {Math.abs(Math.round(change * 100))}% {change >= 0 ? '늘었어요' : '줄었어요'}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.note, { color: p.muted }]}>다음 주부터 지난주와 비교해 드려요</Text>
              )}
            </View>
            {weeks.length >= 2 ? <Spark data={weeks.map((w) => w.checks)} color={p.accent} /> : null}
          </View>
          <View style={[styles.metrics, { borderTopColor: p.line }]}>
            <Metric label="관심 저장" value={extra?.interest} />
            <Metric label="조건 문의" value={extra?.inquiries} />
            <Metric label="리뷰" value={reviews} />
          </View>
          <Text style={[styles.note, { color: p.muted }]}>같은 손님이 여러 번 판별·문의하면 그만큼 세요.</Text>
        </Animated.View>

        {/* 매장 완성도 */}
        <View style={[styles.card, { backgroundColor: p.card, boxShadow: clay.rest }]}>
          <View style={styles.compHead}>
            <Ring value={comp.score} />
            <View style={styles.compText}>
              <Text style={[styles.cardTitle, { color: p.ink }]}>매장 완성도</Text>
              <Text style={[styles.cardSub, { color: p.muted }]}>
                {todo.length === 0 ? '손님이 믿고 올 준비가 다 됐어요!' : `${todo.length}가지만 더 하면 손님이 더 믿고 와요`}
              </Text>
            </View>
          </View>
          {comp.items.map((i, k) => (
            <Animated.View key={i.id} entering={reduce ? undefined : FadeInDown.delay(80 + k * 40).duration(240)}>
              <Pressable
                onPress={i.done ? undefined : () => go(i.to)}
                accessibilityRole={i.done ? undefined : 'button'}
                style={({ pressed }) => [styles.compRow, { backgroundColor: i.done ? 'transparent' : p.surface, opacity: pressed ? 0.85 : 1 }]}>
                <Ionicons name={i.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={i.done ? p.success : p.line} />
                <View style={styles.compRowText}>
                  <Text style={[styles.compLabel, { color: i.done ? p.muted : p.ink }]}>{i.label}</Text>
                  {!i.done ? <Text style={[styles.compHint, { color: p.muted }]}>{i.hint}</Text> : null}
                </View>
                {!i.done ? <Ionicons name="chevron-forward" size={16} color={p.accentDark} /> : null}
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* 확정 배지 */}
        <View style={[styles.badgeCard, { backgroundColor: badge.state === 'active' ? p.successSoft : badge.state === 'none' ? p.card : p.warnSoft }]}>
          <Ionicons
            name={badge.state === 'active' ? 'shield-checkmark' : 'shield-outline'}
            size={26}
            color={badge.state === 'active' ? p.success : badge.state === 'none' ? p.muted : p.warn}
          />
          <View style={styles.badgeText}>
            <Text style={[styles.cardTitle, { color: p.ink }]}>
              {badge.state === 'none'
                ? '확정 배지가 아직 없어요'
                : badge.state === 'expired'
                  ? `확정이 ${badge.daysAgo}일 전에 끝났어요`
                  : `확정 배지 ${badge.daysLeft}일 남았어요`}
            </Text>
            <Text style={[styles.cardSub, { color: p.muted }]}>
              {badge.state === 'active'
                ? '손님 화면에 "확정"이 붙어 있어요. 90일마다 한 번 다시 확인해 주세요.'
                : '조건이 그대로여도 다시 확인을 누르면 배지가 90일 이어져요.'}
            </Text>
          </View>
          {badge.state !== 'active' ? (
            <Pressable onPress={() => go('/owner/conditions')} accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: p.accent }]}>
              <Text style={[styles.smallBtnText, { color: p.onAccent }]}>{badge.state === 'none' ? '확정하기' : '다시 확인'}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* 망설인 이유 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: p.ink }]}>손님이 망설인 이유</Text>
          {why.length ? (
            why.map((w) => (
              <View key={w.key} style={[styles.whyRow, { backgroundColor: p.card }]}>
                <View style={[styles.whyCount, { backgroundColor: w.key === 'INQUIRY' ? p.accentSoft : p.dangerSoft }]}>
                  <Text style={[styles.whyCountText, { color: w.key === 'INQUIRY' ? p.accentDark : p.danger }]}>{w.count}</Text>
                </View>
                <View style={styles.whyText}>
                  <Text style={[styles.whyTitle, { color: p.ink }]}>{w.title}</Text>
                  <Text style={[styles.whyBody, { color: p.muted }]}>{w.body}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.whyRow, { backgroundColor: p.successSoft }]}>
              <Ionicons name="happy-outline" size={22} color={p.success} />
              <Text style={[styles.whyBody, { color: p.ink, flex: 1 }]}>최근 거부 제보도, 조건 문의도 없어요. 지금처럼만 해 주세요!</Text>
            </View>
          )}
        </View>

        {/* 사장님 플러스 미리보기 */}
        <PlusPreview account={account} />
      </ScrollView>
    </View>
  );
}

/* ───────── 조각 ───────── */

function Metric({ label, value }: { label: string; value: number | undefined }) {
  const p = usePalette();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: p.ink }]}>{value == null ? '–' : value.toLocaleString()}</Text>
      <Text style={[styles.metricLabel, { color: p.muted }]}>{label}</Text>
    </View>
  );
}

/** 최근 주들 판별 수 — 작은 선 그래프 */
function Spark({ data, color }: { data: number[]; color: string }) {
  const W = 96;
  const H = 44;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? W / (data.length - 1) : W;
  const pts = data.map((v, i) => [i * step, H - 4 - (v / max) * (H - 10)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={W} height={H} viewBox={`-4 0 ${W + 8} ${H}`} accessibilityLabel={`최근 ${data.length}주 판별 수 추이`}>
      <Path d={`${d} L${last[0]} ${H} L0 ${H} Z`} fill={color} opacity={0.12} />
      <Path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={4} fill={color} />
    </Svg>
  );
}

function Ring({ value }: { value: number }) {
  const p = usePalette();
  const reduce = useReducedMotion();
  const R = 26;
  const C = 2 * Math.PI * R;
  const v = useSharedValue(reduce ? value : 0);
  useEffect(() => {
    v.set(reduce ? value : withTiming(value, { duration: 700 }));
  }, [value, reduce, v]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - v.value) }));
  return (
    <View style={styles.ring} accessible accessibilityLabel={`매장 완성도 ${Math.round(value * 100)}%`}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle cx={32} cy={32} r={R} stroke={p.line} strokeWidth={7} fill="none" />
        <AnimatedCircle cx={32} cy={32} r={R} stroke={value >= 1 ? p.success : p.accent} strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray={`${C} ${C}`} animatedProps={props} transform="rotate(-90 32 32)" />
      </Svg>
      <Text style={[styles.ringText, { color: p.ink }]}>{Math.round(value * 100)}</Text>
    </View>
  );
}

/** 플러스 기능을 흐릿하게 미리 보여 주고 사전 신청을 받는다 */
function PlusPreview({ account }: { account: string | null }) {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const reduce = useReducedMotion();
  const [rec, setRec] = useState<WaitlistRecord | null | undefined>(undefined);
  useEffect(() => {
    if (!account) return;
    let alive = true;
    void loadWaitlist(account, 'OWNER_PLUS').then((r) => alive && setRec(r));
    return () => {
      alive = false;
    };
  }, [account]);
  const join = async () => {
    if (!account) return;
    haptic.success();
    const r: WaitlistRecord = { product: 'OWNER_PLUS', interests: ['insightsTrend', 'areaCompare', 'coupon'], joinedAt: new Date().toISOString(), synced: false };
    await saveWaitlist(account, r);
    setRec(r);
    try {
      await subscriptionApi.joinWaitlist('OWNER_PLUS', r.interests);
      const done = { ...r, synced: true };
      await saveWaitlist(account, done);
      setRec(done);
    } catch {
      // 서버가 아직 없으면 기기 기록만 — 신청은 받은 것이다
    }
  };
  return (
    <View style={[styles.card, { backgroundColor: p.card, boxShadow: clay.rest }]}>
      <View style={styles.plusHead}>
        <View style={[styles.plusTag, { backgroundColor: p.ink }]}>
          <Text style={[styles.plusTagText, { color: p.bg }]}>사장님 플러스 · 출시 예정</Text>
        </View>
      </View>
      <Text style={[styles.cardTitle, { color: p.ink }]}>더 깊이 보는 리포트</Text>
      {/* 흐린 미리보기 — 실제 값이 아니라 모양만 */}
      <View style={styles.blurBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height={96} viewBox="0 0 300 96" preserveAspectRatio="none">
          {[18, 34, 26, 48, 40, 62, 56, 74].map((h, i) => (
            <Rect key={i} x={10 + i * 36} y={90 - h} width={22} height={h} rx={6} fill={p.accent} opacity={0.18 + i * 0.04} />
          ))}
        </Svg>
        <View style={[styles.lock, { backgroundColor: p.card }]}>
          <Ionicons name="lock-closed" size={16} color={p.ink} />
        </View>
      </View>
      {['날짜별 추이 · 90일', '같은 동네·업종 안에서 우리 순위', '반려견 크기 분포', '도장 찍은 손님에게 단골 쿠폰'].map((t) => (
        <View key={t} style={styles.plusItem}>
          <Ionicons name="sparkles" size={13} color={p.accentDark} />
          <Text style={[styles.plusItemText, { color: p.ink }]}>{t}</Text>
        </View>
      ))}
      {rec ? (
        <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(13)} style={[styles.joined, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="checkmark-circle" size={18} color={p.accentDark} />
          <Text style={[styles.joinedText, { color: p.ink }]}>사전 신청했어요. 출시되면 가장 먼저 알려 드릴게요.</Text>
        </Animated.View>
      ) : rec === null ? (
        <TiltPressable onPress={join} accessibilityRole="button" maxTilt={2} style={(pressed) => [styles.cta, { backgroundColor: pressed ? p.accentDark : p.accent }]}>
          <Ionicons name="notifications" size={17} color={p.onAccent} />
          <Text style={[styles.ctaText, { color: p.onAccent }]}>출시 알림 받기</Text>
        </TiltPressable>
      ) : null}
      <Text style={[styles.note, { color: p.muted }]}>신청은 결제가 아니에요. 지금 보이는 리포트는 계속 무료예요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.lg, paddingBottom: 60, gap: Spacing.lg },
  hero: { borderRadius: Radius.xl, padding: Spacing.lg, gap: 10, overflow: 'hidden' },
  heroEyebrow: { fontSize: Type.footnote, fontWeight: '900' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  heroMain: { flex: 1, gap: 4 },
  heroLabel: { fontSize: Type.callout, fontWeight: '800' },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' },
  big: { fontSize: 44, lineHeight: 50, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  bigUnit: { fontSize: Type.sheetTitle, fontWeight: '900' },
  delta: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  deltaText: { fontSize: Type.caption, fontWeight: '900' },
  metrics: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricValue: { fontSize: Type.headline, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: Type.caption, fontWeight: '700' },
  note: { fontSize: Type.caption, lineHeight: 16 },
  card: { borderRadius: Radius.xl, padding: Spacing.lg, gap: 8 },
  cardTitle: { fontSize: Type.cardTitle, fontWeight: '900' },
  cardSub: { fontSize: Type.footnote, lineHeight: 18 },
  compHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  compText: { flex: 1, gap: 2 },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 10 },
  compRowText: { flex: 1, gap: 2 },
  compLabel: { fontSize: Type.bodyLg, fontWeight: '800' },
  compHint: { fontSize: Type.caption, lineHeight: 16 },
  ring: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', fontSize: Type.callout, fontWeight: '900', fontVariant: ['tabular-nums'] },
  badgeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, padding: Spacing.lg },
  badgeText: { flex: 1, gap: 2 },
  smallBtn: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  smallBtnText: { fontSize: Type.caption, fontWeight: '900' },
  section: { gap: 8 },
  sectionTitle: { fontSize: Type.sheetTitle, fontWeight: '900' },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.md, padding: Spacing.md },
  whyCount: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  whyCountText: { fontSize: Type.callout, fontWeight: '900' },
  whyText: { flex: 1, gap: 2 },
  whyTitle: { fontSize: Type.bodyLg, fontWeight: '800' },
  whyBody: { fontSize: Type.caption, lineHeight: 16 },
  plusHead: { flexDirection: 'row' },
  plusTag: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  plusTagText: { fontSize: Type.micro, fontWeight: '900' },
  blurBox: { borderRadius: Radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  lock: { position: 'absolute', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  plusItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  plusItemText: { fontSize: Type.body, fontWeight: '700' },
  joined: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: Spacing.md, marginTop: 4 },
  joinedText: { flex: 1, fontSize: Type.footnote, fontWeight: '800' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.full, paddingVertical: 14, marginTop: 4 },
  ctaText: { fontSize: Type.callout, fontWeight: '900' },
});
