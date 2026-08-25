import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { sinceText } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { DENIAL_REASON_LABEL, useAppStore } from '@/store/app-store';

/**
 * 알림 — 홈 우측 상단 종 버튼으로 진입한다.
 * 흩어져 있던 푸시성 알림(현장 거부·접종 기한 등)을 한곳에 모은다.
 * 실제 푸시 발송은 백엔드/expo-notifications 연동 시. 지금은 앱이 계산하는 알림만 표시.
 */
export default function NotificationsScreen() {
  const p = usePalette();
  const router = useRouter();
  const { plannedDenialAlerts, upcomingVaccinations } = useAppStore();
  const denials = plannedDenialAlerts();
  const vax = upcomingVaccinations();
  const empty = denials.length === 0 && vax.length === 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '알림' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: p.ink }]}>알림</Text>
            <Text style={[styles.sub, { color: p.muted }]}>
              가려던 곳의 현장 거부, 접종 기한 등 중요한 소식을 모아 드려요.
            </Text>
          </View>

          {empty && (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={30} color={p.muted} />
              <Text style={[styles.emptyText, { color: p.muted }]}>
                새로운 알림이 없어요.{'\n'}중요한 소식이 생기면 여기에 모아 드릴게요.
              </Text>
            </View>
          )}

          {/* 현장 거부 — 가장 시급하므로 위에 */}
          {denials.map(({ facility, report }) => (
            <Pressable
              key={`denial-${facility.facilityId}`}
              onPress={() =>
                router.push({ pathname: '/facility/[id]', params: { id: String(facility.facilityId) } })
              }
              style={({ pressed }) => [
                styles.denialCard,
                CardShadow,
                { backgroundColor: p.danger, opacity: pressed ? 0.92 : 1 },
              ]}>
              <View style={styles.bell}>
                <Ionicons name="notifications" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.cardText}>
                <View style={styles.denialTitleRow}>
                  <Text style={styles.denialLabel}>실시간 거부</Text>
                  <Text style={styles.denialTitle}>가려던 곳에 거부가 떴어요</Text>
                </View>
                <Text style={styles.denialBody} numberOfLines={2}>
                  {facility.name} · {report.createdAt ? sinceText(report.createdAt) : ''}
                  {report.reason ? ` · ${DENIAL_REASON_LABEL[report.reason]}` : ''} — 방문 전 확인하세요
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>
          ))}

          {/* 접종 기한 */}
          {vax.map(({ pet, dday, date }) => {
            const overdue = dday < 0;
            const tone = overdue ? p.danger : p.accent;
            const toneSoft = overdue ? p.dangerSoft : p.accentSoft;
            return (
              <Pressable
                key={`vax-${pet.petId}`}
                onPress={() => router.push('/calendar')}
                style={({ pressed }) => [
                  styles.alertCard,
                  { backgroundColor: pressed ? toneSoft : p.card, borderColor: tone },
                ]}>
                <View style={[styles.alertIcon, { backgroundColor: toneSoft }]}>
                  <Ionicons name="medkit" size={18} color={tone} />
                </View>
                <View style={styles.cardText}>
                  <Text style={[styles.alertTitle, { color: tone }]}>
                    {overdue ? `${pet.name} 접종 기한이 지났어요` : `${pet.name} 예방접종이 다가와요`}
                  </Text>
                  <Text style={[styles.alertBody, { color: p.ink }]} numberOfLines={2}>
                    다음 접종 {date} · {overdue ? `${-dday}일 지남` : `D-${dday}`} — 캘린더에서 확인하세요
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={tone} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  head: { gap: 4, paddingBottom: Spacing.xs },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  sub: { fontSize: 13.5, lineHeight: 20 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 72 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },

  denialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  bell: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 3 },
  denialTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  denialLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  denialTitle: { fontSize: 14.5, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
  denialBody: { fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.92)' },

  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.3 },
  alertBody: { fontSize: 12.5, lineHeight: 18 },
});
