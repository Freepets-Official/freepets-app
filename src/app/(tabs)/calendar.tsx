import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter, useScrollToTop } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInLeft, FadeInRight, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadState } from '@/components/load-state';
import { TiltPressable } from '@/components/motion/tilt-pressable';
import { Text } from '@/components/text';
import { useTabChrome } from '@/components/tab-bar';
import { CardShadow, ClayShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import {
  CAL_EVENT_META,
  CAL_REPEAT_LABEL,
  ymd,
  type CalEventType,
  type CalendarEvent,
  spanPosition,
} from '@/data/types';
import { useDayDiary } from '@/hooks/use-day-diary';
import { useColorScheme, usePalette } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { notify } from '@/lib/notify';
import { GuestScreen } from '@/components/guest-prompt';
import { useAppStore } from '@/store/app-store';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const TYPES: CalEventType[] = ['VACCINE', 'MED', 'CHECKUP', 'TRAVEL'];

export default function CalendarScreen() {
  const p = usePalette();
  const clay = ClayShadow[useColorScheme()];
  const router = useRouter();
  const chrome = useTabChrome();
  const reduce = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const diary = useDayDiary();

  const {
    pets,
    eventsOn,
    toggleEventReminder,
    removeCalendarEvent,
    toggleMedTaken,
    isMedTaken,
    loadCalendarMonth,
    calendarErrorRef,
    session,
  } = useAppStore();

  const today = ymd(new Date());
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(today);
  // 달을 넘긴 방향 — 새 달이 그쪽에서 밀려 들어온다
  const [dir, setDir] = useState<1 | -1>(1);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  useEffect(() => {
    void loadCalendarMonth(`${y}-${String(m + 1).padStart(2, '0')}`);
  }, [y, m, loadCalendarMonth]);

  /**
   * 그 달에 걸친 주만 그린다(4~6줄). 예전엔 늘 6줄(42칸)이라 다음 달 날짜가 한 줄 통째로
   * 남는 달이 있었고, 사진이 들어간 뒤로는 그만큼 화면을 차지했다.
   */
  const cells = useMemo(() => {
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - first.getDay());
    const days = new Date(y, m + 1, 0).getDate();
    const weeks = Math.ceil((first.getDay() + days) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [y, m]);

  const dayEvents = eventsOn(selected);
  const petName = (id: number | null) => pets.find((pt) => pt.petId === id)?.name ?? '전체';

  const moveMonth = (delta: 1 | -1) => {
    haptic.light();
    setDir(delta);
    setCursor(new Date(y, m + delta, 1));
  };
  const goToday = () => {
    setDir(ymd(cursor) < today ? 1 : -1);
    setCursor(new Date());
    setSelected(today);
  };
  const pick = (ds: string, inMonth: boolean) => {
    haptic.light();
    setSelected(ds);
    // 앞뒤 달 날짜를 누르면 그 달로 넘어간다 — 회색 날짜를 눌렀는데 아무 일도 없으면 고장 같다
    if (!inMonth) moveMonth(ds < `${y}-${String(m + 1).padStart(2, '0')}-01` ? -1 : 1);
  };

  // 달력을 옆으로 쓸어 달을 넘긴다. 세로 스크롤과 다투지 않게 가로로 충분히 움직였을 때만 잡는다
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 50 || Math.abs(e.velocityX) > 500) moveMonth(e.translationX < 0 ? 1 : -1);
    });

  const selDate = new Date(`${selected}T00:00:00`);
  const rel = relDay(selected, today);
  const entry = diary.day(selected);
  const monthPhotos = useMemo(
    () => Object.keys(diary.map).filter((k) => k.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`) && diary.map[k].photos.length).length,
    [diary.map, y, m],
  );
  const openDiary = (photo?: number) =>
    router.push({ pathname: '/day-diary', params: photo != null ? { date: selected, photo: String(photo) } : { date: selected } });

  if (!session.authed) {
    return <GuestScreen eyebrow="반려동물 캘린더" title="캘린더" body="예방접종·약 복용·여행 일정을 아이별로 관리하고 알림을 받아요." />;
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.surface }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.inner}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={chrome ? () => chrome.onScroll() : undefined}
        scrollEventThrottle={64}>
        {/* 헤더 — 월 이동 */}
        <View style={styles.header}>
          <View style={styles.headTitle}>
            <Text style={[styles.eyebrow, { color: p.accentDark }]}>반려동물 캘린더</Text>
            <View style={styles.monthRow}>
              <Animated.View key={`${y}-${m}`} entering={reduce ? undefined : FadeIn.duration(220)}>
                <Text style={[styles.month, { color: p.ink }]}>
                  {m + 1}월
                </Text>
              </Animated.View>
              <Text style={[styles.year, { color: p.muted }]}>{y}</Text>
            </View>
            {monthPhotos > 0 ? (
              <Text style={[styles.monthMeta, { color: p.muted }]}>
                <Ionicons name="images-outline" size={12} color={p.muted} /> 이번 달 사진 기록 {monthPhotos}일
              </Text>
            ) : null}
          </View>
          <View style={styles.navBtns}>
            {ymd(cursor).slice(0, 7) !== today.slice(0, 7) || selected !== today ? (
              <Animated.View entering={reduce ? undefined : FadeIn.duration(180)}>
                <Pressable
                  onPress={goToday}
                  accessibilityRole="button"
                  style={[styles.todayBtn, { backgroundColor: p.accentSoft }]}>
                  <Text style={[styles.todayText, { color: p.accentDark }]}>오늘</Text>
                </Pressable>
              </Animated.View>
            ) : null}
            <Pressable
              onPress={() => moveMonth(-1)}
              accessibilityRole="button"
              accessibilityLabel="이전 달"
              style={({ pressed }) => [styles.arrow, { backgroundColor: p.card, boxShadow: pressed ? clay.pressed : clay.rest }]}>
              <Ionicons name="chevron-back" size={18} color={p.ink} />
            </Pressable>
            <Pressable
              onPress={() => moveMonth(1)}
              accessibilityRole="button"
              accessibilityLabel="다음 달"
              style={({ pressed }) => [styles.arrow, { backgroundColor: p.card, boxShadow: pressed ? clay.pressed : clay.rest }]}>
              <Ionicons name="chevron-forward" size={18} color={p.ink} />
            </Pressable>
          </View>
        </View>

        {/* 달력 카드 */}
        <View style={[styles.calCard, { backgroundColor: p.card, boxShadow: clay.rest }]}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={w} style={[styles.weekday, { color: i === 0 ? p.danger : i === 6 ? p.saturday : p.muted }]}>
                {w}
              </Text>
            ))}
          </View>

          <GestureDetector gesture={swipe}>
            <Animated.View
              key={`${y}-${m}`}
              entering={reduce ? undefined : (dir > 0 ? FadeInRight : FadeInLeft).duration(260)}
              style={styles.grid}>
              {cells.map((d) => {
                const ds = ymd(d);
                const inMonth = d.getMonth() === m;
                const isToday = ds === today;
                const isSel = ds === selected;
                const evs = eventsOn(ds);
                const spans = evs
                  .map((e) => ({ event: e, pos: spanPosition(e, ds) }))
                  .filter((x): x is { event: CalendarEvent; pos: 'start' | 'middle' | 'end' } => x.pos !== null);
                const dots = evs.filter((e) => spanPosition(e, ds) === null);
                const photos = diary.map[ds]?.photos ?? [];
                const hasNote = !!diary.map[ds]?.note.trim();
                const wd = d.getDay();
                return (
                  <Pressable
                    key={ds}
                    onPress={() => pick(ds, inMonth)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={`${d.getMonth() + 1}월 ${d.getDate()}일${evs.length ? `, 일정 ${evs.length}개` : ''}${photos.length ? `, 사진 ${photos.length}장` : ''}`}
                    style={styles.cell}>
                    <View
                      style={[
                        styles.cellBg,
                        isSel && { backgroundColor: p.accentSoft, borderColor: p.accent },
                      ]}
                    />
                    <View
                      style={[
                        styles.dayNumWrap,
                        isToday && { backgroundColor: p.accent },
                      ]}>
                      <Text
                        style={[
                          styles.dayNum,
                          {
                            color: isToday
                              ? p.onAccent
                              : !inMonth
                                ? p.line
                                : wd === 0
                                  ? p.danger
                                  : wd === 6
                                    ? p.saturday
                                    : p.ink,
                          },
                          (isSel || isToday) && { fontWeight: '900' },
                        ]}>
                        {d.getDate()}
                      </Text>
                    </View>
                    {/*
                      기간 일정(여행)은 점이 아니라 막대로 그린다. 며칠에 걸친 일이 날마다 점
                      하나로 흩어지면 "이어진 하루하루"라는 게 안 보인다. 시작·끝만 모서리를
                      둥글게 해서 어디서 시작하고 끝나는지 드러낸다.
                    */}
                    <View style={styles.spanWrap}>
                      {spans.slice(0, 2).map((sp, i) => (
                        <View
                          key={i}
                          style={[
                            styles.span,
                            {
                              backgroundColor: CAL_EVENT_META[sp.event.type].color,
                              opacity: inMonth ? 1 : 0.4,
                              borderTopLeftRadius: sp.pos === 'start' ? 3 : 0,
                              borderBottomLeftRadius: sp.pos === 'start' ? 3 : 0,
                              borderTopRightRadius: sp.pos === 'end' ? 3 : 0,
                              borderBottomRightRadius: sp.pos === 'end' ? 3 : 0,
                              marginLeft: sp.pos === 'start' ? 4 : 0,
                              marginRight: sp.pos === 'end' ? 4 : 0,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    {/* 그날 찍은 사진 — 칸 안에 작은 폴라로이드처럼. 여러 장이면 뒤에 한 장이 비친다 */}
                    {photos.length > 0 ? (
                      <View style={[styles.thumbWrap, !inMonth && { opacity: 0.45 }]}>
                        {photos.length > 1 ? <View style={[styles.thumbBack, { backgroundColor: p.accentSoft, borderColor: p.card }]} /> : null}
                        <Image source={{ uri: photos[0] }} style={[styles.thumb, { borderColor: p.card }]} contentFit="cover" transition={160} />
                      </View>
                    ) : hasNote ? (
                      <Ionicons name="create-outline" size={13} color={inMonth ? p.accent : p.line} style={styles.noteIcon} />
                    ) : null}
                    <View style={styles.dots}>
                      {dots.slice(0, 3).map((e, i) => (
                        <View
                          key={i}
                          style={[styles.dot, { backgroundColor: CAL_EVENT_META[e.type].color, opacity: inMonth ? 1 : 0.4 }]}
                        />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </Animated.View>
          </GestureDetector>

          {/* 범례 */}
          <View style={[styles.legend, { borderTopColor: p.line }]}>
            {TYPES.map((t) => (
              <View key={t} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: CAL_EVENT_META[t].color }]} />
                <Text style={[styles.legendText, { color: p.muted }]}>{CAL_EVENT_META[t].label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 선택한 날 */}
        <Animated.View key={selected} entering={reduce ? undefined : FadeIn.duration(200)} style={styles.dayHead}>
          <View style={styles.dayBadge}>
            <Text style={[styles.dayBig, { color: p.ink }]}>{selDate.getDate()}</Text>
            <View>
              <Text style={[styles.dayWeek, { color: p.ink }]}>
                {selDate.getMonth() + 1}월 · {WEEKDAYS[selDate.getDay()]}요일
              </Text>
              {rel ? <Text style={[styles.dayRel, { color: p.accentDark }]}>{rel}</Text> : null}
            </View>
          </View>
          <Text style={[styles.panelCount, { color: p.muted }]}>일정 {dayEvents.length}</Text>
        </Animated.View>

        {/* 하루 기록 — 사진과 짧은 글 */}
        {diary.enabled ? (
          <Animated.View layout={reduce ? undefined : LinearTransition.duration(200)}>
            {entry ? (
              <TiltPressable
                onPress={() => openDiary()}
                accessibilityRole="button"
                accessibilityLabel="이 날의 기록 열기"
                maxTilt={3}
                style={(pressed) => [styles.diaryCard, { backgroundColor: p.card, boxShadow: pressed ? clay.pressed : clay.rest }]}>
                <View style={styles.diaryHead}>
                  <Ionicons name="book-outline" size={15} color={p.accentDark} />
                  <Text style={[styles.diaryTitle, { color: p.ink }]}>이 날의 기록</Text>
                  <Text style={[styles.diaryMore, { color: p.muted }]}>고치기</Text>
                  <Ionicons name="chevron-forward" size={14} color={p.muted} />
                </View>
                {entry.photos.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                    {entry.photos.map((u, i) => (
                      <Pressable
                        key={u}
                        onPress={() => openDiary(i)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={`사진 ${i + 1} 크게 보기`}
                        style={({ pressed }) => [styles.stripItem, { transform: [{ rotate: `${STRIP_TILT[i % STRIP_TILT.length]}deg` }, { scale: pressed ? 0.96 : 1 }] }]}>
                        <Image source={{ uri: u }} style={[styles.stripImg, { borderColor: p.card }]} contentFit="cover" transition={160} />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
                {entry.note.trim() ? (
                  <Text style={[styles.diaryNote, { color: p.ink }]} numberOfLines={3}>
                    {entry.note.trim()}
                  </Text>
                ) : null}
              </TiltPressable>
            ) : (
              <TiltPressable
                onPress={() => openDiary()}
                accessibilityRole="button"
                accessibilityLabel="이 날의 사진과 기록 남기기"
                maxTilt={3}
                style={(pressed) => [
                  styles.diaryEmpty,
                  { backgroundColor: pressed ? p.accentSoft : p.card, borderColor: p.accent },
                ]}>
                <View style={[styles.diaryIcon, { backgroundColor: p.accentSoft }]}>
                  <Ionicons name="camera" size={20} color={p.accentDark} />
                </View>
                <View style={styles.diaryEmptyBody}>
                  <Text style={[styles.diaryTitle, { color: p.ink }]}>사진 한 장, 한 줄 기록</Text>
                  <Text style={[styles.diaryHint, { color: p.muted }]}>이 날 찍은 사진을 올리면 달력 칸에 작게 보여요</Text>
                </View>
                <Ionicons name="add-circle" size={24} color={p.accent} />
              </TiltPressable>
            )}
          </Animated.View>
        ) : null}

        {/* 일정 */}
        <View style={styles.events}>
          {dayEvents.map((e, i) => (
            <Animated.View key={e.eventId} entering={reduce ? undefined : FadeIn.delay(i * 40).duration(200)}>
              <EventRow
                e={e}
                petName={petName(e.petId)}
                taken={e.type === 'MED' ? isMedTaken(e.eventId, selected) : false}
                onEdit={() => router.push({ pathname: '/calendar-event', params: { eventId: String(e.eventId) } })}
                onToggleTaken={() => toggleMedTaken(e.eventId, selected)}
                onToggleReminder={() => toggleEventReminder(e.eventId)}
                onDelete={() => {
                  void removeCalendarEvent(e.eventId).then((ok) => {
                    if (!ok) notify('삭제 실패', calendarErrorRef.current ?? '일정을 서버에서 지우지 못했어요. 잠시 후 다시 시도해 주세요.');
                  });
                }}
              />
            </Animated.View>
          ))}
          {dayEvents.length === 0 && <LoadState kind="empty" icon="paw-outline" message="이 날은 일정이 없어요." />}
        </View>

        <TiltPressable
          onPress={() => router.push({ pathname: '/calendar-event', params: { date: selected } })}
          accessibilityRole="button"
          maxTilt={2}
          style={(pressed) => [styles.addBtn, { backgroundColor: pressed ? p.accentDark : p.accent, boxShadow: CardShadow.boxShadow }]}>
          <Ionicons name="add" size={20} color={p.onAccent} />
          <Text style={[styles.addText, { color: p.onAccent }]}>일정 추가</Text>
        </TiltPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** 사진 띠의 사진을 조금씩 다르게 기울여 손으로 붙인 앨범처럼 */
const STRIP_TILT = [-3, 2, -1.5, 3, -2.5, 1.5];

/** 고른 날이 오늘에서 얼마나 떨어졌나 — "오늘"·"내일"·"3일 뒤"·"2일 전" */
function relDay(ds: string, today: string): string | null {
  const diff = Math.round((Date.parse(`${ds}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  if (Math.abs(diff) > 60) return null;
  return diff > 0 ? `${diff}일 뒤` : `${-diff}일 전`;
}

function EventRow({
  e,
  petName,
  taken,
  onEdit,
  onToggleTaken,
  onToggleReminder,
  onDelete,
}: {
  e: CalendarEvent;
  petName: string;
  taken: boolean;
  onEdit: () => void;
  onToggleTaken: () => void;
  onToggleReminder: () => void;
  onDelete: () => void;
}) {
  const p = usePalette();
  const meta = CAL_EVENT_META[e.type];
  const sub = [petName, e.time ?? '종일', e.repeat !== 'NONE' ? CAL_REPEAT_LABEL[e.repeat] : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [
        styles.row,
        CardShadow,
        { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.94 : 1 },
      ]}>
      <View style={[styles.rowIcon, { backgroundColor: meta.soft }]}>
        <Ionicons name={meta.icon as never} size={18} color={meta.color} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: p.ink }]} numberOfLines={1}>
            {e.title}
          </Text>
          <View style={[styles.typeTag, { backgroundColor: meta.soft }]}>
            <Text style={[styles.typeTagText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={[styles.rowSub, { color: p.muted }]}>{sub}</Text>
        {e.notes ? <Text style={[styles.rowNotes, { color: p.muted }]}>{e.notes}</Text> : null}
        {e.type === 'MED' && (
          <Pressable
            onPress={(ev) => {
              ev.stopPropagation();
              onToggleTaken();
            }}
            style={[
              styles.takenBtn,
              taken
                ? { backgroundColor: p.successSoft, borderColor: p.success }
                : { backgroundColor: p.surface, borderColor: p.line },
            ]}>
            <Ionicons
              name={taken ? 'checkmark-circle' : 'ellipse-outline'}
              size={15}
              color={taken ? p.success : p.muted}
            />
            <Text style={[styles.takenText, { color: taken ? p.success : p.muted }]}>
              {taken ? '복용 완료' : '오늘 복용 체크'}
            </Text>
          </Pressable>
        )}
      </View>
      <View style={styles.rowActions}>
        <Pressable
          onPress={(ev) => {
            ev.stopPropagation();
            onToggleReminder();
          }}
          hitSlop={6}>
          <Ionicons
            name={e.reminder ? 'notifications' : 'notifications-off-outline'}
            size={18}
            color={e.reminder ? p.accent : p.muted}
          />
        </Pressable>
        <Pressable
          onPress={(ev) => {
            ev.stopPropagation();
            onDelete();
          }}
          hitSlop={6}>
          <Ionicons name="trash-outline" size={17} color={p.muted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  /**
   * 넓은 화면(웹·태블릿)에서 달력이 끝까지 늘어나지 않게 가둔다.
   *
   * 다른 화면은 `Screen`이나 각자의 래퍼로 이미 `MaxContentWidth`를 쓰는데 캘린더만 빠져 있어,
   * 웹에서 이 탭만 7칸 그리드가 화면 폭만큼 벌어졌다.
   */
  inner: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 130, gap: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: Spacing.xl,
  },
  headTitle: { flexShrink: 1 },
  eyebrow: { fontSize: Type.footnote, fontWeight: '800', letterSpacing: 0.5 },
  monthRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  month: { fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -1 },
  year: { fontSize: Type.cardTitle, fontWeight: '800', fontVariant: ['tabular-nums'] },
  monthMeta: { fontSize: Type.caption, fontWeight: '700', marginTop: 2 },
  navBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  todayBtn: { borderRadius: Radius.full, paddingHorizontal: 13, paddingVertical: 8 },
  todayText: { fontSize: Type.footnote, fontWeight: '800' },
  arrow: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCard: { borderRadius: Radius.xl, paddingTop: Spacing.sm, paddingHorizontal: 4, overflow: 'hidden' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: Type.caption, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: Type.caption, fontWeight: '800', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 74, alignItems: 'center', paddingTop: 5, gap: 2 },
  // 고른 칸 — 숫자만 칠하던 동그라미 대신 칸 전체를 살구빛 카드로 감싼다(사진까지 한 덩어리로 보이게)
  cellBg: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    left: 2,
    right: 2,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayNumWrap: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: Type.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  spanWrap: { width: '100%', gap: 2 },
  span: { height: 4 },
  thumbWrap: { width: 32, height: 30, alignItems: 'center', justifyContent: 'center' },
  thumbBack: { position: 'absolute', width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, transform: [{ rotate: '9deg' }, { translateX: 3 }] },
  thumb: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, transform: [{ rotate: '-4deg' }] },
  noteIcon: { marginTop: 4 },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 'auto', marginBottom: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
  },
  dayBadge: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayBig: { fontSize: 32, lineHeight: 36, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  dayWeek: { fontSize: Type.bodyLg, fontWeight: '800' },
  dayRel: { fontSize: Type.caption, fontWeight: '800' },
  panelCount: { fontSize: Type.footnote, fontWeight: '700', paddingBottom: 4 },
  diaryCard: { borderRadius: Radius.lg, padding: Spacing.md, gap: 10 },
  diaryHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diaryTitle: { fontSize: Type.bodyLg, fontWeight: '800', flexShrink: 1 },
  diaryMore: { marginLeft: 'auto', fontSize: Type.caption, fontWeight: '700' },
  strip: { gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  stripItem: { borderRadius: 14 },
  stripImg: { width: 84, height: 84, borderRadius: 14, borderWidth: 3, boxShadow: '0 6px 12px -6px rgba(90,55,35,0.35)' },
  diaryNote: { fontSize: Type.body, lineHeight: 20 },
  diaryEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: Spacing.md,
  },
  diaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  diaryEmptyBody: { flex: 1, gap: 2 },
  diaryHint: { fontSize: Type.caption, lineHeight: 16 },
  events: { gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontSize: Type.bodyLg, fontWeight: '800', flexShrink: 1 },
  typeTag: { borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  typeTagText: { fontSize: Type.micro, fontWeight: '800' },
  rowSub: { fontSize: Type.footnote, fontVariant: ['tabular-nums'] },
  rowNotes: { fontSize: Type.caption, lineHeight: 16 },
  takenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  takenText: { fontSize: Type.caption, fontWeight: '800' },
  rowActions: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2, gap: 10 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginTop: 6,
  },
  addText: { fontSize: Type.callout, fontWeight: '800' },
});
