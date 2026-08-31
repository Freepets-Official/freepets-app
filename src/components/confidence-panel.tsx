import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConfidenceBadge } from '@/components/confidence-badge';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { CONFIDENCE_SOURCE_LABEL, freshnessText, type Facility } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';
import { primaryPhoneNumber } from '@/lib/phone';

/**
 * 확정성 레이어의 핵심 UI — 정보 신뢰도 + 근거 + 최종 확인 시점,
 * 그리고 "미확인/추정을 확정으로 끌어올리는" 액션 3종.
 */
export function ConfidencePanel({ facility }: { facility: Facility }) {
  const p = usePalette();
  const { confidenceOf, confirmFacility } = useAppStore();
  const { confidence, source, confirmedAt } = confidenceOf(facility);

  const [requested, setRequested] = useState(false);
  const fresh = freshnessText(confirmedAt);
  const isConfirmed = confidence === 'CONFIRMED';

  // 딱 3상태로만 안내한다 (그 이상은 헷갈림):
  //  1) 불가        — 확인해봐도 함께 입장 불가 → 액션 없음
  //  2) 확정(가능)   — 추가 확인 없이 방문 OK → 액션 없음
  //  3) 확인 필요    — 아직 확정 전 → 어디서 확인하는지(전화·사업자) 안내
  const denied = facility.petAllowed === false;
  const confirmedOk = isConfirmed && facility.petAllowed === true;
  const needsCheck = !denied && !confirmedOk;

  // 원문에 안내문·복수 번호가 섞여 오므로 걸 수 있는 첫 번호만 뽑는다. 없으면 버튼 자체를 숨긴다.
  const tel = primaryPhoneNumber(facility.phone);

  // 전화 앱이 실제로 열렸을 때만 확정으로 올린다. 예전엔 openURL 성공 여부와 무관하게 올려서,
  // 번호가 아닌 안내문이 와서 전화가 안 걸려도 '내가 전화로 확인'이 찍혔다 — 없는 근거를 만든 셈이다.
  //
  // ⚠️ 웹에서는 이 판정을 할 수 없다. react-native-web의 Linking.open은 tel: 핸들러가 없어도
  // 항상 Promise.resolve()를 돌려주고 canOpenURL도 무조건 true라, reject가 오지 않는다.
  // 그래서 웹에서는 전화만 열고 신뢰도는 올리지 않는다 — 확인되지 않은 것을 확인됐다고
  // 기록하는 쪽이, 확정 경로가 한 곳 없는 것보다 나쁘다. (Vercel 웹이 시연·심사 경로다.)
  const callAndConfirm = () => {
    if (!tel) return;
    Linking.openURL(`tel:${tel}`)
      .then(() => {
        if (Platform.OS !== 'web') confirmFacility(facility.facilityId);
      })
      .catch(() => {
        // 전화 앱을 못 열었으면 확인된 게 아니다. 신뢰도는 그대로 둔다.
      });
  };

  return (
    <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <View style={styles.head}>
        <ConfidenceBadge confidence={confidence} />
        <Text style={[styles.source, { color: p.muted }]}>
          {CONFIDENCE_SOURCE_LABEL[source]}
          {fresh ? ` · ${fresh}` : ''}
        </Text>
      </View>

      <Text style={[styles.explain, { color: p.ink }]}>
        {denied
          ? '동반 불가 시설이에요. 확인해봐도 함께 입장은 어려워요. (추가 확인 불필요)'
          : confirmedOk
            ? '확인된 정보예요. 추가 확인 없이 방문하셔도 돼요.'
            : // 거부 제보로 하향된 경우는 "정보가 없다"가 아니라 "있던 정보가 틀렸다"는 뜻이다
              source === 'DENIAL_REPORT'
              ? '현장에서 거부당한 제보가 접수돼 신뢰도를 낮췄어요. 등록된 조건을 그대로 믿지 말고 아래에서 확인하세요.'
              : '아직 확정된 정보가 아니에요. 방문 전 아래에서 확인하는 걸 권장해요.'}
      </Text>

      {needsCheck && (
        <View style={styles.actions}>
          <Text style={[styles.actionsTitle, { color: p.muted }]}>어디서 확인하나요</Text>

          {tel && (
            <Pressable
              onPress={callAndConfirm}
              style={({ pressed }) => [
                styles.action,
                { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' },
              ]}>
              <Ionicons name="call" size={16} color={p.accent} />
              <Text style={[styles.actionText, { color: p.accent }]}>전화로 직접 확인하기</Text>
              <Ionicons name="arrow-forward" size={14} color={p.accent} />
            </Pressable>
          )}

          <Pressable
            onPress={() => setRequested(true)}
            disabled={requested}
            style={({ pressed }) => [
              styles.action,
              { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
            ]}>
            <Ionicons
              name={requested ? 'checkmark-circle' : 'business'}
              size={16}
              color={requested ? p.success : p.muted}
            />
            <Text style={[styles.actionText, { color: requested ? p.success : p.ink }]}>
              {requested ? '사업자에게 확인 요청을 보냈어요' : '사업자에게 조건 확인 요청'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  source: { fontSize: 12.5, fontWeight: '600' },
  explain: { fontSize: 13.5, lineHeight: 20 },
  actions: { gap: Spacing.sm, marginTop: 2 },
  actionsTitle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  actionText: { fontSize: 13.5, fontWeight: '700', flex: 1 },
});
