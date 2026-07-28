import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { sinceText } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { DENIAL_REASON_LABEL, useAppStore } from '@/store/app-store';

/**
 * 현장 거부 경고 — 누군가 방금 거부당한 시설로 다른 사람이 향하는 것을 막는다.
 * F4의 핵심은 이 방향이다: 거부라는 실패가 다음 사람에게 도착해야 플라이휠이 돈다.
 *
 * `compact`는 목록 카드용 한 줄 표시.
 */
export function DenialAlert({ facilityId, compact = false }: { facilityId: number; compact?: boolean }) {
  const p = usePalette();
  const { recentDenialOf } = useAppStore();
  const denial = recentDenialOf(facilityId);

  if (!denial) return null;

  const reason = denial.reason ? DENIAL_REASON_LABEL[denial.reason] : '사유 미기재';
  const since = sinceText(denial.createdAt);

  if (compact) {
    return (
      <View style={styles.compact}>
        <Ionicons name="alert-circle" size={13} color={p.danger} />
        <Text style={[styles.compactText, { color: p.danger }]} numberOfLines={1}>
          {since} 현장 거부 · {reason}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, { backgroundColor: p.dangerSoft, borderColor: p.danger }]}>
      <Ionicons name="warning" size={18} color={p.danger} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: p.danger }]}>
          {since} 이곳에서 거부당한 방문자가 있어요
        </Text>
        <Text style={[styles.detail, { color: p.ink }]}>
          사유 · {reason} — 등록된 조건과 현장이 다를 수 있으니 출발 전에 전화로 확인하세요.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  detail: { fontSize: 12.5, lineHeight: 18 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactText: { fontSize: 11.5, fontWeight: '700', flexShrink: 1 },
});
