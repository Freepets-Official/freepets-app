import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import type { OwnerFacility } from '@/lib/api';

/**
 * 사업자 화면들이 `useOwnerFacilities()`의 세 상태(불러오는 중 · 실패 · 매장 없음)를 같은 모양으로 그린다.
 * 실패를 스피너로 두면 네 화면이 무한 로딩이 된다 — 눌러서 다시 받게 한다.
 */
export function OwnerLoadState({ facilities, failed, refresh }: { facilities: OwnerFacility[] | null; failed: boolean; refresh: () => Promise<void> }) {
  const p = usePalette();
  if (failed) {
    return (
      <Pressable onPress={() => void refresh()} style={[styles.box, { backgroundColor: p.surface, borderColor: p.line }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={p.muted} />
        <Text style={[styles.text, { color: p.muted }]}>매장 정보를 불러오지 못했어요. 눌러서 다시 시도</Text>
      </Pressable>
    );
  }
  if (facilities === null) return <ActivityIndicator color={p.accent} style={{ padding: 40 }} />;
  return <Text style={[styles.text, { padding: 40, color: p.muted }]}>등록된 매장이 없어요.</Text>;
}

const styles = StyleSheet.create({
  box: { margin: Spacing.xl, alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.xl },
  text: { fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
});
