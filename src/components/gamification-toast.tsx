import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const SHOW_MS = 4500;

/** 알림 종류별 아이콘 — 배지는 리본, 적립은 위로 오르는 화살표 */
const ICON = { badge: 'ribbon', xp: 'arrow-up-circle' } as const;

/** 경험치 적립은 축하가 아니라 확인이라 짧게 스친다 */
const SHOW_MS_XP = 2200;

/**
 * 새 배지·경험치 적립 알림. **레벨업은 여기가 아니라 `LevelUpBurst`가 맡는다.**
 *
 * 서버는 배지 획득 푸시를 보내지 않고, 레벨업 푸시도 꺼둘 수 있다. 경험치 적립에 이르면
 * 알려주는 수단이 아예 없다 — 판별·리뷰 API가 조용히 XP를 주고 응답에 아무 표시도 넣지
 * 않는다(`api-specs/gamification.md`). 앱 안에서라도 순간이 있어야 경험치를 쌓는 이유가
 * 보인다. 조회 결과를 이전과 비교해 새로 생긴 것만 잠깐 띄운다.
 */
export function GamificationToast() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { gamificationNews, dismissGamificationNews } = useAppStore();

  useEffect(() => {
    if (!gamificationNews) return;
    const t = setTimeout(dismissGamificationNews, gamificationNews.kind === 'xp' ? SHOW_MS_XP : SHOW_MS);
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
        <Ionicons name={ICON[gamificationNews.kind]} size={20} color={p.accent} />
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
  text: { fontSize: Type.bodyLg, fontWeight: '700', flexShrink: 1 },
});
