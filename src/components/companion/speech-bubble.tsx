import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PetAvatar } from '@/components/pet-avatar';
import { Text } from '@/components/text';
import { ClayShadow, Radius, Type } from '@/constants/theme';
import type { ChipTone, CompanionAction, CompanionMessage } from '@/data/companion';
import type { Pet } from '@/data/types';
import { useColorScheme, usePalette } from '@/hooks/use-theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** 한 글자 간격. 소리 내어 읽는 속도보다 조금 빨라야 기다리는 느낌이 없다 */
const TYPE_MS = 24;

/**
 * 꼬리 친구의 말풍선.
 *
 * 누르면 다음 소식으로 넘어간다. 꼬리는 지금 말하는 쪽(강아지·고양이)을 가리킨다.
 * 글자가 하나씩 써지는 동안 말풍선 높이가 출렁이지 않게, **완성된 문장을 투명하게 깔아
 * 자리를 먼저 잡고** 그 위에 써지는 글자를 겹친다.
 */
export function SpeechBubble({
  message,
  pets,
  index,
  total,
  tailX,
  reduce,
  onNext,
  onAction,
  onTyped,
}: {
  message: CompanionMessage;
  pets: Pet[];
  index: number;
  total: number;
  /** 말풍선 왼쪽에서 꼬리까지(px) */
  tailX: number;
  reduce: boolean;
  onNext: () => void;
  onAction: (a: CompanionAction) => void;
  /** 다 써졌을 때 — 자동 넘김 타이머가 여기서 시작한다 */
  onTyped: () => void;
}) {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const who = message.petIds.map((id) => pets.find((x) => x.petId === id)).filter((x): x is Pet => !!x);
  const urgent = message.priority <= 1 && message.kind !== 'welcome';
  const weather = message.kind === 'weather' || message.kind === 'weather-off';
  const title = who.length
    ? `${who.map((x) => x.name).join('·')} 소식`
    : weather
      ? message.tag
      : '꼬리 친구';

  const tail = useSharedValue(tailX);
  useEffect(() => {
    tail.set(reduce ? tailX : withTiming(tailX, { duration: 380, easing: Easing.bezier(0.77, 0, 0.175, 1) }));
  }, [tailX, reduce, tail]);
  const tailStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tail.value }, { rotate: '45deg' }] }));

  const tone = (t: ChipTone) =>
    t === 'good'
      ? { bg: p.successSoft, fg: p.success }
      : t === 'mid'
        ? { bg: p.warnSoft, fg: p.warn }
        : t === 'bad'
          ? { bg: p.dangerSoft, fg: p.danger }
          : { bg: p.surface, fg: p.ink };

  return (
    <View style={[styles.bubble, { backgroundColor: p.card, boxShadow: clay.rest }]}>
      <Animated.View pointerEvents="none" style={[styles.tail, { backgroundColor: p.card }, tailStyle]} />
      <Animated.View key={message.id} entering={reduce ? undefined : FadeIn.duration(200).easing(EASE_OUT)}>
        {/* 말 부분을 누르면 다음 소식. 아래 행동 버튼은 이 버튼 밖에 둔다(버튼 속 버튼 금지) */}
        <Pressable
          onPress={onNext}
          disabled={total < 2}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${message.text}`}
          accessibilityHint={total > 1 ? `${total}개 소식 중 ${index + 1}번째. 누르면 다음 소식` : undefined}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <View style={styles.head}>
          {who.length ? (
            <PetAvatar pet={who[0]} size={22} />
          ) : (
            <View style={[styles.mini, { backgroundColor: p.accentSoft }]}>
              <Ionicons name={weather ? 'partly-sunny' : 'paw'} size={13} color={p.accentDark} />
            </View>
          )}
          <Text style={[styles.who, { color: p.ink }]} numberOfLines={1}>
            {title}
          </Text>
          {!weather || who.length ? (
            <View
              style={[
                styles.tag,
                { backgroundColor: urgent ? p.dangerSoft : p.surface },
              ]}>
              <Text style={[styles.tagText, { color: urgent ? p.danger : p.muted }]}>{message.tag}</Text>
            </View>
          ) : null}
        </View>

        <TypeText key={`${message.id}:${message.text}:${reduce}`} text={message.text} reduce={reduce} onDone={onTyped} color={p.ink} caret={p.accent} />

        {message.chips?.length ? (
          <View style={styles.chips}>
            {message.chips.map((c) => {
              const t = tone(c.tone);
              return (
                <View key={c.label} style={[styles.chip, { backgroundColor: t.bg }]}>
                  <Ionicons name={c.icon as keyof typeof Ionicons.glyphMap} size={13} color={t.fg} />
                  <Text style={[styles.chipText, { color: t.fg }]}>{c.label}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
        </Pressable>

        {message.actions.length ? (
          <View style={styles.actions}>
            {message.actions.map((a, i) => (
              <Pressable
                key={a.label}
                onPress={() => onAction(a)}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: i === 0 ? p.accent : p.surface, transform: [{ scale: pressed ? 0.96 : 1 }] },
                ]}>
                <Text style={[styles.actionText, { color: i === 0 ? p.onAccent : p.ink }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Animated.View>

      {/* 몇 번째 소식인지 — 칩·버튼과 겹치지 않게 맨 아래 한 줄로 둔다 */}
      {total > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotOn, { backgroundColor: i === index ? p.accent : p.line }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TypeText({
  text,
  reduce,
  onDone,
  color,
  caret,
}: {
  text: string;
  reduce: boolean;
  onDone: () => void;
  color: string;
  caret: string;
}) {
  // 글이 바뀌면 부모가 key로 새로 만든다 — 그래서 여기서는 0부터 세기만 하면 된다
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) {
      onDone();
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) {
        clearInterval(timer);
        onDone();
      }
    }, TYPE_MS);
    return () => clearInterval(timer);
    // onDone은 부모가 매 렌더 새로 만든다 — 글이 바뀔 때만 다시 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduce]);

  const typing = n < text.length;
  return (
    <View style={styles.textBox}>
      {/* 자리 잡기용 — 완성된 문장 높이만큼 미리 차지한다 */}
      <Text style={[styles.text, styles.ghost]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {text}
      </Text>
      <Text style={[styles.text, styles.typed, { color }]}>
        {text.slice(0, n)}
        {typing ? <Text style={{ color: caret }}>▍</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 15,
  },
  tail: { position: 'absolute', left: 0, bottom: -8, width: 18, height: 18, borderRadius: 3, marginLeft: -9 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mini: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  who: { fontSize: Type.footnote, fontWeight: '800', flexShrink: 1 },
  tag: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  tagText: { fontSize: Type.micro, fontWeight: '800' },
  textBox: { marginTop: 7 },
  text: { fontSize: 16.5, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3 },
  ghost: { opacity: 0 },
  typed: { position: 'absolute', top: 0, left: 0, right: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.full },
  chipText: { fontSize: Type.caption, fontWeight: '800', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  action: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  actionText: { fontSize: Type.body, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, marginTop: 10, marginBottom: -3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 16 },
});
