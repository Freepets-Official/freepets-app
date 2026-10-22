import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TiltPressable } from '@/components/motion/tilt-pressable';
import { Text } from '@/components/text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { usePass } from '@/hooks/use-pass';
import { usePalette } from '@/hooks/use-theme';

/**
 * 꼬리패스 한 줄 소개 — 퀘스트 화면 아래쪽. 사전 신청을 했으면 조용히 "신청 완료"만.
 * 조르지 않는다: 화면마다 띄우지 않고, 기록을 모으는 사람이 보는 퀘스트 화면에만 둔다.
 */
export function PassTeaser() {
  const p = usePalette();
  const router = useRouter();
  const { waitlist } = usePass();
  return (
    <TiltPressable onPress={() => router.push('/pass')} accessibilityRole="button" accessibilityLabel="꼬리패스 알아보기" maxTilt={3} style={styles.card}>
      <LinearGradient colors={['#FFE2D2', '#FFF3EA']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={[styles.icon, { backgroundColor: p.accent }]}>
        <Ionicons name="ribbon" size={18} color={p.onAccent} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: '#2D2622' }]}>꼬리패스 {waitlist ? '· 사전 신청 완료' : '· 출시 예정'}</Text>
        <Text style={[styles.body, { color: '#7A6E67' }]}>
          {waitlist ? '출시되면 가장 먼저 알려 드릴게요' : '헛걸음 보상 · AI 여행 플래너 · 추억 클라우드'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#B4552F" />
    </TiltPressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, padding: Spacing.md, overflow: 'hidden' },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontSize: Type.bodyLg, fontWeight: '900' },
  body: { fontSize: Type.caption, fontWeight: '700' },
});
