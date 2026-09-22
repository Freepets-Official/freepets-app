import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

/**
 * 불러오는 중 · 실패 · 비어 있음 — 화면이 내용을 못 그릴 때의 세 상태.
 *
 * 이 컴포넌트가 생기기 전에는 열여섯 화면이 각자 `styles.state`/`empty`를 손으로 만들었다.
 * 그래서 같은 상황인데 화면마다 세로 여백이 28·32·36·40·48·56·72로 달랐고, 실패를 어떤
 * 화면은 카드 전체를 누르게, 어떤 화면은 명시적인 버튼으로, 어떤 화면은 문구 한 줄로 그렸다.
 * 사용자에게는 같은 일이 일어난 건데 화면을 옮길 때마다 다른 모양을 본 셈이다.
 *
 * **실패에는 명시적인 「다시 시도」 버튼을 둔다.** 카드 전체를 누르게 하면 누를 수 있다는 걸
 * 문구로 설명해야 하고("눌러서 다시 시도"), 그 문구를 못 본 사용자에게는 막다른 화면이 된다.
 */
export type LoadStateKind = 'loading' | 'failed' | 'empty';

export function LoadState({
  kind,
  message,
  icon,
  onRetry,
  size = 'inline',
}: {
  kind: LoadStateKind;
  /** 실패·빈 상태의 문구. 실패는 생략하면 기본 문구를 쓴다 */
  message?: string;
  /** 빈 상태에 얹을 아이콘. 없으면 문구만 그린다 */
  icon?: keyof typeof Ionicons.glyphMap;
  /** 실패일 때 다시 시도. 없으면 버튼을 그리지 않는다(재시도가 의미 없는 실패) */
  onRetry?: () => void;
  /** `inline` 목록 안 · `page` 화면을 통째로 채울 때 */
  size?: 'inline' | 'page';
}) {
  const p = usePalette();
  const pad = size === 'page' ? 48 : Spacing.xxl;

  if (kind === 'loading') {
    return <ActivityIndicator color={p.accent} style={{ paddingVertical: pad }} />;
  }

  if (kind === 'failed') {
    return (
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.line }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={p.muted} />
        <Text style={[styles.text, { color: p.muted }]}>{message ?? '불러오지 못했어요.'}</Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.retry,
              { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' },
            ]}>
            <Text style={[styles.retryText, { color: p.accent }]}>다시 시도</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.empty, { paddingVertical: pad }]}>
      {icon ? <Ionicons name={icon} size={28} color={p.muted} /> : null}
      <Text style={[styles.text, { color: p.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: 28,
    paddingHorizontal: Spacing.xl,
  },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  text: { fontSize: Type.body, lineHeight: 20, textAlign: 'center' },
  retry: { marginTop: 2, borderWidth: 1.5, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 8 },
  retryText: { fontSize: Type.footnote, fontWeight: '800' },
});
