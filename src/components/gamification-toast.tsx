import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const SHOW_MS = 4500;

/**
 * 레벨업·새 배지 알림.
 *
 * 서버는 배지 획득 푸시를 보내지 않고, 레벨업 푸시도 꺼둘 수 있다. 앱 안에서라도 순간이 있어야
 * 경험치를 쌓는 이유가 보인다 — 조회 결과를 이전과 비교해 새로 생긴 것만 잠깐 띄운다.
 */
export function GamificationToast() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { gamificationNews, dismissGamificationNews } = useAppStore();

  useEffect(() => {
    if (!gamificationNews) return;
    const t = setTimeout(dismissGamificationNews, SHOW_MS);
    return () => clearTimeout(t);
  }, [gamificationNews, dismissGamificationNews]);

  if (!gamificationNews) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(260)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.wrap, { top: insets.top + Spacing.sm }]}
      pointerEvents="box-none">
      <Pressable
        onPress={dismissGamificationNews}
        style={[styles.card, { backgroundColor: p.card, borderColor: p.accent }]}
        accessibilityRole="alert">
        <Ionicons name={gamificationNews.kind === 'level' ? 'paw' : 'ribbon'} size={20} color={p.accent} />
        <Text style={[styles.text, { color: p.ink }]} numberOfLines={2}>
          {gamificationNews.text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 300 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 420,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
});
