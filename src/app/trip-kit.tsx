import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ResultBadge } from '@/components/badge';
import { TiltPressable } from '@/components/motion/tilt-pressable';
import { Text } from '@/components/text';
import { ClayShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { kstYmd } from '@/data/quest-journey';
import {
  healthChecks,
  nextTrip,
  packingList,
  readiness,
  tripWindow,
  type CheckStatus,
  type HealthItem,
} from '@/data/trip-kit';
import type { Pet } from '@/data/types';
import { DOC_MAX, useTripKit } from '@/hooks/use-trip-kit';
import { useColorScheme, usePalette } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { notify } from '@/lib/notify';
import { askReminderPermission } from '@/lib/quest-reminder';
import { planTripReminder } from '@/lib/trip-reminder';
import { useAppStore } from '@/store/app-store';

/**
 * 여행 안심 키트 — 떠나기 전 "이 아이가 이번 여행을 갈 준비가 됐나"를 한 화면에서.
 *
 * 건강(접종·예방약·몸무게) → 갈 곳 다시 확인 → 준비물 → 서류함 → 응급. 위에서 아래로
 * 떠나기 전 순서대로 놓았다. 점수(준비 정도)는 건강 절반·준비물 절반.
 */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function TripKitScreen() {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const router = useRouter();
  const reduce = useReducedMotion();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const { pets, calendarEvents, eventsOn, isMedTaken, checks, facilityById, loadFacility, recentDenialOf, loadCalendarMonth } = useAppStore();
  const kit = useTripKit();
  const today = kstYmd();

  // 이번 달·다음 달 일정을 받아 둔다 — 키트로 바로 들어와도 여행·예방약 일정이 보이게
  useEffect(() => {
    const ym = today.slice(0, 7);
    const [y, m] = ym.split('-').map(Number);
    void loadCalendarMonth(ym);
    void loadCalendarMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`);
    // 지난달 — 예방약 체크(최근 35일)를 보려고
    void loadCalendarMonth(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`);
  }, [today, loadCalendarMonth]);

  const wanted = Number(params.eventId);
  const event =
    (Number.isInteger(wanted) ? calendarEvents.find((e) => e.eventId === wanted && e.type === 'TRAVEL') : undefined) ??
    nextTrip(eventsOn, today);

  const win = event ? tripWindow(event, today) : null;
  const going: Pet[] = useMemo(() => (event?.petId != null ? pets.filter((x) => x.petId === event.petId) : pets), [event, pets]);
  const health = useMemo(
    () => (win ? healthChecks(going, win, { eventsOn, isMedTaken, today }) : []),
    [win, going, eventsOn, isMedTaken, today],
  );
  const sections = useMemo(() => (win ? packingList(going, win.nights) : []), [win, going]);
  const tripState = event ? kit.trip(event.eventId) : { checked: [], custom: [] };
  const packIds = [...sections.flatMap((s) => s.items.map((i) => i.id)), ...tripState.custom.map((c) => c.id)];
  const done = packIds.filter((id) => tripState.checked.includes(id)).length;
  const score = readiness(health, packIds, tripState.checked);
  const left = packIds.length - done;

  // 다녀올 곳 — 최근 30일 판별한 시설(같은 곳은 한 번)
  const places = useMemo(() => {
    // 렌더 중 Date.now()를 부르지 않는다 — 오늘(KST) 기준으로 30일
    const since = Date.parse(`${today}T00:00:00+09:00`) - 30 * 86_400_000;
    const seen = new Set<number>();
    return checks
      .filter((c) => Date.parse(c.createdAt) >= since && !seen.has(c.facilityId) && seen.add(c.facilityId))
      .slice(0, 5);
  }, [checks, today]);
  useEffect(() => {
    for (const c of places) if (!facilityById(c.facilityId)) void loadFacility(c.facilityId);
  }, [places, facilityById, loadFacility]);

  // 출발 전날 저녁 알림을 남은 개수로 다시 짠다(권한이 이미 있을 때만)
  const [reminderOn, setReminderOn] = useState<boolean | null>(null);
  const eventId = event?.eventId;
  const eventTitle = event?.title;
  const start = win?.start;
  useEffect(() => {
    if (eventId == null || !start || !eventTitle || Platform.OS === 'web') return;
    let alive = true;
    void planTripReminder({ eventId, start, title: eventTitle, left }).then((ok) => {
      if (alive) setReminderOn(ok);
    });
    return () => {
      alive = false;
    };
  }, [eventId, start, eventTitle, left]);

  if (!event || !win) {
    return (
      <View style={[styles.fill, { backgroundColor: p.surface }]}>
        <Stack.Screen options={{ title: '여행 안심 키트' }} />
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: p.accentSoft }]}>
            <Ionicons name="airplane" size={28} color={p.accentDark} />
          </View>
          <Text style={[styles.emptyTitle, { color: p.ink }]}>2주 안에 떠나는 여행이 없어요</Text>
          <Text style={[styles.emptyBody, { color: p.muted }]}>캘린더에 여행 일정을 넣으면 접종·준비물·갈 곳을 한 번에 챙겨 드려요.</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/calendar-event', params: { date: today } })}
            style={[styles.primary, { backgroundColor: p.accent }]}
            accessibilityRole="button">
            <Ionicons name="add" size={18} color={p.onAccent} />
            <Text style={[styles.primaryText, { color: p.onAccent }]}>여행 일정 넣기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const nameOf = (id: number) => pets.find((x) => x.petId === id)?.name ?? '';
  const scoreWord = score >= 0.95 ? '준비 끝!' : score >= 0.7 ? '거의 다 됐어요' : score >= 0.4 ? '반쯤 챙겼어요' : '이제 시작해요';

  return (
    <View style={[styles.fill, { backgroundColor: p.surface }]}>
      <Stack.Screen options={{ title: '여행 안심 키트' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* 여행 + 준비 정도 */}
        <Animated.View entering={reduce ? undefined : FadeInDown.duration(320)} style={[styles.hero, { boxShadow: clay.rest }]}>
          <LinearGradient colors={[p.accentSoft, p.card]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={styles.heroText}>
            <Text style={[styles.dday, { color: p.accentDark }]}>{win.ongoing ? '여행 중' : win.dday === 0 ? '오늘 출발' : `D-${win.dday}`}</Text>
            <Text style={[styles.tripTitle, { color: p.ink }]} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={[styles.tripMeta, { color: p.muted }]}>
              {md(win.start)}
              {win.nights > 0 ? ` ~ ${md(win.end)} · ${win.nights}박` : ' · 당일'}
            </Text>
            <View style={styles.petRow}>
              {going.map((x) => (
                <View key={x.petId} style={[styles.petChip, { backgroundColor: p.card }]}>
                  <Text style={[styles.petChipText, { color: p.ink }]}>{x.name}</Text>
                </View>
              ))}
            </View>
          </View>
          <Ring value={score} label={scoreWord} />
        </Animated.View>

        {/* 건강 */}
        <Section title="건강 체크" caption="떠나기 전에 병원에 들를 일이 있는지">
          {health.map((h, i) => (
            <Animated.View key={h.id} entering={reduce ? undefined : FadeInDown.delay(60 + i * 40).duration(260)}>
              <HealthRow
                item={h}
                petName={going.length > 1 ? nameOf(h.petId) : ''}
                onFix={() => {
                  if (h.fix === 'pet') router.push('/(tabs)/pets');
                  else router.push({ pathname: '/calendar-event', params: { date: today } });
                }}
              />
            </Animated.View>
          ))}
        </Section>

        {/* 갈 곳 */}
        <Section title="갈 곳 다시 확인" caption="조건은 바뀔 수 있어요. 출발 전날 한 번 더 보면 헛걸음이 줄어요">
          {places.length ? (
            places.map((c) => {
              const f = facilityById(c.facilityId);
              const denial = recentDenialOf(c.facilityId);
              return (
                <Pressable
                  key={c.facilityId}
                  onPress={() => router.push({ pathname: '/facility/[id]', params: { id: String(c.facilityId) } })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.placeRow, { backgroundColor: p.card, opacity: pressed ? 0.85 : 1 }]}>
                  <View style={styles.placeText}>
                    <Text style={[styles.placeName, { color: p.ink }]} numberOfLines={1}>
                      {f?.name ?? '시설 정보를 불러오는 중'}
                    </Text>
                    {denial ? (
                      <Text style={[styles.placeWarn, { color: p.danger }]} numberOfLines={1}>
                        최근 거부 제보가 있어요 — 다시 판별해 보세요
                      </Text>
                    ) : (
                      <Text style={[styles.placeSub, { color: p.muted }]}>{md(kstYmdOf(c.createdAt))}에 판별</Text>
                    )}
                  </View>
                  <ResultBadge result={c.overall} />
                </Pressable>
              );
            })
          ) : (
            <Text style={[styles.note, { color: p.muted }]}>아직 이번 여행에서 갈 곳을 판별하지 않았어요.</Text>
          )}
          <View style={styles.btnRow}>
            <Pressable onPress={() => router.push('/course')} accessibilityRole="button" style={[styles.ghostBtn, { borderColor: p.accent }]}>
              <Ionicons name="map" size={15} color={p.accentDark} />
              <Text style={[styles.ghostText, { color: p.accentDark }]}>코스로 한 번에 판별</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/explore')} accessibilityRole="button" style={[styles.ghostBtn, { borderColor: p.line }]}>
              <Ionicons name="search" size={15} color={p.ink} />
              <Text style={[styles.ghostText, { color: p.ink }]}>장소 찾기</Text>
            </Pressable>
          </View>
        </Section>

        {/* 준비물 */}
        <Section title="준비물" caption={`${done}/${packIds.length} 챙김${win.nights > 0 ? ` · ${win.nights}박 기준` : ''}`}>
          {sections.map((s) => (
            <View key={s.key} style={styles.packGroup}>
              <Text style={[styles.packTitle, { color: p.muted }]}>{s.title}</Text>
              {s.items.map((it) => (
                <CheckRow
                  key={it.id}
                  label={it.label}
                  hint={it.hint}
                  checked={tripState.checked.includes(it.id)}
                  onToggle={() => {
                    haptic.light();
                    kit.toggle(event.eventId, it.id);
                  }}
                />
              ))}
            </View>
          ))}
          <View style={styles.packGroup}>
            <Text style={[styles.packTitle, { color: p.muted }]}>내가 더한 것</Text>
            {tripState.custom.map((c) => (
              <CheckRow
                key={c.id}
                label={c.label}
                checked={tripState.checked.includes(c.id)}
                onToggle={() => {
                  haptic.light();
                  kit.toggle(event.eventId, c.id);
                }}
                onRemove={() => kit.removeCustom(event.eventId, c.id)}
              />
            ))}
            <AddItem onAdd={(label) => kit.addCustom(event.eventId, label)} />
          </View>
        </Section>

        {/* 서류함 */}
        <Section title="서류함" caption="접종증명서·동물등록증을 사진으로 — 숙소에서 바로 보여 줄 수 있어요">
          {going.map((x) => (
            <DocShelf key={x.petId} pet={x} docs={kit.docs[String(x.petId)] ?? []} onAdd={(src) => kit.addDoc(x.petId, src)} onRemove={(u) => kit.removeDoc(x.petId, u)} />
          ))}
        </Section>

        {/* 응급 */}
        <Section title="응급할 때" caption="지금 있는 곳 근처로 지도 앱에서 찾아요">
          <View style={styles.btnRow}>
            <TiltPressable
              onPress={() => void Linking.openURL(`https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent('24시 동물병원')}`)}
              accessibilityRole="link"
              style={[styles.sosBtn, { backgroundColor: p.dangerSoft }]}>
              <Ionicons name="medkit" size={18} color={p.danger} />
              <Text style={[styles.sosText, { color: p.danger }]}>24시 동물병원</Text>
            </TiltPressable>
            <TiltPressable
              onPress={() => void Linking.openURL(`https://map.kakao.com/link/search/${encodeURIComponent('동물병원')}`)}
              accessibilityRole="link"
              style={[styles.sosBtn, { backgroundColor: p.card }]}>
              <Ionicons name="location" size={18} color={p.ink} />
              <Text style={[styles.sosText, { color: p.ink }]}>근처 동물병원</Text>
            </TiltPressable>
          </View>
          <Text style={[styles.note, { color: p.muted }]}>운영 시간은 출발 전에 전화로 확인해 두세요.</Text>
        </Section>

        {/* 알림 */}
        {Platform.OS !== 'web' && !win.ongoing && win.dday >= 1 ? (
          reminderOn ? (
            <Text style={[styles.note, styles.center, { color: p.muted }]}>
              <Ionicons name="notifications" size={12} color={p.muted} /> 출발 전날 저녁 8시에 남은 준비물을 알려 드려요
            </Text>
          ) : reminderOn === false ? (
            <Pressable
              onPress={async () => {
                if (await askReminderPermission()) setReminderOn(await planTripReminder({ eventId: event.eventId, start: win.start, title: event.title, left }));
                else notify('알림을 켤 수 없어요', '설정 앱에서 반갑꼬리 알림을 허용해 주세요.');
              }}
              accessibilityRole="button"
              style={[styles.ghostBtn, styles.center, { borderColor: p.line }]}>
              <Ionicons name="notifications-outline" size={15} color={p.ink} />
              <Text style={[styles.ghostText, { color: p.ink }]}>출발 전날 알림 받기</Text>
            </Pressable>
          ) : null
        ) : null}
      </ScrollView>
    </View>
  );
}

