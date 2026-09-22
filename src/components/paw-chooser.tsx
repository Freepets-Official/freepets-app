import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { PawGlyph } from '@/components/tier-paw';
import { Radius, Spacing, Type } from '@/constants/theme';
import { TIER_ANIMAL_LABEL, TIER_COLOR_HEX, type TierAnimal } from '@/data/level';
import { haptic } from '@/lib/haptics';
import { usePalette } from '@/hooks/use-theme';

const CHOICES: { animal: TierAnimal; caption: string; color: string }[] = [
  { animal: 'DOG', caption: '넓고 든든한 발자국', color: TIER_COLOR_HEX.ORANGE },
  { animal: 'CAT', caption: '작고 야무진 발자국', color: TIER_COLOR_HEX.INDIGO },
];

/** 선택 전에 카드 주위를 도는 반짝임 — 가만히 있는 화면과 "고르는" 화면을 구분한다 */
function Sparkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(t);
  }, [t, delay]);
  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0.15, 1]),
    transform: [{ scale: interpolate(t.value, [0, 1], [0.6, 1.15]) }],
  }));
  return (
    <Animated.View style={[styles.sparkle, { left: x, top: y, width: size, height: size, borderRadius: size / 2 }, anim]} />
  );
}

/** 고른 순간 퍼지는 링 — 두 겹이 시차를 두고 커지며 사라진다 */
function Ring({ color, delay, active }: { color: string; delay: number; active: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    t.value = withDelay(delay, withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }));
    return () => cancelAnimation(t);
  }, [active, delay, t]);
  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.15, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(t.value, [0, 1], [0.55, 2.1]) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: color }, anim]} />;
}

/** 사방으로 튀는 입자 8개 — 고른 순간의 "터짐" */
function Burst({ color, active }: { color: string; active: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    t.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(t);
  }, [active, t]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Particle key={i} angle={(i * Math.PI) / 4} color={color} t={t} />
      ))}
    </View>
  );
}

function Particle({ angle, color, t }: { angle: number; color: string; t: SharedValue<number> }) {
  const anim = useAnimatedStyle(() => {
    const d = interpolate(t.value, [0, 1], [0, 74]);
    return {
      opacity: interpolate(t.value, [0, 0.2, 1], [0, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * d },
        { translateY: Math.sin(angle) * d },
        { scale: interpolate(t.value, [0, 1], [1, 0.4]) },
      ],
    };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: color }, anim]} />;
}

