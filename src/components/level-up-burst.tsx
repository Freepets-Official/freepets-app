import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PawBurst } from '@/components/paw-burst';
import { Text } from '@/components/text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { tierLook } from '@/data/level';
import { usePalette } from '@/hooks/use-theme';

/**
 * 레벨업 순간의 전체 화면 연출.
 *
 * 토스트만으로는 레벨업이 배지·경험치 적립과 같은 무게로 지나간다. 레벨은 수십 번의 판별과
 * 리뷰가 쌓여야 오르는 값이라, 한 번쯤 화면을 멈춰 세울 자격이 있다.
 *
 * 90년대 아케이드 게임의 「LEVEL UP」 연출에서 형식만 빌렸다 — 두꺼운 노란 글씨가 튀어
 * 올라오고 주변이 터지는 구성이다. **특정 게임의 글꼴·색·이미지를 가져오지 않는다.**
 * 글꼴은 기기 기본 굵은 글꼴이고, 노랑은 우리 팔레트의 warn 계열에서 밝게 잡은 값이며,
 * 터지는 것은 별이나 코인이 아니라 **우리 발바닥**이다. 형식은 흔한 관용이지만 구성 요소는
 * 우리 것이어야 한다.
 *
 * 글자 테두리는 RN에 text-stroke가 없어 **같은 글자를 어긋나게 겹쳐 그려** 만든다.
 */

/** 아케이드 노랑 — 팔레트의 warn보다 밝게 잡았다. 어두운 막 위에서만 쓰므로 양 테마 동일 */
const GOLD = '#FFD43B';
const GOLD_DEEP = '#F08C00';
/** 테두리용 먹색. 노랑만 있으면 밝은 배경 사진 위에서 글씨가 날아간다 */
const OUTLINE = '#2B1A00';

const LETTERS = ['L', 'E', 'V', 'E', 'L', ' ', 'U', 'P', '!'];

/** 글자 하나가 튀어 오르는 시간차 — 왼쪽부터 차례로 */
const STAGGER_MS = 55;

/** 스스로 닫히기까지. 글자 9개(495ms) + 배지(180ms) + 읽을 시간 */
const AUTO_CLOSE_MS = 3600;

export function LevelUpBurst({ level, tierName, onDone }: { level: number; tierName: string; onDone: () => void }) {
  const p = usePalette();
  const look = tierLook(level);

  useEffect(() => {
    // 레벨업은 손끝으로도 알려준다. 웹에는 햅틱이 없어 조용히 넘어간다
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  /**
   * 누르지 않아도 스스로 닫힌다.
   *
   * 레벨업은 리뷰를 쓰거나 판별한 **직후**에 뜬다 — 사용자가 하던 일이 있는 순간이다.
   * 닫는 것을 손에 맡기면, 축하가 아니라 길을 막는 것이 된다.
   */
  useEffect(() => {
    const t = setTimeout(onDone, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(260)}
      style={styles.fill}
      pointerEvents="box-none"
      accessibilityRole="alert"
      accessibilityLabel={`레벨 ${level} 달성. ${tierName}`}>
      {/* 어두운 막 — 뒤 화면이 무엇이든 노란 글씨가 읽히게 한다. 눌러서 닫는다 */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone} accessibilityRole="button" accessibilityLabel="닫기">
        <LinearGradient
          colors={['rgba(20,12,30,0.72)', 'rgba(20,12,30,0.88)']}
          style={StyleSheet.absoluteFill}
        />
      </Pressable>

      <View style={styles.center} pointerEvents="none">
        <Rays />
        <PawBurst color={GOLD} size={22} />

        <View style={styles.word}>
          {LETTERS.map((ch, i) => (
            <Letter key={i} ch={ch} index={i} />
          ))}
        </View>

        <Badge level={level} tierName={tierName} color={look.rainbow ? GOLD : undefined} palette={p} />
      </View>
    </Animated.View>
  );
}

/** 글자 하나 — 아래에서 튀어 올라와 한 번 출렁인다 */
function Letter({ ch, index }: { ch: string; index: number }) {
  const t = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
    const delay = index * STAGGER_MS;
    t.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 190, mass: 0.7 }));
    wobble.value = withDelay(
      delay + 420,
      withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 260, easing: Easing.inOut(Easing.quad) }),
      ),
    );
  }, [t, wobble, index]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.35, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(t.value, [0, 1], [34, 0]) - wobble.value * 7 },
      { scale: interpolate(t.value, [0, 1], [0.55, 1]) },
      // 글자마다 기울기를 살짝 엇갈리게 — 자로 잰 듯 반듯하면 연출이 죽는다
      { rotate: `${(index % 2 === 0 ? -1 : 1) * 3 * (1 - t.value) + (index % 2 === 0 ? -1.5 : 1.5)}deg` },
    ],
  }));

  if (ch === ' ') return <View style={styles.space} />;

  return (
    <Animated.View style={style}>
      {/* 테두리 — 같은 글자를 여덟 방향으로 1.5pt씩 어긋나게 깔아 굵은 외곽선을 만든다 */}
      {OUTLINE_OFFSETS.map(([dx, dy], i) => (
        <Text key={i} style={[styles.letter, styles.letterAbs, { color: OUTLINE, left: dx, top: dy }]}>
          {ch}
        </Text>
      ))}
      {/* 아래쪽 진한 노랑 — 입체감을 준다 */}
      <Text style={[styles.letter, styles.letterAbs, { color: GOLD_DEEP, left: 0, top: 3 }]}>{ch}</Text>
      <Text style={[styles.letter, { color: GOLD }]}>{ch}</Text>
    </Animated.View>
  );
}

