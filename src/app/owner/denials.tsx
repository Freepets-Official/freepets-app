import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { sinceText } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { ownerApi, type OwnerDenialAlert } from '@/lib/api';

const REASON: Record<string, string> = { WEIGHT: '체중 초과', BREED: '품종', INDOOR: '실내 불가', POLICY_CHANGED: '정책 변경', CROWDED: '혼잡', OTHER: '기타' };

/**
 * 거부 제보 전체 — 확정 이후 들어온 실시간 제보. 사유·원문·시각까지만 온다.
 * 사진과 제보자 신원은 어떤 경우에도 오지 않는다 — 사장님이 제보자를 알아낼 수 있으면 제보가 위축된다.
 */
export default function OwnerDenialsScreen() {
  const p = usePalette();
  const { facilityId: idParam } = useLocalSearchParams<{ facilityId?: string }>();
  const facilityId = Number(idParam);
  const [alerts, setAlerts] = useState<OwnerDenialAlert[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    ownerApi
      .denialAlerts(facilityId)
      .then((list) => alive && setAlerts(list))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [facilityId]);

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '거부 제보', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <Text style={[styles.lead, { color: p.muted }]}>
            조건을 확정한 뒤 손님이 &ldquo;문 앞에서 거부당했다&rdquo;고 남긴 제보예요. 제보가 남아 있는 동안은 손님 화면의 신뢰도가 내려가 있어요 — 조건이 바뀌었다면 「출입 조건 관리」에서 고쳐 주세요.
          </Text>
          {failed ? (
            <Text style={[styles.empty, { color: p.muted }]}>제보를 불러오지 못했어요.</Text>
          ) : alerts === null ? (
            <ActivityIndicator color={p.accent} style={{ paddingVertical: 32 }} />
          ) : alerts.length === 0 ? (
            <Text style={[styles.empty, { color: p.muted }]}>확정 이후 들어온 거부 제보가 없어요.</Text>
          ) : (
            alerts.map((a) => (
              <View key={a.reportId} style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                <View style={styles.cardHead}>
                  <View style={[styles.tag, { backgroundColor: p.dangerSoft }]}>
                    <Ionicons name="warning" size={12} color={p.danger} />
                    <Text style={[styles.tagText, { color: p.danger }]}>{REASON[a.reason] ?? a.reason}</Text>
                  </View>
                  <Text style={[styles.when, { color: p.muted }]}>{sinceText(a.reportedAt)}</Text>
                </View>
                <Text style={[styles.body, { color: p.ink }]}>{a.content}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.md },
  lead: { fontSize: 13, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 11.5, fontWeight: '800' },
  when: { fontSize: 11.5 },
  body: { fontSize: 14, lineHeight: 21 },
  empty: { fontSize: 13.5, textAlign: 'center', paddingVertical: 32 },
});