function ChoiceCard({
  choice,
  picked,
  dimmed,
  onPress,
}: {
  choice: (typeof CHOICES)[number];
  picked: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  const float = useSharedValue(0);
  const pop = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    // 고르기 전에는 천천히 떠 있고, 고른 뒤에는 멈춘다 — 결정된 카드가 흔들리면 불안해 보인다
    float.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(float);
  }, [float]);

  useEffect(() => {
    if (picked) {
      // 눌림 → 크게 튀어오름 → 제자리. 스프링으로 끝을 물렁하게 잡는다
      pop.value = withSequence(
        withTiming(-1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 7, stiffness: 190 }),
        withSpring(0, { damping: 14, stiffness: 150 }),
      );
    }
    if (dimmed) fade.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) });
  }, [picked, dimmed, pop, fade]);

  const anim = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      // 고른 뒤에는 떠다니지 않는다 — 결정된 카드가 계속 흔들리면 불안해 보인다
      { translateY: (picked ? 0 : interpolate(float.value, [0, 1], [0, -6])) + interpolate(pop.value, [-1, 0, 1], [3, 0, -10]) },
      { scale: 1 + interpolate(pop.value, [-1, 0, 1], [-0.05, 0, 0.14]) + (dimmed ? -0.08 * (1 - fade.value) : 0) },
      { rotate: `${interpolate(pop.value, [-1, 0, 1], [0, 0, -5])}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.cardWrap, anim]}>
      <Pressable
        onPress={onPress}
        disabled={picked || dimmed}
        accessibilityRole="button"
        accessibilityLabel={`${TIER_ANIMAL_LABEL[choice.animal]} 발바닥 고르기`}
        style={({ pressed }) => [
          styles.card,
          { borderColor: picked ? choice.color : p.line, backgroundColor: p.card, opacity: pressed ? 0.94 : 1 },
        ]}>
        <LinearGradient
          colors={[`${choice.color}26`, 'transparent']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Sparkle x={14} y={16} size={5} delay={0} />
        <Sparkle x={112} y={26} size={4} delay={400} />
        <Sparkle x={24} y={118} size={3.5} delay={800} />
        <Sparkle x={104} y={124} size={5} delay={1200} />

        <View style={styles.pawSlot}>
          <Ring color={choice.color} delay={0} active={picked} />
          <Ring color={choice.color} delay={140} active={picked} />
          <PawGlyph animal={choice.animal} fill={choice.color} size={78} />
          <Burst color={choice.color} active={picked} />
        </View>

        <Text style={[styles.cardTitle, { color: p.ink }]}>{TIER_ANIMAL_LABEL[choice.animal]} 발바닥</Text>
        <Text style={[styles.cardCaption, { color: p.muted }]}>{choice.caption}</Text>
        {picked && (
          <View style={[styles.pickedMark, { backgroundColor: choice.color }]}>
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/**
 * 발바닥 고르기 — 레벨 배지에 쓸 발 모양을 개·고양이 중에서 정한다.
 *
 * 퀘스트 화면에 처음 들어올 때 한 번 묻는다. 서버는 레벨로 동물을 정하지만(1~35 개,
 * 36~70 고양이) 그건 내 아이와 무관한 값이라, 사용자가 고른 값이 그 위에 얹힌다.
 *
 * 고르는 순간이 이 화면의 전부라 **모션에 값을 쓴다**: 카드가 눌렸다가 튀어오르고,
 * 링 두 겹이 퍼지고, 입자 8개가 터지고, 고르지 않은 카드는 물러난다. 끝나면 `onPicked`.
 */
export function PawChooser({ onPick, onSkip }: { onPick: (animal: TierAnimal) => void; onSkip?: () => void }) {
  const p = usePalette();
  const [picked, setPicked] = useState<TierAnimal | null>(null);
  const done = useSharedValue(0);

  const choose = (animal: TierAnimal) => {
    if (picked) return;
    setPicked(animal);
    haptic.success();
    // 모션이 끝난 뒤에 넘어간다 — 바로 사라지면 고른 보람이 없다
    done.value = withDelay(900, withTiming(1, { duration: 1 }, (finished) => {
      if (finished) runOnJS(onPick)(animal);
    }));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: p.ink }]}>내 발바닥 고르기</Text>
        <Text style={[styles.body, { color: p.muted }]}>
          레벨이 오를 때마다 이 발바닥의 색이 무지개 순서로 바뀌고, 7색을 다 돌면 더 선명해져요.
          마지막 칸을 뚫으면 무지개 발바닥이 돼요.
        </Text>
      </View>

      <View style={styles.cards}>
        {CHOICES.map((c) => (
          <ChoiceCard
            key={c.animal}
            choice={c}
            picked={picked === c.animal}
            dimmed={picked !== null && picked !== c.animal}
            onPress={() => choose(c.animal)}
          />
        ))}
      </View>

      {onSkip && !picked && (
        <Pressable onPress={onSkip} hitSlop={8} style={styles.skip}>
          <Text style={[styles.skipText, { color: p.muted }]}>나중에 고를게요</Text>
        </Pressable>
      )}
      <Text style={[styles.note, { color: p.muted }]}>고른 뒤에도 퀘스트 화면에서 언제든 바꿀 수 있어요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xl, paddingTop: Spacing.sm },
  head: { gap: 6 },
  title: { fontSize: Type.sectionTitle, fontWeight: '900', letterSpacing: -0.6 },
  body: { fontSize: Type.body, lineHeight: 20 },
  cards: { flexDirection: 'row', gap: Spacing.md },
  cardWrap: { flex: 1 },
  card: {
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  pawSlot: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 86, height: 86, borderRadius: 43, borderWidth: 2 },
  particle: { position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, borderRadius: 3, marginLeft: -3, marginTop: -3 },
  sparkle: { position: 'absolute', backgroundColor: '#FFFFFF' },
  cardTitle: { fontSize: Type.callout, fontWeight: '900' },
  cardCaption: { fontSize: Type.caption },
  pickedMark: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  skip: { alignSelf: 'center', paddingVertical: 6 },
  skipText: { fontSize: Type.body, fontWeight: '700', textDecorationLine: 'underline' },
  note: { fontSize: Type.caption, textAlign: 'center' },
});
