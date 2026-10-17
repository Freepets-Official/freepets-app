import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { AccessoryGlyph } from '@/components/companion/accessories';
import { TiltPressable } from '@/components/motion/tilt-pressable';
import { PawBurst } from '@/components/paw-burst';
import { Text } from '@/components/text';
import { ClayShadow, Radius, Type } from '@/constants/theme';
import { itemById, type ItemId } from '@/data/quest-journey';
import { useColorScheme, usePalette } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

const INK = '#3A2D24';
const RIBBON = '#FFE3A3';

/** 간식 상자 그림 — 몸통과 뚜껑을 따로 그려 뚜껑만 날려 보낼 수 있게 한다 */
function BoxBody({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x={18} y={44} width={64} height={46} rx={7} fill={color} stroke={INK} strokeWidth={3} />
      <Rect x={44} y={44} width={12} height={46} fill={RIBBON} stroke={INK} strokeWidth={2.4} />
      <Path d="M24 56 L76 56" stroke={INK} strokeWidth={1.4} opacity={0.25} />
    </Svg>
  );
}
function BoxLid({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M50 30 C40 14 26 20 32 30 C36 36 46 33 50 30 Z" fill={RIBBON} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <Path d="M50 30 C60 14 74 20 68 30 C64 36 54 33 50 30 Z" fill={RIBBON} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <Rect x={13} y={31} width={74} height={15} rx={6} fill={color} stroke={INK} strokeWidth={3} />
      <Rect x={44} y={31} width={12} height={15} fill={RIBBON} stroke={INK} strokeWidth={2.4} />
    </Svg>
  );
}

function Box({ size, wiggle, color }: { size: number; wiggle: boolean; color: string }) {
  const reduce = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (!wiggle || reduce) {
      cancelAnimation(r);
      r.set(0);
      return;
    }
    // 열 수 있을 때만 — 3초에 한 번 들썩들썩
    r.set(
      withRepeat(
        withSequence(
          withDelay(2200, withTiming(-9, { duration: 90 })),
          withTiming(8, { duration: 110 }),
          withTiming(-5, { duration: 100 }),
          withTiming(0, { duration: 120 }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(r);
  }, [wiggle, reduce, r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={[{ width: size, height: size, transformOrigin: '50% 90%' }, style]}>
      <View style={StyleSheet.absoluteFill}>
        <BoxBody size={size} color={color} />
      </View>
      <View style={StyleSheet.absoluteFill}>
        <BoxLid size={size} color={color} />
      </View>
    </Animated.View>
  );
}

/**
 * 오늘의 간식 상자 카드. 세 가지를 다 하면 상자가 들썩이고 「열기」가 생긴다.
 * 열고 나면 오늘 받은 소품과 "내일 또 열려요"를 보여준다.
 */
export function ChestCard({
  done,
  total,
  ready,
  openedToday,
  lastItem,
  onOpen,
}: {
  done: number;
  total: number;
  ready: boolean;
  openedToday: boolean;
  lastItem: ItemId | null;
  onOpen: () => void;
}) {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const title = openedToday ? '오늘 상자를 열었어요' : ready ? '간식 상자가 도착했어요!' : '오늘의 간식 상자';
  const sub = openedToday
    ? lastItem
      ? `${itemById(lastItem).name}을(를) 받았어요 · 내일 또 열려요`
      : '내일 또 열려요'
    : ready
      ? '눌러서 열어 보세요'
      : `세 가지 중 ${total - done}개 더 하면 열려요`;
  const body = (
    <View style={styles.chestRow}>
      <Box size={74} wiggle={ready} color={openedToday ? p.line : p.accent} />
      <View style={styles.flex}>
        <Text style={[styles.chestTitle, { color: p.ink }]}>{title}</Text>
        <Text style={[styles.chestSub, { color: p.muted }]}>{sub}</Text>
        {!openedToday ? (
          <View style={styles.pips}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[styles.pip, { backgroundColor: i < done ? p.accent : p.line }]} />
            ))}
          </View>
        ) : null}
      </View>
      {ready ? (
        <View style={[styles.openBtn, { backgroundColor: p.accent }]}>
          <Text style={[styles.openText, { color: p.onAccent }]}>열기</Text>
        </View>
      ) : openedToday && lastItem ? (
        <AccessoryGlyph id={lastItem} size={46} />
      ) : null}
    </View>
  );
  return ready ? (
    <TiltPressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel="간식 상자 열기"
      style={[styles.card, { backgroundColor: p.card, boxShadow: clay.rest, borderColor: p.accent, borderWidth: 2 }]}>
      {body}
    </TiltPressable>
  ) : (
    <View style={[styles.card, { backgroundColor: p.card, boxShadow: clay.rest }]}>{body}</View>
  );
}

/**
 * 상자 여는 장면 — 들썩들썩(0.6초) → 뚜껑이 날아가고 → 소품이 통 튀어나오며 발자국이 퍼진다.
 * 동작 줄이기면 곧바로 결과를 보여준다.
 */
