import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { AccessoryGlyph } from '@/components/companion/accessories';
import { CompanionMascot } from '@/components/companion/mascot';
import { Text } from '@/components/text';
import { ClayShadow, Radius, Type } from '@/constants/theme';
import { ITEMS, type ItemId, type JourneyState } from '@/data/quest-journey';
import { useColorScheme, usePalette } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

/**
 * 꾸미기 — 모은 소품을 강아지·고양이에게 씌운다. 홈의 꼬리 친구에 그대로 보인다.
 *
 * 아직 없는 소품도 자물쇠와 함께 보여준다("7일 연속이면 열려요") — 다음에 무엇을 얻는지
 * 보여야 내일 또 올 이유가 생긴다. 같은 자리(머리·목·얼굴)는 하나만 쓴다.
 */
export function Wardrobe({
  journey,
  onToggle,
  active,
  initialWho = 'dog',
}: {
  journey: JourneyState;
  onToggle: (who: 'dog' | 'cat', id: ItemId) => void;
  active: boolean;
  initialWho?: 'dog' | 'cat';
}) {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const [who, setWho] = useState<'dog' | 'cat'>(initialWho);
  const [cue, setCue] = useState(0);
  const wearing = journey.outfit[who];
  const isOn = (id: ItemId) => Object.values(wearing).includes(id);

  return (
    <View style={[styles.card, { backgroundColor: p.card, boxShadow: clay.rest }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: p.ink }]}>꼬리 친구 꾸미기</Text>
        <View style={[styles.seg, { backgroundColor: p.surface }]}>
          {(['dog', 'cat'] as const).map((w) => (
            <Pressable
              key={w}
              onPress={() => {
                haptic.light();
                setWho(w);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: who === w }}
              style={[styles.segBtn, who === w && { backgroundColor: p.card, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }]}>
              <Text style={[styles.segText, { color: who === w ? p.ink : p.muted }]}>{w === 'dog' ? '강아지' : '고양이'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.preview, { backgroundColor: p.surface }]}>
        <CompanionMascot
          width={250}
          speaker={who}
          mood="happy"
          cue={`wardrobe-${who}-${cue}`}
          active={active}
          outfit={journey.outfit}
        />
      </View>

      <View style={styles.grid}>
        {ITEMS.map((it) => {
          const owned = journey.owned.includes(it.id);
          const on = isOn(it.id);
          const fresh = journey.fresh.includes(it.id);
          return (
            <Pressable
              key={it.id}
              disabled={!owned}
              onPress={() => {
                haptic.light();
                onToggle(who, it.id);
                setCue((c) => c + 1);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: !owned }}
              accessibilityLabel={owned ? `${it.name}${on ? ', 입고 있음' : ''}` : `${it.name}, ${unlockText(it.unlock)}`}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: on ? p.accentSoft : p.surface,
                  borderColor: on ? p.accent : 'transparent',
                  transform: [{ scale: pressed ? 0.93 : 1 }],
                },
              ]}>
              <AccessoryGlyph id={it.id} size={40} dim={!owned} />
              <Text style={[styles.itemName, { color: owned ? p.ink : p.muted }]} numberOfLines={1}>
                {owned ? it.name : unlockText(it.unlock)}
              </Text>
              {!owned ? (
                <View style={[styles.lock, { backgroundColor: p.card }]}>
                  <Ionicons name="lock-closed" size={10} color={p.muted} />
                </View>
              ) : null}
              {fresh ? <Animated.View entering={ZoomIn.springify()} style={[styles.fresh, { backgroundColor: p.dangerSolid }]} /> : null}
              {on ? (
                <View style={[styles.check, { backgroundColor: p.accent }]}>
                  <Ionicons name="checkmark" size={11} color={p.onAccent} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.foot, { color: p.muted }]}>
        간식 상자에서 {ITEMS.filter((i) => i.unlock === 'chest').length}가지, 연속 기록 3·7·14·30일에 하나씩 열려요
      </Text>
    </View>
  );
}

const unlockText = (u: 'chest' | number) => (u === 'chest' ? '상자에서' : `${u}일 연속`);

const styles = StyleSheet.create({
  card: { borderRadius: 26, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: Type.cardTitle, fontWeight: '800', letterSpacing: -0.3 },
  seg: { flexDirection: 'row', borderRadius: Radius.full, padding: 3 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  segText: { fontSize: Type.footnote, fontWeight: '800' },
  preview: { borderRadius: 20, alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { width: '18.4%', minWidth: 58, aspectRatio: 0.82, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 2 },
  itemName: { fontSize: 10, fontWeight: '800' },
  lock: { position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fresh: { position: 'absolute', top: 5, left: 5, width: 8, height: 8, borderRadius: 4 },
  check: { position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  foot: { fontSize: Type.caption, textAlign: 'center' },
});
