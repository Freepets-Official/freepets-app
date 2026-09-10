import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { ConfidenceBadge } from '@/components/confidence-badge';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { CONFIDENCE_SOURCE_LABEL, freshnessText, type Facility } from '@/data/types';
import { useCallFacility } from '@/hooks/use-call-facility';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';
import { primaryPhoneNumber } from '@/lib/phone';

/**
 * 확정성 레이어의 핵심 UI — 정보 신뢰도 + 근거 + 최종 확인 시점,
 * 그리고 "미확인/추정을 확정으로 끌어올리는" 액션 3종.
 */
export function ConfidencePanel({ facility }: { facility: Facility }) {
  const p = usePalette();
  const { confidenceOf } = useAppStore();
  const callFacility = useCallFacility();
  const { confidence, source, confirmedAt } = confidenceOf(facility);

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

  // 전화 걸기와 신뢰도 갱신 규칙은 useCallFacility 하나로 모았다 — 상세 화면에도 전화 버튼이
  // 있는데, 어느 버튼으로 걸었느냐로 신뢰도가 갈리면 사용자는 그 차이를 알 수 없다.
  const callAndConfirm = () => callFacility(facility);

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

          {/*
            「사업자에게 조건 확인 요청」 버튼이 여기 있었다. 눌러도 **아무 데도 가지 않으면서**
            "보냈어요"라고 말하고 있었다 — 서버에 그런 엔드포인트가 없다(라이브 44개 확인).
            보내지 않은 것을 보냈다고 하는 화면은 두면 안 되고, 동작하지 않는 기능은 앱 심사
            거절 사유이기도 하다. 백엔드에 요청 API가 생기면 그때 되살린다.

            바로 위 전화 확인이 실제로 동작하는 대안이라 이 자리는 비워둔다.
          */}
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
    // 아이콘·글씨가 한 덩어리로 가운데 모이게 한다. 예전에는 글씨에 `flex: 1`이 걸려
    // 왼쪽으로 밀렸는데, 오른쪽 화살표가 없는 버튼은 그만큼 오른쪽이 비어 허전했다.
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  actionText: { fontSize: 13.5, fontWeight: '700' },
});
