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
 *
 * **빈 상태에도 나갈 길이 있으면 버튼으로 준다**(`action`). "아이를 먼저 등록해 주세요"처럼
 * 다음 행동이 정해져 있는데 길을 안 주면, 사용자가 탭을 뒤져 스스로 찾아야 한다.
 */
export type LoadStateKind = 'loading' | 'failed' | 'empty';

/** 빈 상태·실패에서 나갈 길. 없으면 버튼을 그리지 않는다 */
export type LoadStateAction = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function LoadState({
  kind,
  message,
  icon,
  onRetry,
  action,
  size = 'inline',
}: {
  kind: LoadStateKind;
  /** 문구. 로딩에도 붙일 수 있다("내 주변 시설을 찾고 있어요…") */
  message?: string;
  /** 얹을 아이콘. 실패는 생략하면 오프라인 아이콘을 쓴다 */
  icon?: keyof typeof Ionicons.glyphMap;
  /** 실패일 때 다시 시도 — `action`의 흔한 경우를 줄여 쓴 것 */
  onRetry?: () => void;
  /** 임의의 행동 버튼. `onRetry`보다 우선한다 */
  action?: LoadStateAction;
  /** `inline` 목록 안 · `page` 화면을 통째로 채울 때 */
  size?: 'inline' | 'page';
}) {
  const p = usePalette();
  const pad = size === 'page' ? 48 : Spacing.xxl;
  const act: LoadStateAction | null =
    action ?? (onRetry ? { label: '다시 시도', icon: 'refresh', onPress: onRetry } : null);

  const button = act ? (
    <Pressable
      onPress={act.onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' },
      ]}>
      {act.icon ? <Ionicons name={act.icon} size={15} color={p.accent} /> : null}
      <Text style={[styles.actionText, { color: p.accent }]}>{act.label}</Text>
    </Pressable>
  ) : null;

  if (kind === 'loading') {
    return (
      <View style={[styles.empty, { paddingVertical: pad }]}>
        <ActivityIndicator color={p.accent} />
        {message ? <Text style={[styles.text, { color: p.muted }]}>{message}</Text> : null}
      </View>
    );
  }

  // 실패만 테두리 카드다 — 목록이 비어 있는 것과 못 받아온 것은 무게가 다르다
  if (kind === 'failed') {
    return (
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.line }]}>
        <Ionicons name={icon ?? 'cloud-offline-outline'} size={28} color={p.muted} />
        <Text style={[styles.text, { color: p.muted }]}>{message ?? '불러오지 못했어요.'}</Text>
        {button}
      </View>
    );
  }

  return (
    <View style={[styles.empty, { paddingVertical: pad }]}>
      {icon ? <Ionicons name={icon} size={28} color={p.muted} /> : null}
      <Text style={[styles.text, { color: p.muted }]}>{message}</Text>
      {button}
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
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  actionText: { fontSize: Type.footnote, fontWeight: '800' },
});