const OUTLINE_OFFSETS: [number, number][] = [
  [-2, 0], [2, 0], [0, -2], [0, 2],
  [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5],
];

/** 뒤에서 천천히 도는 빛살. 글자에 시선이 모이게 한다 */
function Rays() {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withTiming(1, { duration: 2600, easing: Easing.linear });
  }, [spin]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(spin.value, [0, 0.15, 0.75, 1], [0, 0.5, 0.4, 0]),
    transform: [{ rotate: `${spin.value * 55}deg` }, { scale: interpolate(spin.value, [0, 1], [0.7, 1.15]) }],
  }));

  return (
    <Animated.View style={[styles.rays, style]} pointerEvents="none">
      {Array.from({ length: 10 }).map((_, i) => (
        <View
          key={i}
          style={[styles.ray, { transform: [{ rotate: `${(i * 180) / 10}deg` }] }]}
        />
      ))}
    </Animated.View>
  );
}

/** 새 레벨과 티어 이름 — 연출이 끝나도 "뭐가 올랐는지"는 남아야 한다 */
function Badge({
  level,
  tierName,
  color,
  palette,
}: {
  level: number;
  tierName: string;
  color?: string;
  palette: ReturnType<typeof usePalette>;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(LETTERS.length * STAGGER_MS + 180, withSpring(1, { damping: 12, stiffness: 160 }));
  }, [t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: interpolate(t.value, [0, 1], [16, 0]) }, { scale: interpolate(t.value, [0, 1], [0.9, 1]) }],
  }));

  return (
    <Animated.View style={[styles.badge, style]}>
      <View style={styles.levelRow}>
        <Ionicons name="paw" size={20} color={color ?? GOLD} />
        <Text style={styles.levelText}>Lv.{level}</Text>
      </View>
      <Text style={[styles.tierText, { color: palette.onAccent }]}>{tierName}</Text>
      <Text style={styles.hint}>화면을 누르면 닫혀요</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 400, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  ray: {
    position: 'absolute',
    width: 300,
    height: 12,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,212,59,0.12)',
  },
  word: { flexDirection: 'row', alignItems: 'flex-end' },
  letter: { fontSize: 46, lineHeight: 58, fontWeight: '900', letterSpacing: -1 },
  letterAbs: { position: 'absolute' },
  space: { width: 14 },
  badge: { alignItems: 'center', gap: 3, marginTop: Spacing.lg },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  levelText: { fontSize: Type.headline, fontWeight: '900', color: GOLD, letterSpacing: -0.5 },
  tierText: { fontSize: Type.callout, fontWeight: '800' },
  hint: { fontSize: Type.caption, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginTop: Spacing.sm },
});
