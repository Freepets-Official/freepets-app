import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { sinceText } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { DENIAL_REASON_LABEL, useAppStore, type Report } from '@/store/app-store';

const reasonOf = (r: Report) => (r.reason ? DENIAL_REASON_LABEL[r.reason] : '사유 미기재');

/**
 * 현장 거부 경고 — 누군가 거부당한 시설로 다른 사람이 향하는 것을 막는다.
 * F4의 핵심은 이 방향이다: 거부라는 실패가 다음 사람에게 도착해야 플라이휠이 돈다.
 *
 * 최근 1주 내 남의 거부를 최신순 최대 3건 받는다. 상세 화면은 최신 1건을 크게 보여주고,
 * 나머지는 토글로 펼친다. `compact`는 목록 카드용 한 줄(최신 1건 + 외 N건).
 */
export function DenialAlert({ facilityId, compact = false }: { facilityId: number; compact?: boolean }) {
  const p = usePalette();
  const { recentDenialsOf } = useAppStore();
  const [expanded, setExpanded] = useState(false);

  const denials = recentDenialsOf(facilityId);
  if (denials.length === 0) return null;

  const latest = denials[0];
  const rest = denials.slice(1);

  if (compact) {
    return (
      <View style={styles.compact}>
        <Ionicons name="alert-circle" size={13} color={p.danger} />
        <Text style={[styles.compactText, { color: p.danger }]} numberOfLines={1}>
          {sinceText(latest.createdAt)} 현장 거부 · {reasonOf(latest)}
          {rest.length > 0 ? ` 외 ${rest.length}건` : ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, { backgroundColor: p.dangerSoft, borderColor: p.danger }]}>
      <View style={styles.headRow}>
        <Ionicons name="warning" size={18} color={p.danger} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: p.danger }]}>
            {sinceText(latest.createdAt)} 이곳에서 거부당한 방문자가 있어요
            {denials.length > 1 ? ` · 최근 1주 ${denials.length}건` : ''}
          </Text>
          <Text style={[styles.detail, { color: p.ink }]}>
            사유 · {reasonOf(latest)} — 등록된 조건과 현장이 다를 수 있으니 출발 전에 전화로 확인하세요.
          </Text>
        </View>
      </View>

      {rest.length > 0 && (
        <>
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={[styles.toggleText, { color: p.danger }]}>
              {expanded ? '접기' : `다른 거부 ${rest.length}건 더 보기`}
            </Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={p.danger} />
          </Pressable>

          {expanded && (
            <View style={styles.list}>
              {rest.map((r) => (
                <View key={r.reportId} style={styles.listRow}>
                  <Ionicons name="ellipse" size={5} color={p.danger} />
                  <Text style={[styles.listText, { color: p.ink }]}>
                    {sinceText(r.createdAt)} · {reasonOf(r)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  detail: { fontSize: 12.5, lineHeight: 18 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  toggleText: { fontSize: 12.5, fontWeight: '800' },
  list: { gap: 5, paddingLeft: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  listText: { fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactText: { fontSize: 11.5, fontWeight: '700', flexShrink: 1 },
});