/* ───────── 조각 ───────── */

const md = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;
const kstYmdOf = (iso: string) => new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10);

function Section({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: p.ink }]}>{title}</Text>
        {caption ? <Text style={[styles.sectionCaption, { color: p.muted }]}>{caption}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** 준비 정도 고리 — 값이 바뀌면 부드럽게 차오른다 */
function Ring({ value, label }: { value: number; label: string }) {
  const p = usePalette();
  const reduce = useReducedMotion();
  const R = 34;
  const C = 2 * Math.PI * R;
  const v = useSharedValue(reduce ? value : 0);
  useEffect(() => {
    v.set(reduce ? value : withTiming(value, { duration: 700 }));
  }, [value, reduce, v]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - v.value) }));
  return (
    <View style={styles.ring} accessible accessibilityLabel={`준비 ${Math.round(value * 100)}%, ${label}`}>
      <Svg width={84} height={84} viewBox="0 0 84 84">
        <Circle cx={42} cy={42} r={R} stroke={p.line} strokeWidth={8} fill="none" />
        <AnimatedCircle
          cx={42}
          cy={42}
          r={R}
          stroke={value >= 0.95 ? p.success : p.accent}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${C} ${C}`}
          animatedProps={props}
          transform="rotate(-90 42 42)"
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringValue, { color: p.ink }]}>{Math.round(value * 100)}</Text>
        <Text style={[styles.ringUnit, { color: p.muted }]}>%</Text>
      </View>
      <Text style={[styles.ringLabel, { color: p.accentDark }]}>{label}</Text>
    </View>
  );
}

const STATUS_ICON: Record<CheckStatus, string> = { ok: 'checkmark-circle', warn: 'alert-circle', bad: 'close-circle', info: 'information-circle' };

function HealthRow({ item, petName, onFix }: { item: HealthItem; petName: string; onFix: () => void }) {
  const p = usePalette();
  const color = { ok: p.success, warn: p.warn, bad: p.danger, info: p.muted }[item.status];
  const soft = { ok: p.successSoft, warn: p.warnSoft, bad: p.dangerSoft, info: p.card }[item.status];
  return (
    <View style={[styles.healthRow, { backgroundColor: soft }]}>
      <Ionicons name={STATUS_ICON[item.status] as never} size={22} color={color} />
      <View style={styles.healthText}>
        <Text style={[styles.healthTitle, { color: p.ink }]}>
          {petName ? <Text style={{ color }}>{petName} · </Text> : null}
          {item.title}
        </Text>
        <Text style={[styles.healthDetail, { color: p.muted }]}>{item.detail}</Text>
      </View>
      {item.fix && item.status !== 'ok' ? (
        <Pressable onPress={onFix} hitSlop={6} accessibilityRole="button" style={[styles.fixBtn, { borderColor: color }]}>
          <Text style={[styles.fixText, { color }]}>{item.fix === 'pet' ? '고치기' : '일정 넣기'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CheckRow({ label, hint, checked, onToggle, onRemove }: { label: string; hint?: string; checked: boolean; onToggle: () => void; onRemove?: () => void }) {
  const p = usePalette();
  const reduce = useReducedMotion();
  return (
    <Animated.View layout={reduce ? undefined : LinearTransition.duration(180)}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={({ pressed }) => [styles.checkRow, { backgroundColor: p.card, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
        <View style={[styles.box, { borderColor: checked ? p.accent : p.line, backgroundColor: checked ? p.accent : 'transparent' }]}>
          {checked ? (
            <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(12)}>
              <Ionicons name="checkmark" size={15} color={p.onAccent} />
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.checkText}>
          <Text style={[styles.checkLabel, { color: checked ? p.muted : p.ink, textDecorationLine: checked ? 'line-through' : 'none' }]}>{label}</Text>
          {hint && !checked ? <Text style={[styles.checkHint, { color: p.muted }]}>{hint}</Text> : null}
        </View>
        {onRemove ? (
          <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label} 빼기`}>
            <Ionicons name="close" size={16} color={p.muted} />
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function AddItem({ onAdd }: { onAdd: (label: string) => void }) {
  const p = usePalette();
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText('');
  };
  return (
    <View style={[styles.addRow, { borderColor: p.line }]}>
      <Ionicons name="add" size={18} color={p.muted} />
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder="챙길 것 더하기 (예: 수영 조끼)"
        placeholderTextColor={p.muted}
        returnKeyType="done"
        maxLength={30}
        style={[styles.addInput, { color: p.ink }]}
        accessibilityLabel="준비물 더하기"
      />
      {text.trim() ? (
        <Pressable onPress={submit} accessibilityRole="button" style={[styles.addBtn, { backgroundColor: p.accent }]}>
          <Text style={[styles.addBtnText, { color: p.onAccent }]}>추가</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DocShelf({ pet, docs, onAdd, onRemove }: { pet: Pet; docs: string[]; onAdd: (src: string) => Promise<boolean>; onRemove: (uri: string) => void }) {
  const p = usePalette();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const add = async () => {
    if (busy || docs.length >= DOC_MAX) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (r.canceled || !r.assets[0]) return;
    setBusy(true);
    const ok = await onAdd(r.assets[0].uri);
    setBusy(false);
    if (ok) haptic.success();
    else notify('사진을 넣지 못했어요', '다른 사진으로 다시 시도해 주세요.');
  };
  return (
    <View style={[styles.docCard, { backgroundColor: p.card }]}>
      <Text style={[styles.docName, { color: p.ink }]}>{pet.name}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.docRow}>
        {docs.map((u) => (
          <Animated.View key={u} entering={ZoomIn.springify().damping(13)}>
            <Pressable onPress={() => setView(u)} accessibilityRole="imagebutton" accessibilityLabel={`${pet.name} 서류 크게 보기`}>
              <Image source={{ uri: u }} style={[styles.docThumb, { borderColor: p.line }]} contentFit="cover" />
            </Pressable>
          </Animated.View>
        ))}
        {docs.length < DOC_MAX ? (
          <Pressable onPress={add} accessibilityRole="button" accessibilityLabel={`${pet.name} 서류 사진 넣기`} style={[styles.docAdd, { borderColor: p.accent }]}>
            <Ionicons name={busy ? 'hourglass-outline' : 'document-attach'} size={20} color={p.accentDark} />
            <Text style={[styles.docAddText, { color: p.accentDark }]}>{busy ? '넣는 중' : '사진 넣기'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <View style={styles.viewer}>
          {view ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.fill}>
              <Pressable style={styles.fill} onPress={() => setView(null)} accessibilityLabel="닫기">
                <Image source={{ uri: view }} style={styles.fill} contentFit="contain" />
              </Pressable>
            </Animated.View>
          ) : null}
          <View style={styles.viewerBar}>
            <Pressable
              onPress={() => {
                if (view) onRemove(view);
                setView(null);
              }}
              accessibilityRole="button"
              style={styles.viewerBtn}>
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
              <Text style={styles.viewerText}>지우기</Text>
            </Pressable>
            <Pressable onPress={() => setView(null)} accessibilityRole="button" style={styles.viewerBtn}>
              <Ionicons name="close" size={16} color="#FFFFFF" />
              <Text style={styles.viewerText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignSelf: 'center', textAlign: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.lg, paddingBottom: 60, gap: Spacing.xl },
  hero: { borderRadius: Radius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, overflow: 'hidden' },
  heroText: { flex: 1, gap: 2 },
  dday: { fontSize: Type.footnote, fontWeight: '900', letterSpacing: 0.4 },
  tripTitle: { fontSize: Type.headline, lineHeight: 28, fontWeight: '900', letterSpacing: -0.5 },
  tripMeta: { fontSize: Type.footnote, fontWeight: '700', fontVariant: ['tabular-nums'] },
  petRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  petChip: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  petChipText: { fontSize: Type.caption, fontWeight: '800' },
  ring: { alignItems: 'center', gap: 2 },
  ringCenter: { position: 'absolute', top: 0, width: 84, height: 84, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingTop: 28 },
  ringValue: { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  ringUnit: { fontSize: Type.caption, fontWeight: '800' },
  ringLabel: { fontSize: Type.micro, fontWeight: '800' },
  section: { gap: Spacing.sm },
  sectionHead: { gap: 2 },
  sectionTitle: { fontSize: Type.sheetTitle, fontWeight: '900', letterSpacing: -0.3 },
  sectionCaption: { fontSize: Type.caption, lineHeight: 16 },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, padding: Spacing.md },
  healthText: { flex: 1, gap: 2 },
  healthTitle: { fontSize: Type.bodyLg, fontWeight: '800' },
  healthDetail: { fontSize: Type.caption, lineHeight: 16 },
  fixBtn: { borderWidth: 1.5, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  fixText: { fontSize: Type.caption, fontWeight: '800' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, padding: Spacing.md },
  placeText: { flex: 1, gap: 2 },
  placeName: { fontSize: Type.bodyLg, fontWeight: '800' },
  placeSub: { fontSize: Type.caption },
  placeWarn: { fontSize: Type.caption, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 9 },
  ghostText: { fontSize: Type.footnote, fontWeight: '800' },
  note: { fontSize: Type.caption, lineHeight: 16 },
  packGroup: { gap: 6 },
  packTitle: { fontSize: Type.caption, fontWeight: '800', marginTop: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11 },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { flex: 1, gap: 1 },
  checkLabel: { fontSize: Type.bodyLg, fontWeight: '700' },
  checkHint: { fontSize: Type.caption, lineHeight: 15 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  addInput: { flex: 1, fontSize: Type.body, paddingVertical: 6 },
  addBtn: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { fontSize: Type.caption, fontWeight: '800' },
  docCard: { borderRadius: Radius.md, padding: Spacing.md, gap: 8 },
  docName: { fontSize: Type.body, fontWeight: '800' },
  docRow: { gap: 8 },
  docThumb: { width: 76, height: 96, borderRadius: 10, borderWidth: 1 },
  docAdd: { width: 76, height: 96, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  docAddText: { fontSize: Type.micro, fontWeight: '800' },
  sosBtn: { flex: 1, minWidth: 140, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.md, paddingVertical: 14 },
  sosText: { fontSize: Type.body, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: Type.sheetTitle, fontWeight: '900' },
  emptyBody: { fontSize: Type.body, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 12, marginTop: 8 },
  primaryText: { fontSize: Type.callout, fontWeight: '800' },
  viewer: { flex: 1, backgroundColor: 'rgba(12,9,7,0.95)' },
  viewerBar: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  viewerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.16)' },
  viewerText: { color: '#FFFFFF', fontSize: Type.footnote, fontWeight: '800' },
});
