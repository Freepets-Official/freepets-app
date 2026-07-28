import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { sinceText } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { DENIAL_REASON_LABEL, useAppStore, type DenialReason } from '@/store/app-store';

const REASONS: DenialReason[] = ['WEIGHT', 'BREED', 'INDOOR', 'POLICY_CHANGED', 'CROWDED', 'OTHER'];

/**
 * 현장 거부 원터치 제보 — 문 앞에서 막 거부당한 사람이 쓰는 UI다.
 *
 * 이 순간의 사용자는 당황했고, 직원 앞이고, 손이 하나뿐이다.
 * 그래서 서술형 입력·사진 첨부를 요구하지 않는다. 사유 칩 한 번이 곧 전송이고,
 * 그 즉시 시설 신뢰도가 내려가 뒤따라오던 사람에게 경고로 도착한다.
 * 자세히 쓰고 싶은 사람은 기존 제보 화면(report/[id])으로 간다.
 */
export function DenialReport({ facilityId }: { facilityId: number }) {
  const p = usePalette();
  const { reportDenial, myDenialOf } = useAppStore();
  const [open, setOpen] = useState(false);

  const sent = myDenialOf(facilityId);

  if (sent) {
    return (
      <View style={[styles.sentCard, { backgroundColor: p.dangerSoft, borderColor: p.danger }]}>
        <Ionicons name="checkmark-circle" size={18} color={p.danger} />
        <View style={styles.sentBody}>
          <Text style={[styles.sentTitle, { color: p.danger }]}>
            거부 제보가 바로 반영됐어요 · {sinceText(sent.createdAt)}
          </Text>
          <Text style={[styles.sentText, { color: p.ink }]}>
            이 시설의 정보 신뢰도를 &lsquo;미확인&rsquo;으로 낮췄어요. 지금 이곳으로 향하던 다른
            보호자에게도 같은 경고가 갑니다.
          </Text>
        </View>
      </View>
    );
  }

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          { borderColor: p.danger, backgroundColor: pressed ? p.dangerSoft : 'transparent' },
        ]}>
        <Ionicons name="hand-right" size={16} color={p.danger} />
        <Text style={[styles.triggerText, { color: p.danger }]}>지금 거부당했어요</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[styles.panel, { backgroundColor: p.dangerSoft, borderColor: p.danger }]}>
      <Text style={[styles.panelTitle, { color: p.danger }]}>어떤 이유로 거부됐나요?</Text>
      <Text style={[styles.panelHint, { color: p.ink }]}>
        하나만 누르면 바로 접수돼요. 사진이나 설명은 없어도 됩니다.
      </Text>
      <View style={styles.chips}>
        {REASONS.map((r) => (
          <Pressable
            key={r}
            onPress={() => reportDenial(facilityId, r)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: pressed ? p.danger : p.card, borderColor: p.danger },
            ]}>
            <Text style={[styles.chipText, { color: p.danger }]}>{DENIAL_REASON_LABEL[r]}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setOpen(false)} style={styles.cancel}>
        <Text style={[styles.cancelText, { color: p.muted }]}>취소</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  sentBody: { flex: 1, gap: 3 },
  sentTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  sentText: { fontSize: 12.5, lineHeight: 18 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 14,
  },
  triggerText: { fontSize: 14.5, fontWeight: '800' },
  panel: { borderWidth: 1.5, borderRadius: Radius.lg, padding: Spacing.lg, gap: 8 },
  panelTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  panelHint: { fontSize: 12.5, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 2 },
  chip: {
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  cancel: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: Spacing.lg },
  cancelText: { fontSize: 12.5, fontWeight: '700' },
});
