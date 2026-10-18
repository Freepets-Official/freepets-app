import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TiltPressable } from '@/components/motion/tilt-pressable';
import { Text } from '@/components/text';
import { ClayShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { DIARY_MAX_NOTE, DIARY_MAX_PHOTOS } from '@/data/day-diary';
import { CAL_EVENT_META } from '@/data/types';
import { useDayDiary } from '@/hooks/use-day-diary';
import { useColorScheme, usePalette } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { notify } from '@/lib/notify';
import { useAppStore } from '@/store/app-store';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 하루 기록 — 그날 찍은 사진과 짧은 글.
 *
 * **저장 버튼이 없다.** 사진은 넣고 빼는 즉시, 글은 손을 멈추면 잠시 뒤 저장한다. 기록은
 * "남기고 싶을 때 툭" 하는 일이라, 저장을 깜빡해 날아가는 순간 다시는 안 쓰게 된다.
 */
export default function DayDiaryScreen() {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const reduce = useReducedMotion();
  const params = useLocalSearchParams<{ date?: string; photo?: string }>();
  const date = typeof params.date === 'string' && YMD.test(params.date) ? params.date : null;
  const diary = useDayDiary();
  const { eventsOn } = useAppStore();

  const saved = date ? diary.day(date) : undefined;
  const [photos, setPhotos] = useState<string[]>(() => saved?.photos ?? []);
  const [note, setNote] = useState(() => saved?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const startPhoto = params.photo != null ? Number(params.photo) : NaN;
  const [viewer, setViewer] = useState<number | null>(() => (Number.isInteger(startPhoto) && startPhoto >= 0 ? startPhoto : null));

  // 기록을 늦게 읽어 온 경우(앱을 막 켜고 바로 들어온 경우) 한 번만 채운다
  const [hydrated, setHydrated] = useState(!!saved);
  if (!hydrated && saved) {
    setHydrated(true);
    setPhotos(saved.photos);
    setNote(saved.note);
  }

  // 가장 최근 값으로 저장한다 — 글 저장 타이머가 옛 사진 목록으로 덮어쓰지 않게
  const latest = useRef({ photos, note });
  useEffect(() => {
    latest.current = { photos, note };
  }, [photos, note]);
  const saveRef = useRef(diary.saveDay);
  useEffect(() => {
    saveRef.current = diary.saveDay;
  }, [diary.saveDay]);

  const persist = async () => {
    if (!date) return;
    setStatus('saving');
    const ok = await saveRef.current(date, latest.current);
    setStatus(ok ? 'saved' : 'failed');
    if (!ok) notify('저장하지 못했어요', '기기 저장 공간이 부족할 수 있어요. 사진을 조금 줄여 다시 시도해 주세요.');
  };

  // 글은 손을 멈추고 0.7초 뒤 저장
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNote = (v: string) => {
    setNote(v.slice(0, DIARY_MAX_NOTE));
    setStatus('idle');
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => void persist(), 700);
  };
  // 화면을 떠날 때 아직 안 쓴 글을 저장한다
  useEffect(
    () => () => {
      if (noteTimer.current) {
        clearTimeout(noteTimer.current);
        if (date) void saveRef.current(date, latest.current);
      }
    },
    [date],
  );

  const addPhotos = async () => {
    const room = DIARY_MAX_PHOTOS - photos.length;
    if (room <= 0 || busy) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
      quality: 1, // 원본으로 받고 줄이기는 저장 단계에서
      exif: false,
    });
    if (res.canceled || !res.assets.length) return;
    setBusy(true);
    const stored: string[] = [];
    for (const a of res.assets.slice(0, room)) {
      const u = await diary.addPhoto(a.uri);
      if (u) stored.push(u);
    }
    setBusy(false);
    if (!stored.length) {
      notify('사진을 넣지 못했어요', '다른 사진으로 다시 시도해 주세요.');
      return;
    }
    haptic.success();
    const next = [...latest.current.photos, ...stored].slice(0, DIARY_MAX_PHOTOS);
    latest.current = { ...latest.current, photos: next };
    setPhotos(next);
    void persist();
  };

  const removePhoto = (u: string) => {
    haptic.light();
    const next = latest.current.photos.filter((x) => x !== u);
    latest.current = { ...latest.current, photos: next };
    setPhotos(next);
    setViewer((v) => (v == null ? null : next.length ? Math.min(v, next.length - 1) : null));
    void persist();
  };
  const makeCover = (u: string) => {
    haptic.light();
    const next = [u, ...latest.current.photos.filter((x) => x !== u)];
    latest.current = { ...latest.current, photos: next };
    setPhotos(next);
    setViewer(0);
    void persist();
  };

  if (!date) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.surface }]}>
        <Text style={[styles.hint, { color: p.muted, padding: Spacing.xl }]}>날짜를 찾지 못했어요.</Text>
      </SafeAreaView>
    );
  }

  const d = new Date(`${date}T00:00:00`);
  const events = eventsOn(date);

  return (
    <View style={[styles.safe, { backgroundColor: p.surface }]}>
      <Stack.Screen options={{ title: `${d.getMonth() + 1}월 ${d.getDate()}일 기록` }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {/* 날짜 */}
        <View style={styles.head}>
          <Text style={[styles.big, { color: p.ink }]}>{d.getDate()}</Text>
          <View style={styles.headText}>
            <Text style={[styles.week, { color: p.ink }]}>
              {d.getFullYear()}년 {d.getMonth() + 1}월 · {WEEKDAYS[d.getDay()]}요일
            </Text>
            <SaveState status={status} />
          </View>
        </View>

        {events.length ? (
          <View style={styles.chips}>
            {events.map((e) => (
              <View key={e.eventId} style={[styles.chip, { backgroundColor: CAL_EVENT_META[e.type].soft }]}>
                <View style={[styles.chipDot, { backgroundColor: CAL_EVENT_META[e.type].color }]} />
                <Text style={[styles.chipText, { color: p.ink }]} numberOfLines={1}>
                  {e.title}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 사진 — 손으로 붙인 앨범처럼 조금씩 기울어 있다 */}
        <View style={[styles.card, { backgroundColor: p.card, boxShadow: clay.rest }]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: p.ink }]}>사진</Text>
            <Text style={[styles.count, { color: p.muted }]}>
              {photos.length}/{DIARY_MAX_PHOTOS}
            </Text>
          </View>
          <View style={styles.grid}>
            {photos.map((u, i) => (
              <Animated.View
                key={u}
                entering={reduce ? undefined : ZoomIn.springify().damping(14)}
                exiting={reduce ? undefined : FadeOut.duration(150)}
                layout={reduce ? undefined : LinearTransition.springify().damping(16)}
                style={styles.tileWrap}>
                <Pressable
                  onPress={() => setViewer(i)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`사진 ${i + 1} 크게 보기`}
                  style={({ pressed }) => [
                    styles.tile,
                    { borderColor: p.card, transform: [{ rotate: `${TILT[i % TILT.length]}deg` }, { scale: pressed ? 0.95 : 1 }] },
                  ]}>
                  <Image source={{ uri: u }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
                  {i === 0 ? (
                    <View style={[styles.cover, { backgroundColor: p.accent }]}>
                      <Text style={[styles.coverText, { color: p.onAccent }]}>달력 표지</Text>
                    </View>
                  ) : null}
                </Pressable>
              </Animated.View>
            ))}
            {photos.length < DIARY_MAX_PHOTOS ? (
              <Animated.View layout={reduce ? undefined : LinearTransition.springify().damping(16)} style={styles.tileWrap}>
                <TiltPressable
                  onPress={addPhotos}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="사진 추가"
                  style={(pressed) => [styles.addTile, { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : p.surface }]}>
                  <Ionicons name={busy ? 'hourglass-outline' : 'camera'} size={22} color={p.accentDark} />
                  <Text style={[styles.addText, { color: p.accentDark }]}>{busy ? '넣는 중' : '사진 추가'}</Text>
                </TiltPressable>
              </Animated.View>
            ) : null}
          </View>
          {photos.length === 0 ? (
            <Text style={[styles.hint, { color: p.muted }]}>첫 사진이 달력 칸에 작게 보여요. 사진을 누르면 크게 볼 수 있어요.</Text>
          ) : null}
        </View>

        {/* 글 */}
        <View style={[styles.card, { backgroundColor: p.card, boxShadow: clay.rest }]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: p.ink }]}>오늘의 이야기</Text>
            <Text style={[styles.count, { color: p.muted }]}>
              {note.length}/{DIARY_MAX_NOTE}
            </Text>
          </View>
          <TextInput
            value={note}
            onChangeText={onNote}
            onBlur={() => {
              if (noteTimer.current) {
                clearTimeout(noteTimer.current);
                noteTimer.current = null;
                void persist();
              }
            }}
            multiline
            maxLength={DIARY_MAX_NOTE}
            placeholder="산책 코스, 처음 해 본 일, 귀여웠던 순간…"
            placeholderTextColor={p.muted}
            style={[styles.input, { color: p.ink, backgroundColor: p.surface }]}
            textAlignVertical="top"
          />
        </View>
        <Text style={[styles.privacy, { color: p.muted }]}>
          <Ionicons name="lock-closed" size={11} color={p.muted} /> 사진과 글은 이 기기에만 저장돼요.
        </Text>
      </ScrollView>

      <PhotoViewer
        photos={photos}
        index={viewer}
        onClose={() => setViewer(null)}
        onIndex={setViewer}
        onRemove={removePhoto}
        onCover={makeCover}
      />
    </View>
  );
}

const TILT = [-2.5, 1.8, -1.2, 2.4, -1.8, 1.2];

function SaveState({ status }: { status: 'idle' | 'saving' | 'saved' | 'failed' }) {
  const p = usePalette();
  if (status === 'idle') return null;
  const label = status === 'saving' ? '저장 중…' : status === 'saved' ? '저장됨' : '저장 실패';
  const color = status === 'failed' ? p.danger : status === 'saved' ? p.success : p.muted;
  return (
    <Animated.View key={status} entering={FadeIn.duration(160)} style={styles.saveRow}>
      {status === 'saved' ? <Ionicons name="checkmark-circle" size={13} color={color} /> : null}
      <Text style={[styles.saveText, { color }]}>{label}</Text>
    </Animated.View>
  );
}

/**
 * 사진 크게 보기 — 옆으로 넘기고, iOS는 두 손가락으로 확대한다.
 * 여기서 대표 사진(달력 칸에 보이는 사진)을 바꾸거나 지운다.
 */
function PhotoViewer({
  photos,
  index,
  onClose,
  onIndex,
  onRemove,
  onCover,
}: {
  photos: string[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
  onRemove: (u: string) => void;
  onCover: (u: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const open = index != null && photos.length > 0;
  const i = open ? Math.min(index, photos.length - 1) : 0;
  const pagerRef = useRef<ScrollView>(null);
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const n = Math.round(e.nativeEvent.contentOffset.x / width);
    if (n !== i && n >= 0 && n < photos.length) onIndex(n);
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        {open ? (
          <Animated.View entering={reduce ? undefined : ZoomIn.duration(220)} style={StyleSheet.absoluteFill}>
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: i * width, y: 0 }}
              onMomentumScrollEnd={onEnd}
              onScrollEndDrag={Platform.OS === 'web' ? onEnd : undefined}>
              {photos.map((u) => (
                <ScrollView
                  key={u}
                  style={{ width, height }}
                  contentContainerStyle={styles.zoomBox}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  centerContent
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}>
                  <Pressable onPress={onClose} accessibilityLabel="닫기" style={{ width, height }}>
                    <Image source={{ uri: u }} style={{ width, height }} contentFit="contain" transition={120} />
                  </Pressable>
                </ScrollView>
              ))}
            </ScrollView>
          </Animated.View>
        ) : null}
        <SafeAreaView style={styles.viewerBar} pointerEvents="box-none">
          <Text style={styles.viewerCount}>
            {i + 1} / {photos.length}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기" hitSlop={10} style={styles.viewerBtn}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </SafeAreaView>
        {open ? (
          <SafeAreaView edges={['bottom']} style={styles.viewerFoot} pointerEvents="box-none">
            {i > 0 ? (
              <Pressable onPress={() => onCover(photos[i])} accessibilityRole="button" style={styles.viewerAction}>
                <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
                <Text style={styles.viewerActionText}>달력 표지로</Text>
              </Pressable>
            ) : (
              <View style={styles.viewerAction}>
                <Ionicons name="calendar" size={16} color="#FFFFFF" />
                <Text style={styles.viewerActionText}>달력 표지</Text>
              </View>
            )}
            <Pressable onPress={() => onRemove(photos[i])} accessibilityRole="button" style={styles.viewerAction}>
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
              <Text style={styles.viewerActionText}>지우기</Text>
            </Pressable>
          </SafeAreaView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.lg,
    paddingBottom: 60,
    gap: Spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  big: { fontSize: 44, lineHeight: 50, fontWeight: '900', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  headText: { gap: 2, flexShrink: 1 },
  week: { fontSize: Type.callout, fontWeight: '800' },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saveText: { fontSize: Type.caption, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '100%' },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: Type.caption, fontWeight: '700', flexShrink: 1 },
  card: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: Type.cardTitle, fontWeight: '800' },
  count: { fontSize: Type.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tileWrap: { width: '33.333%', padding: 5, aspectRatio: 1 },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 3,
    overflow: 'hidden',
    boxShadow: '0 8px 16px -8px rgba(90,55,35,0.4)',
  },
  cover: { position: 'absolute', left: 5, bottom: 5, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  coverText: { fontSize: Type.micro, fontWeight: '800' },
  addTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addText: { fontSize: Type.caption, fontWeight: '800' },
  hint: { fontSize: Type.footnote, lineHeight: 18 },
  input: { minHeight: 140, borderRadius: Radius.md, padding: Spacing.md, fontSize: Type.callout, lineHeight: 22 },
  privacy: { fontSize: Type.caption, textAlign: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(12,9,7,0.96)' },
  zoomBox: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  viewerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  viewerCount: { color: '#FFFFFF', fontSize: Type.footnote, fontWeight: '800', fontVariant: ['tabular-nums'] },
  viewerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  viewerFoot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: Spacing.lg,
  },
  viewerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  viewerActionText: { color: '#FFFFFF', fontSize: Type.footnote, fontWeight: '800' },
});
