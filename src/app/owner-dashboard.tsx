import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PawBadge } from '@/components/paw-badge';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { pawGradeOf, sinceText } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * 사업자 프로필의 홈 — docs/10 대시보드 1차안.
 * 일반 프로필과 완전히 다른 화면 세트의 진입점. (탭바 없이 단독 화면으로 시작)
 */
export default function OwnerDashboard() {
  const p = usePalette();
  const router = useRouter();
  const { businessRegs, reviewsOf, recentDenialsOf, checks, session, switchProfile, logout } =
    useAppStore();

  const owned = Object.values(businessRegs)
    .map((reg) => FACILITIES.find((f) => f.facilityId === reg.facilityId))
    .filter((f): f is NonNullable<typeof f> => !!f);
  // 관리 메뉴는 대표(첫) 매장 기준으로 연다 — 데모는 보통 한 곳
  const primaryId = owned[0]?.facilityId;
  const go = (path: '/owner/promotion' | '/owner/benefits' | '/owner/stats') =>
    primaryId != null && router.push({ pathname: path, params: { facilityId: String(primaryId) } });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, { color: p.accent }]}>사업자 대시보드</Text>
              <Text style={[styles.title, { color: p.ink }]}>내 매장 관리</Text>
            </View>
            <Pressable
              onPress={switchProfile}
              style={[styles.switchBtn, { backgroundColor: p.accentSoft }]}>
              <Ionicons name="swap-horizontal" size={15} color={p.accent} />
              <Text style={[styles.switchText, { color: p.accent }]}>프로필 전환</Text>
            </Pressable>
          </View>

          {owned.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: p.surface, borderColor: p.line }]}>
              <Ionicons name="storefront-outline" size={30} color={p.muted} />
              <Text style={[styles.emptyText, { color: p.muted }]}>
                아직 등록한 매장이 없어요.{'\n'}사업자등록번호를 인증하고 내 매장을 등록해보세요.
              </Text>
              <Pressable
                onPress={() => router.push('/business')}
                style={[styles.emptyBtn, { backgroundColor: p.accent }]}>
                <Text style={[styles.emptyBtnText, { color: p.onAccent }]}>내 매장 등록하기</Text>
              </Pressable>
            </View>
          ) : (
            owned.map((f) => {
              const grade = pawGradeOf(reviewsOf(f.facilityId));
              const denials = recentDenialsOf(f.facilityId);
              const checkCount = checks.filter((c) => c.facilityId === f.facilityId).length;
              return (
                <View key={f.facilityId} style={styles.storeBlock}>
                  {/* 매장 요약 */}
                  <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                    <View style={styles.storeHead}>
                      <Text style={[styles.storeName, { color: p.ink }]}>{f.name}</Text>
                      <View style={[styles.confirmBadge, { backgroundColor: p.successSoft }]}>
                        <Ionicons name="shield-checkmark" size={12} color={p.success} />
                        <Text style={[styles.confirmText, { color: p.success }]}>확정 · 사업자 확인</Text>
                      </View>
                    </View>
                    <View style={styles.metrics}>
                      <Metric label="발자국 등급">
                        {grade.level ? (
                          <PawBadge grade={grade} size="sm" />
                        ) : (
                          <Text style={[styles.metricValue, { color: p.muted }]}>수집 중</Text>
                        )}
                      </Metric>
                      <View style={[styles.metricDivider, { backgroundColor: p.line }]} />
                      <Metric label="이번 주 판별">
                        <Text style={[styles.metricValue, { color: p.ink }]}>{checkCount}회</Text>
                      </Metric>
                      <View style={[styles.metricDivider, { backgroundColor: p.line }]} />
                      <Metric label="리뷰">
                        <Text style={[styles.metricValue, { color: p.ink }]}>{grade.count}건</Text>
                      </Metric>
                    </View>
                  </View>

                  {/* 거부 제보 알림 */}
                  {denials.length > 0 && (
                    <Pressable
                      onPress={() => router.push('/business')}
                      style={[styles.alert, { backgroundColor: p.dangerSoft, borderColor: p.danger }]}>
                      <Ionicons name="warning" size={18} color={p.danger} />
                      <View style={styles.alertText}>
                        <Text style={[styles.alertTitle, { color: p.danger }]}>
                          최근 거부 제보 {denials.length}건
                        </Text>
                        <Text style={[styles.alertBody, { color: p.ink }]}>
                          {denials[0].content} · {sinceText(denials[0].createdAt)} — 조건을 다시 확인해
                          주세요
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}

          {/* 관리 메뉴 */}
          <View style={styles.menuGroup}>
            <Text style={[styles.menuHead, { color: p.muted }]}>매장 관리</Text>
            <View style={[styles.menuCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
              <MenuRow
                icon="clipboard-outline"
                label="출입 조건 관리"
                sub="동반 가능·체중·필수 조건을 직접 확정"
                onPress={() => router.push('/business')}
              />
              <MenuRow
                icon="image-outline"
                label="매장 소개·홍보"
                sub="대표 사진·소개글·편의시설 태그"
                onPress={() => go('/owner/promotion')}
              />
              <MenuRow
                icon="pricetag-outline"
                label="방문 혜택 안내"
                sub="출입증 제시 시 혜택 등"
                onPress={() => go('/owner/benefits')}
              />
              <MenuRow
                icon="stats-chart-outline"
                label="리뷰·통계"
                sub="등급 추이·항목 평균·관심도"
                onPress={() => go('/owner/stats')}
                last
              />
            </View>
          </View>

          {/* 계정 */}
          <View style={styles.menuGroup}>
            <View style={[styles.menuCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
              <MenuRow icon="swap-horizontal-outline" label="일반 프로필로 전환" onPress={switchProfile} />
              <MenuRow icon="log-out-outline" label="로그아웃" onPress={logout} tint last />
            </View>
          </View>

          <Text style={[styles.footer, { color: p.muted }]}>
            {session.email ?? ''} · 사업자 프로필
          </Text>
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

function MenuRow({
  icon,
  label,
  sub,
  onPress,
  tag,
  tint,
  last,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  onPress?: () => void;
  tag?: string;
  tint?: boolean;
  last?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: p.line },
        { opacity: pressed && onPress ? 0.6 : 1 },
      ]}>
      <Ionicons name={icon} size={20} color={tint ? p.accent : p.muted} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tint ? p.accent : p.ink }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: p.muted }]}>{sub}</Text> : null}
      </View>
      {tag ? (
        <View style={[styles.rowTag, { backgroundColor: p.surface }]}>
          <Text style={[styles.rowTagText, { color: p.muted }]}>{tag}</Text>
        </View>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={17} color={p.muted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, paddingBottom: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: Spacing.sm },
  headerText: { gap: 2 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  switchText: { fontSize: 12.5, fontWeight: '800' },
  storeBlock: { gap: Spacing.md },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  storeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  storeName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 },
  confirmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confirmText: { fontSize: 10.5, fontWeight: '800' },
  metrics: { flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, alignItems: 'center', gap: 5 },
  metricLabel: { fontSize: 11, fontWeight: '700' },
  metricValue: { fontSize: 15, fontWeight: '800' },
  metricDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  alertText: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 13.5, fontWeight: '800' },
  alertBody: { fontSize: 12, lineHeight: 17 },
  menuGroup: { gap: Spacing.sm },
  menuHead: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3, paddingLeft: 4 },
  menuCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 14.5, fontWeight: '700' },
  rowSub: { fontSize: 12 },
  rowTag: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  rowTagText: { fontSize: 10.5, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: '800' },
  footer: { fontSize: 11.5, textAlign: 'center', paddingTop: Spacing.sm },
});