export function ChestOpening({
  visible,
  item,
  onClose,
  onWear,
}: {
  visible: boolean;
  item: ItemId | null;
  onClose: () => void;
  /** 받은 소품을 바로 입혀 본다 */
  onWear?: (id: ItemId) => void;
}) {
  const p = usePalette();
  const reduce = useReducedMotion();
  // 띄울 때마다 새로 만들어진다(부모가 열 때만 그린다). 동작 줄이기면 처음부터 결과
  const shake = useSharedValue(0);
  const lid = useSharedValue(reduce ? 1 : 0);
  const prize = useSharedValue(reduce ? 1 : 0);
  const [revealed, setRevealed] = useState(reduce);

  useEffect(() => {
    if (!visible || reduce) return;
    haptic.medium();
    shake.set(
      withSequence(
        withTiming(-10, { duration: 80 }),
        withTiming(10, { duration: 90 }),
        withTiming(-12, { duration: 90 }),
        withTiming(12, { duration: 90 }),
        withTiming(0, { duration: 110 }, (fin) => {
          if (!fin) return;
          lid.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
          prize.set(withDelay(120, withSpring(1, { damping: 9, stiffness: 160 })));
          scheduleOnRN(setRevealed, true);
          scheduleOnRN(haptic.success);
        }),
      ),
    );
  }, [visible, reduce, shake, lid, prize]);

  const boxStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value}deg` }] }));
  const lidStyle = useAnimatedStyle(() => ({
    opacity: 1 - lid.value,
    transform: [{ translateY: -80 * lid.value }, { translateX: 30 * lid.value }, { rotate: `${28 * lid.value}deg` }],
  }));
  const prizeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, prize.value * 2),
    transform: [{ translateY: -70 * prize.value }, { scale: 0.3 + prize.value * 0.9 }],
  }));

  const name = item ? itemById(item).name : null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { backgroundColor: p.card }]}>
          <View style={styles.stage}>
            <Animated.View style={[styles.prize, prizeStyle]}>
              {item ? <AccessoryGlyph id={item} size={96} /> : <Ionicons name="heart" size={64} color={p.accent} />}
            </Animated.View>
            <Animated.View style={[{ width: 150, height: 150, transformOrigin: '50% 90%' }, boxStyle]}>
              <View style={StyleSheet.absoluteFill}>
                <BoxBody size={150} color={p.accent} />
              </View>
              <Animated.View style={[StyleSheet.absoluteFill, lidStyle]}>
                <BoxLid size={150} color={p.accent} />
              </Animated.View>
            </Animated.View>
            {revealed && !reduce ? (
              <View style={styles.burst} pointerEvents="none">
                <PawBurst color={p.accent} size={18} />
              </View>
            ) : null}
          </View>
          {revealed ? (
            <Animated.View entering={reduce ? undefined : FadeIn.duration(220)} style={styles.result}>
              <Text style={[styles.resultTitle, { color: p.ink }]}>
                {name ? `새 소품 「${name}」!` : '모든 소품을 다 모았어요!'}
              </Text>
              <Text style={[styles.resultSub, { color: p.muted }]}>
                {name ? '꾸미기에서 강아지·고양이에게 씌워 줄 수 있어요' : '오늘도 함께해 줘서 고마워요. 내일 또 만나요'}
              </Text>
              <View style={styles.actions}>
                {item && onWear ? (
                  <Pressable
                    onPress={() => onWear(item)}
                    style={({ pressed }) => [styles.btn, { backgroundColor: p.accent, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                    <Text style={[styles.btnText, { color: p.onAccent }]}>바로 입혀 보기</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [styles.btn, { backgroundColor: p.surface, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                  <Text style={[styles.btnText, { color: p.ink }]}>닫기</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <Text style={[styles.resultSub, { color: p.muted, textAlign: 'center' }]}>두근두근…</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 26, padding: 14 },
  chestRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chestTitle: { fontSize: Type.cardTitle, fontWeight: '800', letterSpacing: -0.3 },
  chestSub: { fontSize: Type.footnote, marginTop: 2 },
  pips: { flexDirection: 'row', gap: 5, marginTop: 8 },
  pip: { width: 22, height: 6, borderRadius: 3 },
  openBtn: { paddingHorizontal: 16, height: 40, borderRadius: 20, justifyContent: 'center' },
  openText: { fontSize: Type.callout, fontWeight: '900' },
  scrim: { flex: 1, backgroundColor: 'rgba(25,15,10,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, borderRadius: 32, padding: 22, gap: 8 },
  stage: { height: 230, alignItems: 'center', justifyContent: 'flex-end' },
  prize: { position: 'absolute', bottom: 70 },
  burst: { position: 'absolute', bottom: 120, width: 0, height: 0, alignSelf: 'center' },
  result: { alignItems: 'center', gap: 6 },
  resultTitle: { fontSize: Type.headline, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  resultSub: { fontSize: Type.body, textAlign: 'center', lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, alignSelf: 'stretch' },
  btn: { flex: 1, height: 48, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: Type.callout, fontWeight: '800' },
});
