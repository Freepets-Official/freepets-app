import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { CompanionMascot } from '@/components/companion/mascot';
import { TiltPressable } from '@/components/motion/tilt-pressable';
import { Text } from '@/components/text';
import { ClayShadow, LevelUpFonts, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { ALWAYS_FREE, PASS_FEATURES } from '@/data/pass';
import { usePass } from '@/hooks/use-pass';
import { useColorScheme, usePalette } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

/**
 * 꼬리패스 소개 · 사전 신청(출시 전).
 *
 * **신뢰부터 말한다.** 맨 위에 "판별은 계속 무료"를 두고, 그다음 돈을 받는 이유(헛걸음 보상·AI 플래너)를
 * 크게, 나머지는 비교표로. 사전 신청 때 가장 기대하는 기능을 받아 무엇부터 만들지 정한다.
 * 가격은 아직 정하지 않아 쓰지 않는다 — 신청은 결제가 아니라는 것도 분명히 적는다.
 */
export default function PassScreen() {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const pass = usePass();
  const joined = pass.waitlist;
  const [picked, setPicked] = useState<string[] | null>(null);
  const interests = picked ?? joined?.interests ?? [];
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => {
    haptic.light();
    setPicked((cur) => {
      const base = cur ?? joined?.interests ?? [];
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await pass.join(interests);
    setBusy(false);
    if (ok) {
      haptic.success();
      setEditing(false);
    }
  };

  const heroes = PASS_FEATURES.filter((f) => f.hero);
  const showForm = !joined || editing;

  return (
    <View style={[styles.fill, { backgroundColor: p.surface }]}>
      <Stack.Screen options={{ title: '꼬리패스' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* 표지 */}
        <Animated.View entering={reduce ? undefined : FadeIn.duration(360)} style={[styles.hero, { boxShadow: clay.rest }]}>
          <LinearGradient colors={['#FFE2D2', '#FFF3EA', p.card]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} />
          <View style={[styles.soon, { backgroundColor: p.accent }]}>
            <Text style={[styles.soonText, { color: p.onAccent }]}>출시 예정</Text>
          </View>
          <Text style={[styles.brand, { color: p.ink }]}>꼬리패스</Text>
          <Text style={[styles.tagline, { color: p.muted }]}>같이 가도 안심되는 구독</Text>
          <CompanionMascot
            width={Math.min(300, width - 64)}
            speaker="dog"
            mood="happy"
            props={['sparkles']}
            cue="pass"
            active
            outfit={{ dog: { head: 'crown' }, cat: { head: 'ribbon' } }}
          />
        </Animated.View>

        {/* 무료로 계속 */}
        <View style={[styles.freeCard, { backgroundColor: p.successSoft }]}>
          <Text style={[styles.freeTitle, { color: p.success }]}>지금 쓰는 건 계속 무료예요</Text>
          <View style={styles.freeList}>
            {ALWAYS_FREE.map((f) => (
              <View key={f} style={styles.freeItem}>
                <Ionicons name="checkmark-circle" size={15} color={p.success} />
                <Text style={[styles.freeText, { color: p.ink }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 핵심 두 가지 */}
        {heroes.map((f, i) => (
          <Animated.View
            key={f.id}
            entering={reduce ? undefined : FadeInDown.delay(120 + i * 100).duration(320)}
            style={[styles.heroFeature, { backgroundColor: p.card, boxShadow: clay.rest }]}>
            <View style={[styles.featureIcon, { backgroundColor: p.accentSoft }]}>
              <Ionicons name={f.icon as never} size={22} color={p.accentDark} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: p.ink }]}>{f.title}</Text>
              <Text style={[styles.featureBody, { color: p.muted }]}>{f.body}</Text>
            </View>
          </Animated.View>
        ))}

        {/* 비교표 */}
        <View style={[styles.table, { backgroundColor: p.card, boxShadow: clay.rest }]}>
          <View style={[styles.tr, styles.th, { borderBottomColor: p.line }]}>
            <Text style={[styles.tdName, styles.thText, { color: p.muted }]}>기능</Text>
            <Text style={[styles.td, styles.thText, { color: p.muted }]}>무료</Text>
            <Text style={[styles.td, styles.thText, { color: p.accentDark }]}>꼬리패스</Text>
          </View>
          {PASS_FEATURES.map((f, i) => (
            <View key={f.id} style={[styles.tr, i < PASS_FEATURES.length - 1 && { borderBottomColor: p.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.tdName, styles.nameCell]}>
                <Ionicons name={f.icon as never} size={14} color={p.accentDark} />
                <Text style={[styles.nameText, { color: p.ink }]}>{f.title}</Text>
              </View>
              <Text style={[styles.td, styles.tdText, { color: p.muted }]}>{f.free}</Text>
              <Text style={[styles.td, styles.tdText, styles.tdPass, { color: p.ink }]}>{f.pass}</Text>
            </View>
          ))}
        </View>

        {/* 사전 신청 */}
        {showForm ? (
          <View style={[styles.form, { backgroundColor: p.card, boxShadow: clay.rest }]}>
            <Text style={[styles.formTitle, { color: p.ink }]}>가장 기대되는 기능을 골라 주세요</Text>
            <Text style={[styles.formSub, { color: p.muted }]}>많이 고른 기능부터 먼저 만들어요. 여러 개 골라도 돼요.</Text>
            <View style={styles.chips}>
              {PASS_FEATURES.map((f) => {
                const on = interests.includes(f.id);
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => toggle(f.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={({ pressed }) => [
                      styles.chip,
                      { backgroundColor: on ? p.ink : p.surface, borderColor: on ? p.ink : p.line, transform: [{ scale: pressed ? 0.95 : 1 }] },
                    ]}>
                    <Ionicons name={(on ? 'checkmark' : f.icon) as never} size={14} color={on ? p.bg : p.accentDark} />
                    <Text style={[styles.chipText, { color: on ? p.bg : p.ink }]}>{f.title}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TiltPressable
              onPress={submit}
              disabled={busy || !pass.ready}
              accessibilityRole="button"
              maxTilt={2}
              style={(pressed) => [styles.cta, { backgroundColor: pressed ? p.accentDark : p.accent, opacity: pass.ready ? 1 : 0.6 }]}>
              <Ionicons name="notifications" size={18} color={p.onAccent} />
              <Text style={[styles.ctaText, { color: p.onAccent }]}>{joined ? '관심 기능 바꾸기' : '사전 신청하기'}</Text>
            </TiltPressable>
          </View>
        ) : (
          <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(13)} style={[styles.done, { backgroundColor: p.accentSoft }]}>
            <View style={[styles.doneIcon, { backgroundColor: p.accent }]}>
              <Ionicons name="checkmark" size={26} color={p.onAccent} />
            </View>
            <Text style={[styles.doneTitle, { color: p.ink }]}>사전 신청했어요!</Text>
            <Text style={[styles.doneBody, { color: p.muted }]}>출시되면 가장 먼저 알려 드릴게요.</Text>
            {joined?.interests.length ? (
              <Text style={[styles.doneBody, { color: p.ink }]}>
                기대하는 기능: {joined.interests.map((id) => PASS_FEATURES.find((f) => f.id === id)?.title).filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <Pressable onPress={() => setEditing(true)} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.link, { color: p.accentDark }]}>관심 기능 바꾸기</Text>
            </Pressable>
          </Animated.View>
        )}

        <Text style={[styles.foot, { color: p.muted }]}>사전 신청은 결제가 아니에요. 가격과 출시일은 정해지면 알려 드려요.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.lg, paddingBottom: 60, gap: Spacing.lg },
  hero: { borderRadius: Radius.xl, alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.md, overflow: 'hidden', gap: 2 },
  soon: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6 },
  soonText: { fontSize: Type.micro, fontWeight: '900', letterSpacing: 0.4 },
  brand: { fontFamily: LevelUpFonts.ko, fontSize: 40, lineHeight: 46 },
  tagline: { fontSize: Type.callout, fontWeight: '700', marginBottom: 4 },
  freeCard: { borderRadius: Radius.lg, padding: Spacing.lg, gap: 10 },
  freeTitle: { fontSize: Type.callout, fontWeight: '900' },
  freeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freeItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '47%' },
  freeText: { fontSize: Type.footnote, fontWeight: '700', flexShrink: 1 },
  heroFeature: { flexDirection: 'row', gap: 14, borderRadius: Radius.lg, padding: Spacing.lg },
  featureIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, gap: 4 },
  featureTitle: { fontSize: Type.sheetTitle, fontWeight: '900' },
  featureBody: { fontSize: Type.body, lineHeight: 20 },
  table: { borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 6 },
  th: { borderBottomWidth: 1 },
  thText: { fontSize: Type.caption, fontWeight: '800' },
  tdName: { flex: 1.3 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameText: { fontSize: Type.footnote, fontWeight: '800', flexShrink: 1 },
  td: { flex: 1, textAlign: 'center' },
  tdText: { fontSize: Type.caption, fontWeight: '700' },
  tdPass: { fontWeight: '900' },
  form: { borderRadius: Radius.xl, padding: Spacing.lg, gap: 10 },
  formTitle: { fontSize: Type.sheetTitle, fontWeight: '900' },
  formSub: { fontSize: Type.footnote, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: Type.footnote, fontWeight: '800' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.full, paddingVertical: 15, marginTop: 4 },
  ctaText: { fontSize: Type.callout, fontWeight: '900' },
  done: { borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: 6 },
  doneIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  doneTitle: { fontSize: Type.headline, fontWeight: '900' },
  doneBody: { fontSize: Type.body, lineHeight: 20, textAlign: 'center' },
  link: { fontSize: Type.footnote, fontWeight: '800', marginTop: 6 },
  foot: { fontSize: Type.caption, textAlign: 'center', lineHeight: 16 },
});
