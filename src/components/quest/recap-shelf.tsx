import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, useReducedMotion } from 'react-native-reanimated';

import { TiltPressable } from '@/components/motion/tilt-pressable';
import { Text } from '@/components/text';
import { LevelUpFonts, Radius, Type } from '@/constants/theme';
import { SEASON_LABEL, type Season } from '@/data/seasons';
import { usePalette } from '@/hooks/use-theme';
import { recapTitle, useRecaps, type RecapEntry } from '@/hooks/use-season-recap';

/** 계절마다 작은 표지 색 — 리캡 화면과 같은 계열 */
const COVER: Record<Season, { bg: [string, string]; ink: string; icon: string }> = {
  SPRING: { bg: ['#FFD3E0', '#FFF1E6'], ink: '#4A2A35', icon: 'flower' },
  SUMMER: { bg: ['#BFEAF0', '#FFF4CC'], ink: '#1E3940', icon: 'sunny' },
  AUTUMN: { bg: ['#FFCBA8', '#FFF0DE'], ink: '#4A2A17', icon: 'leaf' },
  WINTER: { bg: ['#D2DEFF', '#F3F0FF'], ink: '#24304A', icon: 'snow' },
};

/**
 * 퀘스트 화면의 계절 리캡 선반 — 진행 중인 계절의 "지금까지"와 지난 계절 리캡.
 * 아무 기록이 없으면 선반을 통째로 숨긴다.
 */
export function RecapShelf() {
  const p = usePalette();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { list, live } = useRecaps();
  const items: (RecapEntry & { isLive: boolean })[] = [
    ...(live ? [{ ...live, isLive: true }] : []),
    ...list.map((e) => ({ ...e, isLive: false })),
  ];
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: p.ink }]}>계절 리캡</Text>
        <Text style={[styles.caption, { color: p.muted }]}>계절이 바뀌는 날 열려요</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((e, i) => {
          const c = COVER[e.span.season];
          return (
            <Animated.View key={e.id} entering={reduce ? undefined : FadeInRight.delay(i * 70).duration(260)}>
              <TiltPressable
                onPress={() => router.push({ pathname: '/recap', params: { id: e.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${recapTitle(e.span)} 리캡${e.isLive ? ' 미리 보기' : ''}`}
                style={styles.card}>
                <LinearGradient colors={c.bg} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <Ionicons name={c.icon as never} size={56} color={c.ink} style={styles.bigIcon} />
                <View style={styles.badges}>
                  {e.isLive ? (
                    <Text style={[styles.badge, { color: c.ink, backgroundColor: 'rgba(255,255,255,0.7)' }]}>지금까지</Text>
                  ) : !e.seen ? (
                    <Text style={[styles.badge, { color: '#FFFFFF', backgroundColor: p.accent }]}>NEW</Text>
                  ) : null}
                </View>
                <Text style={[styles.season, { color: c.ink }]}>{SEASON_LABEL[e.span.season]}</Text>
                <Text style={[styles.meta, { color: c.ink }]}>
                  {e.span.year} · 판별 {e.recap.checks} · 도장 {e.recap.stamps}
                </Text>
              </TiltPressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: Type.cardTitle, fontWeight: '800' },
  caption: { fontSize: Type.caption, fontWeight: '700' },
  row: { gap: 10, paddingVertical: 4, paddingRight: 8 },
  card: { width: 132, height: 168, borderRadius: Radius.lg, overflow: 'hidden', padding: 12, justifyContent: 'flex-end', boxShadow: '0 10px 20px -14px rgba(90,55,35,0.5)' },
  bigIcon: { position: 'absolute', top: 14, right: 10, opacity: 0.22, transform: [{ rotate: '-12deg' }] },
  badges: { position: 'absolute', top: 10, left: 10 },
  badge: { fontSize: Type.micro, fontWeight: '900', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  season: { fontFamily: LevelUpFonts.ko, fontSize: 30, lineHeight: 34 },
  meta: { fontSize: Type.micro, fontWeight: '800', opacity: 0.8, fontVariant: ['tabular-nums'] },
});
