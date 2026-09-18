import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { ConfidenceBadge } from '@/components/confidence-badge';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { CATEGORY_LABEL, sinceText } from '@/data/types';
import { useOwnerFacilities } from '@/hooks/use-owner-facilities';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

type IconName = ComponentProps<typeof Ionicons>['name'];

const DENIAL_REASON: Record<string, string> = {
  WEIGHT: '체중 초과',
  BREED: '품종',
  INDOOR: '실내 불가',
  POLICY_CHANGED: '정책 변경',
  CROWDED: '혼잡',
  OTHER: '기타',
};

/**
 * 사업자 프로필의 홈 — `GET /owner/facilities` 한 번으로 카드를 전부 그린다.
 * 승인된 매장만 온다. 대기·반려는 위 「신청 현황」이 보여준다.
 */
export default function OwnerDashboard() {
  const p = usePalette();
  const router = useRouter();
  const { myClaims, session, switchProfile, logout } = useAppStore();
  const { facilities, failed, refresh } = useOwnerFacilities();

  const owned = facilities ?? [];
  // 매장이 여러 곳이면 관리 대상 매장을 고를 수 있다
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // 목록이 갱신돼 고른 매장이 빠졌으면(승인 해제 등) 첫 매장으로 — 남은 게 하나면 카드를 눌러 바꿀 수도 없다
  const activeId = selectedId != null && owned.some((f) => f.facilityId === selectedId) ? selectedId : (owned[0]?.facilityId ?? null);
  const multi = owned.length > 1;
  const activeName = owned.find((f) => f.facilityId === activeId)?.name;
  const go = (path: '/owner/promotion' | '/owner/benefits' | '/owner/stats' | '/owner/conditions' | '/owner/denials') =>
    activeId != null && router.push({ pathname: path, params: { facilityId: String(activeId) } });

  const pending = myClaims.filter((c) => c.status !== 'APPROVED');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, { color: p.accent }]}>사업자 대시보드</Text>
              <Text style={[styles.title, { color: p.ink }]}>내 매장 관리</Text>
            </View>
            <Pressable onPress={switchProfile} style={[styles.switchBtn, { backgroundColor: p.accentSoft }]}>
              <Ionicons name="swap-horizontal" size={15} color={p.accent} />
              <Text style={[styles.switchText, { color: p.accent }]}>프로필 전환</Text>
            </Pressable>
          </View>

          {/* 신청 현황 — 승인 전 매장은 아래 목록에 없다. 여기서 "검토 중"을 봐야 사라진 줄 모른다 */}
          {pending.length > 0 && (
            <View style={[styles.claims, { backgroundColor: p.surface, borderColor: p.line }]}>
              <Text style={[styles.claimsTitle, { color: p.ink }]}>신청 현황</Text>
              {pending.map((c) => {
                const meta =
                  c.status === 'PENDING'
                    ? { label: '검토 중', color: p.accent, icon: 'hourglass-outline' as const }
                    : c.status === 'REJECTED'
                      ? { label: '반려', color: p.danger, icon: 'close-circle-outline' as const }
                      : { label: '승인 해제', color: p.muted, icon: 'remove-circle-outline' as const };
                return (
                  <View key={c.claimId} style={styles.claimRow}>
                    <Ionicons name={meta.icon} size={16} color={meta.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.claimName, { color: p.ink }]} numberOfLines={1}>{c.facilityName}</Text>
                      <Text style={[styles.claimMeta, { color: p.muted }]} numberOfLines={2}>
                        {c.appliedAt ? `${c.appliedAt.slice(0, 10)} 신청` : ''}
                        {c.status !== 'PENDING' && c.reviewReason
                          ? ` · ${c.reviewReason}`
                          : c.status === 'REJECTED'
                            ? ' · 등록증과 매장 정보를 확인해 다시 신청해 주세요'
                            : ''}
                      </Text>
                    </View>
                    <Text style={[styles.claimStatus, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {failed ? (
            <Pressable onPress={() => void refresh()} style={[styles.empty, { backgroundColor: p.surface, borderColor: p.line }]}>
              <Ionicons name="cloud-offline-outline" size={30} color={p.muted} />
              <Text style={[styles.emptyText, { color: p.muted }]}>매장 정보를 불러오지 못했어요. 눌러서 다시 시도</Text>
            </Pressable>
          ) : facilities === null ? (
            <ActivityIndicator color={p.accent} style={{ paddingVertical: 32 }} />
          ) : owned.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: p.surface, borderColor: p.line }]}>
              <Ionicons name="storefront-outline" size={30} color={p.muted} />
              <Text style={[styles.emptyText, { color: p.muted }]}>
                {pending.some((c) => c.status === 'PENDING')
                  ? '운영자가 사업자등록증을 확인하면 여기에 매장이 나와요.'
                  : `아직 등록한 매장이 없어요.${'\n'}사업자등록증을 준비해 내 매장을 등록해보세요.`}
              </Text>
              <Pressable onPress={() => router.push('/business')} style={[styles.emptyBtn, { backgroundColor: p.accent }]}>
                <Text style={[styles.emptyBtnText, { color: p.onAccent }]}>내 매장 등록하기</Text>
              </Pressable>
            </View>
          ) : (
            owned.map((f) => {
              const c = f.entryCondition;
              const selected = f.facilityId === activeId;
              return (
                <View key={f.facilityId} style={styles.storeBlock}>
                  {/* 매장 요약 — 매장이 여러 곳이면 탭해서 관리 대상으로 선택 */}
                  <Pressable
                    onPress={multi ? () => setSelectedId(f.facilityId) : undefined}
                    style={[
                      styles.card,
                      CardShadow,
                      {
                        backgroundColor: p.card,
                        borderColor: multi && selected ? p.accent : p.line,
                        borderWidth: multi && selected ? 1.5 : StyleSheet.hairlineWidth,
                      },
                    ]}>
                    <View style={styles.storeHead}>
                      <View style={{ flexShrink: 1 }}>
                        <Text style={[styles.storeName, { color: p.ink }]}>{f.name}</Text>
                        <Text style={[styles.storeMeta, { color: p.muted }]} numberOfLines={1}>
                          {CATEGORY_LABEL[f.category]}{f.address ? ` · ${f.address}` : ''}
                        </Text>
                      </View>
                      {multi && selected ? (
                        <View style={[styles.confirmBadge, { backgroundColor: p.accentSoft }]}>
                          <Ionicons name="radio-button-on" size={12} color={p.accent} />
                          <Text style={[styles.confirmText, { color: p.accent }]}>관리 중</Text>
                        </View>
                      ) : (
                        // 서버가 매 조회 시점에 계산한 신뢰도. 거부 제보가 있으면 확정이어도 확정 배지가 아니다
                        <ConfidenceBadge confidence={c.confidence} size="sm" />
                      )}
                    </View>
                    <View style={styles.metrics}>
                      <Metric label="동반">
                        <Text style={[styles.metricValue, { color: c.petAllowed === 'ALLOWED' ? p.success : c.petAllowed === 'DENIED' ? p.danger : p.muted }]}>
                          {c.petAllowed === 'ALLOWED' ? '가능' : c.petAllowed === 'DENIED' ? '불가' : '미정'}
                        </Text>
                      </Metric>
                      <View style={[styles.metricDivider, { backgroundColor: p.line }]} />
                      <Metric label="이번 주 판별">
                        <Text style={[styles.metricValue, { color: p.ink }]}>{f.stats.weeklyPetCheckCount}회</Text>
                      </Metric>
                      <View style={[styles.metricDivider, { backgroundColor: p.line }]} />
                      <Metric label="리뷰">
                        <Text style={[styles.metricValue, { color: p.ink }]}>{f.stats.reviewCount}건</Text>
                      </Metric>
                    </View>
                    {c.conditionRaw ? (
                      <Text style={[styles.condition, { color: p.muted }]} numberOfLines={2}>{c.conditionRaw}</Text>
                    ) : null}
                  </Pressable>

                  {/* 거부 제보 경고 — 신뢰도를 내리고 있는 제보. 탭하면 전체 목록 */}
                  {f.denialAlerts.count > 0 && (
                    <Pressable
                      onPress={() => router.push({ pathname: '/owner/denials', params: { facilityId: String(f.facilityId) } })}
                      style={[styles.alert, { backgroundColor: p.dangerSoft, borderColor: p.danger }]}>
                      <Ionicons name="warning" size={18} color={p.danger} />
                      <View style={styles.alertText}>
                        <Text style={[styles.alertTitle, { color: p.danger }]}>최근 거부 제보 {f.denialAlerts.count}건</Text>
                        <Text style={[styles.alertBody, { color: p.ink }]}>
                          {f.denialAlerts.latest
                            ? `${DENIAL_REASON[f.denialAlerts.latest.reason] ?? f.denialAlerts.latest.reason} · ${sinceText(f.denialAlerts.latest.reportedAt)}`
                            : ''}{' '}
                          — 조건을 다시 확인해 주세요
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={p.danger} />
                    </Pressable>
                  )}
                </View>
              );
            })
          )}

          {owned.length > 0 && (
            <View style={styles.menuGroup}>
              <Text style={[styles.menuHead, { color: p.muted }]}>
                {multi && activeName ? `매장 관리 · ${activeName}` : '매장 관리'}
              </Text>
              <View style={[styles.menuCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                <MenuRow icon="clipboard-outline" label="출입 조건 관리" sub="동반 가능·체중·필수 조건을 직접 수정 (재심사 없음)" onPress={() => go('/owner/conditions')} />
                <MenuRow icon="image-outline" label="매장 소개·홍보" sub="소개글·편의시설 태그" onPress={() => go('/owner/promotion')} />
                <MenuRow icon="pricetag-outline" label="방문 혜택 안내" sub="출입증 제시 시 혜택 등" onPress={() => go('/owner/benefits')} />
                <MenuRow icon="stats-chart-outline" label="리뷰·통계" sub="등급 추이·항목 평균·관심도" onPress={() => go('/owner/stats')} last />
              </View>
            </View>
          )}

          <View style={styles.menuGroup}>
            <View style={[styles.menuCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
              <MenuRow icon="add-circle-outline" label="매장 추가 등록" onPress={() => router.push('/business')} />
              <MenuRow icon="storefront-outline" label="목록에 없는 매장 직접 등록" onPress={() => router.push('/business/new')} />
              <MenuRow icon="swap-horizontal-outline" label="일반 프로필로 전환" onPress={switchProfile} />
              <MenuRow icon="log-out-outline" label="로그아웃" onPress={() => logout()} tint last />
            </View>
          </View>
          <Text style={[styles.footer, { color: p.muted }]}>{session.email ?? ''} · 사업자 프로필</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: p.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

function MenuRow({ icon, label, sub, onPress, tint, last }: { icon: IconName; label: string; sub?: string; onPress?: () => void; tint?: boolean; last?: boolean }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: p.line }, { opacity: pressed && onPress ? 0.6 : 1 }]}>
      <Ionicons name={icon} size={20} color={tint ? p.accent : p.muted} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tint ? p.accent : p.ink }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: p.muted }]}>{sub}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={17} color={p.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  claims: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: 10 },
  claimsTitle: { fontSize: 14, fontWeight: '800' },
  claimRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  claimName: { fontSize: 14, fontWeight: '700' },
  claimMeta: { fontSize: 11.5, marginTop: 1 },
  claimStatus: { fontSize: 12, fontWeight: '800' },
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, paddingBottom: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: Spacing.sm },
  headerText: { gap: 2 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 28, lineHeight: 38, fontWeight: '900', letterSpacing: -1 },
  switchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  switchText: { fontSize: 12.5, fontWeight: '800' },
  storeBlock: { gap: Spacing.md },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  storeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  storeName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 },
  storeMeta: { fontSize: 11.5, marginTop: 2 },
  confirmBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  confirmText: { fontSize: 10.5, fontWeight: '800' },
  metrics: { flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, alignItems: 'center', gap: 5 },
  metricLabel: { fontSize: 11, fontWeight: '700' },
  metricValue: { fontSize: 15, fontWeight: '800' },
  metricDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  condition: { fontSize: 12.5, lineHeight: 18 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md },
  alertText: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 13.5, fontWeight: '800' },
  alertBody: { fontSize: 12, lineHeight: 17 },
  menuGroup: { gap: Spacing.sm },
  menuHead: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3, paddingLeft: 4 },
  menuCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 14.5, fontWeight: '700' },
  rowSub: { fontSize: 12 },
  empty: { alignItems: 'center', gap: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: '800' },
  footer: { fontSize: 11.5, textAlign: 'center', paddingTop: Spacing.sm },
});
