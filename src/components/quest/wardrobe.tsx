import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { AccessoryGlyph } from '@/components/companion/accessories';
import { CompanionMascot } from '@/components/companion/mascot';
import { Text } from '@/components/text';
import { ClayShadow, Radius, Type } from '@/constants/theme';
import {
  ITEMS,
  RARITY_LABEL,
  SET_LABEL,
  SET_ORDER,
  setProgress,
  unlockText,
  type ItemId,
  type ItemSet,
  type JourneyState,
  type Rarity,
} from '@/data/quest-journey';
import { seasonNow } from '@/hooks/use-season-recap';
import { useColorScheme, usePalette } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

/** 희귀도 색 — 테마와 상관없이 같은 색(소품 색처럼) */
const RARITY_COLOR: Record<Rarity, string> = { common: 'transparent', rare: '#4C8DF5', legendary: '#E0A93B' };

/**
 * 꾸미기 — 모은 소품을 강아지·고양이에게 씌운다. 홈의 꼬리 친구에 그대로 보인다.
 *
 * 소품이 30개를 넘어 **세트별로** 본다(기본·산책·여행·파티·멋쟁이·사계절). 세트마다 몇 개 모았는지,
 * 지금 계절 세트는 "한정"으로 먼저 보인다. 아직 없는 소품도 얻는 길과 함께 보여 준다 —
 * 다음에 무엇을 얻는지 보여야 내일 또 올 이유가 생긴다. 같은 자리(머리·얼굴·목·등)는 하나만.
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
  const reduce = useReducedMotion();
  const [who, setWho] = useState<'dog' | 'cat'>(initialWho);
  const [cue, setCue] = useState(0);
  const season = seasonNow();
  const progress = useMemo(() => setProgress(journey.owned), [journey.owned]);

  // 처음 열 때: 새로 얻은 소품이 있는 세트 → 지금 계절 세트 → 기본
  const firstFresh = journey.fresh.length ? ITEMS.find((i) => i.id === journey.fresh[0])?.set : undefined;
  const [tab, setTab] = useState<ItemSet>(firstFresh ?? season);
  // 지금 계절 세트를 맨 앞에 — 한정이라는 걸 순서로도 말한다
  const tabs: ItemSet[] = [season, ...SET_ORDER.filter((s) => s !== season)];

  const wearing = journey.outfit[who];
  const isOn = (id: ItemId) => Object.values(wearing).includes(id);
  const items = ITEMS.filter((i) => i.set === tab);
  const prog = progress[tab];
  const total = ITEMS.length;
  const have = journey.owned.length;
  const isSeason = (s: ItemSet) => s === 'SPRING' || s === 'SUMMER' || s === 'AUTUMN' || s === 'WINTER';

  return (
    <View style={[styles.card, { backgroundColor: p.card, boxShadow: clay.rest }]}>
      <View style={styles.head}>
        <View>
          <Text style={[styles.title, { color: p.ink }]}>꼬리 친구 꾸미기</Text>
          <Text style={[styles.count, { color: p.muted }]}>
            모은 소품 {have}/{total}
          </Text>
        </View>
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
        <CompanionMascot width={250} speaker={who} mood="happy" cue={`wardrobe-${who}-${cue}`} active={active} outfit={journey.outfit} />
      </View>

      {/* 세트 탭 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map((s) => {
          const on = tab === s;
          const pr = progress[s];
          const done = pr.have === pr.total;
          const fresh = ITEMS.some((i) => i.set === s && journey.fresh.includes(i.id));
          return (
            <Pressable
              key={s}
              onPress={() => {
                haptic.light();
                setTab(s);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${SET_LABEL[s]} 세트, ${pr.have}/${pr.total}`}
              style={[styles.tab, { backgroundColor: on ? p.ink : p.surface, borderColor: on ? p.ink : p.line }]}>
              {s === season ? <Ionicons name="time" size={12} color={on ? p.bg : p.accentDark} /> : null}
              <Text style={[styles.tabText, { color: on ? p.bg : p.ink }]}>{SET_LABEL[s]}</Text>
              <Text style={[styles.tabCount, { color: on ? p.bg : p.muted }]}>{done ? '완성' : `${pr.have}/${pr.total}`}</Text>
              {fresh ? <View style={[styles.tabDot, { backgroundColor: p.dangerSolid }]} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 세트 머리말 — 진행 막대 */}
      <Animated.View key={tab} entering={reduce ? undefined : FadeIn.duration(200)} style={styles.setHead}>
        <View style={styles.setTitleRow}>
          <Text style={[styles.setTitle, { color: p.ink }]}>
            {SET_LABEL[tab]} 세트
            {tab === season ? <Text style={{ color: p.accentDark }}> · 지금만 상자에서 나와요</Text> : null}
            {isSeason(tab) && tab !== season ? <Text style={{ color: p.muted }}> · {SET_LABEL[tab]}에 열려요</Text> : null}
          </Text>
          {prog.have === prog.total ? (
            <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(12)} style={[styles.complete, { backgroundColor: p.accent }]}>
              <Ionicons name="ribbon" size={11} color={p.onAccent} />
              <Text style={[styles.completeText, { color: p.onAccent }]}>세트 완성</Text>
            </Animated.View>
          ) : null}
        </View>
        <View style={[styles.bar, { backgroundColor: p.surface }]}>
          <Animated.View
            layout={reduce ? undefined : LinearTransition.duration(260)}
            style={[styles.barFill, { width: `${(prog.have / prog.total) * 100}%`, backgroundColor: prog.have === prog.total ? p.success : p.accent }]}
          />
        </View>
      </Animated.View>

      <View style={styles.grid}>
        {items.map((it) => {
          const owned = journey.owned.includes(it.id);
          const on = isOn(it.id);
          const fresh = journey.fresh.includes(it.id);
          const rc = RARITY_COLOR[it.rarity];
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
              accessibilityLabel={`${it.name}, ${RARITY_LABEL[it.rarity]}${owned ? (on ? ', 입고 있음' : '') : `, ${unlockText(it.unlock, it.set)}`}`}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: on ? p.accentSoft : p.surface,
                  borderColor: on ? p.accent : owned && it.rarity !== 'common' ? rc : 'transparent',
                  transform: [{ scale: pressed ? 0.93 : 1 }],
                },
              ]}>
              <AccessoryGlyph id={it.id} size={40} dim={!owned} />
              <Text style={[styles.itemName, { color: owned ? p.ink : p.muted }]} numberOfLines={1}>
                {owned ? it.name : unlockText(it.unlock, it.set)}
              </Text>
              {it.rarity !== 'common' ? (
                <View style={[styles.rarity, { backgroundColor: rc }]}>
                  <Text style={styles.rarityText}>{RARITY_LABEL[it.rarity]}</Text>
                </View>
              ) : null}
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
      <Text style={[styles.foot, { color: p.muted }]}>간식 상자 · 연속 기록 · 여권 도장 · 계절 한정 상자로 모아요. 머리·얼굴·목·등에 하나씩.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: Type.cardTitle, fontWeight: '900' },
  count: { fontSize: Type.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
  seg: { flexDirection: 'row', borderRadius: Radius.full, padding: 3, gap: 2 },
  segBtn: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  segText: { fontSize: Type.caption, fontWeight: '800' },
  preview: { borderRadius: Radius.lg, alignItems: 'center', paddingVertical: 8 },
  tabs: { gap: 6, paddingRight: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  tabText: { fontSize: Type.footnote, fontWeight: '800' },
  tabCount: { fontSize: Type.micro, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tabDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 2 },
  setHead: { gap: 6 },
  setTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  setTitle: { fontSize: Type.body, fontWeight: '900', flexShrink: 1 },
  complete: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  completeText: { fontSize: Type.micro, fontWeight: '900' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { width: '31%', flexGrow: 1, maxWidth: '32.5%', alignItems: 'center', gap: 4, borderRadius: Radius.md, borderWidth: 2, paddingVertical: 10 },
  itemName: { fontSize: Type.caption, fontWeight: '800' },
  rarity: { position: 'absolute', top: 5, left: 5, borderRadius: Radius.full, paddingHorizontal: 5, paddingVertical: 1 },
  rarityText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  lock: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fresh: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4 },
  check: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  foot: { fontSize: Type.caption, lineHeight: 16 },
});
