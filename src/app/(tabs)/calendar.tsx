import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabChrome } from '@/components/tab-bar';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import {
  CAL_EVENT_META,
  CAL_REPEAT_LABEL,
  ymd,
  type CalEventType,
  type CalendarEvent,
} from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const TYPES: CalEventType[] = ['VACCINE', 'MED', 'CHECKUP', 'TRAVEL'];

export default function CalendarScreen() {
  const p = usePalette();
  const router = useRouter();
  const chrome = useTabChrome();
  const { pets, eventsOn, toggleEventReminder, removeCalendarEvent, toggleMedTaken, isMedTaken } =
    useAppStore();

  const today = ymd(new Date());
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(today);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  // 월 그리드 42칸 (6주) — 그 달 1일이 속한 주의 일요일부터
  const cells = useMemo(() => {
    const start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [y, m]);

  const dayEvents = eventsOn(selected);
  const petName = (id: number | null) => pets.find((pt) => pt.petId === id)?.name ?? '전체';

  const moveMonth = (delta: number) => setCursor(new Date(y, m + delta, 1));
  const goToday = () => {
    setCursor(new Date());
    setSelected(today);
  };

  const selDate = new Date(`${selected}T00:00:00`);
  const selLabel = `${selDate.getMonth() + 1}월 ${selDate.getDate()}일 (${WEEKDAYS[selDate.getDay()]})`;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      {/* 헤더 — 월 이동 */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: p.accent }]}>반려동물 캘린더</Text>
          <Text style={[styles.month, { color: p.ink }]}>
            {y}년 {m + 1}월
          </Text>
        </View>
        <View style={styles.navBtns}>
          <Pressable onPress={goToday} style={[styles.todayBtn, { backgroundColor: p.accentSoft }]}>
            <Text style={[styles.todayText, { color: p.accent }]}>오늘</Text>
          </Pressable>
          <Pressable onPress={() => moveMonth(-1)} style={[styles.arrow, { borderColor: p.line }]}>
            <Ionicons name="chevron-back" size={18} color={p.ink} />
          </Pressable>
          <Pressable onPress={() => moveMonth(1)} style={[styles.arrow, { borderColor: p.line }]}>
            <Ionicons name="chevron-forward" size={18} color={p.ink} />
          </Pressable>
        </View>
      </View>

      {/* 범례 */}
      <View style={styles.legend}>
        {TYPES.map((t) => (
          <View key={t} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: CAL_EVENT_META[t].color }]} />
            <Text style={[styles.legendText, { color: p.muted }]}>{CAL_EVENT_META[t].label}</Text>
          </View>
        ))}
      </View>

      {/* 요일 헤더 */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={w}
            style={[
              styles.weekday,
              { color: i === 0 ? p.danger : i === 6 ? '#4C8DF5' : p.muted },
            ]}>
            {w}
          </Text>
        ))}
      </View>

      {/* 월 그리드 */}
      <View style={styles.grid}>
        {cells.map((d) => {
          const ds = ymd(d);
          const inMonth = d.getMonth() === m;
          const isToday = ds === today;
          const isSel = ds === selected;
          const evs = eventsOn(ds);
          const wd = d.getDay();
          return (
            <Pressable key={ds} onPress={() => setSelected(ds)} style={styles.cell}>
              <View
                style={[
                  styles.dayNumWrap,
                  isSel && { backgroundColor: p.accent },
                  isToday && !isSel && { backgroundColor: p.accentSoft },
                ]}>
                <Text
                  style={[
                    styles.dayNum,
                    {
                      color: isSel
                        ? p.onAccent
                        : !inMonth
                          ? p.line
                          : wd === 0
                            ? p.danger
                            : wd === 6
                              ? '#4C8DF5'
                              : p.ink,
                    },
                  ]}>
                  {d.getDate()}
                </Text>
              </View>
              <View style={styles.dots}>
                {evs.slice(0, 3).map((e, i) => (
                  <View
                    key={i}
                    style={[styles.dot, { backgroundColor: CAL_EVENT_META[e.type].color, opacity: inMonth ? 1 : 0.4 }]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* 선택한 날짜의 일정 */}
      <View style={styles.panelHead}>
        <Text style={[styles.panelTitle, { color: p.ink }]}>{selLabel}</Text>
        <Text style={[styles.panelCount, { color: p.muted }]}>일정 {dayEvents.length}</Text>
      </View>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}
        onScroll={chrome ? () => chrome.onScroll() : undefined}
        scrollEventThrottle={64}>
        {dayEvents.map((e) => (
          <EventRow
            key={e.eventId}
            e={e}
            petName={petName(e.petId)}
            taken={e.type === 'MED' ? isMedTaken(e.eventId, selected) : false}
            onEdit={() =>
              router.push({ pathname: '/calendar-event', params: { eventId: String(e.eventId) } })
            }
            onToggleTaken={() => toggleMedTaken(e.eventId, selected)}
            onToggleReminder={() => toggleEventReminder(e.eventId)}
            onDelete={() => removeCalendarEvent(e.eventId)}
          />
        ))}
        {dayEvents.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="paw-outline" size={28} color={p.muted} />
            <Text style={[styles.emptyText, { color: p.muted }]}>이 날은 일정이 없어요.</Text>
          </View>
        )}

        <Pressable
          onPress={() => router.push({ pathname: '/calendar-event', params: { date: selected } })}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: pressed ? p.accentDark : p.accent },
          ]}>
          <Ionicons name="add" size={20} color={p.onAccent} />
          <Text style={[styles.addText, { color: p.onAccent }]}>일정 추가</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  month: { fontSize: 26, fontWeight: '900', letterSpacing: -0.8 },
  navBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayBtn: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7, marginRight: 2 },
  todayText: { fontSize: 12.5, fontWeight: '800' },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11.5, fontWeight: '700' },
  weekRow: { flexDirection: 'row', paddingHorizontal: Spacing.xs },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: '800', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.xs },
  cell: { width: `${100 / 7}%`, height: 52, alignItems: 'center', paddingTop: 4, gap: 3 },
  dayNumWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 6,
  },
  panelTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  panelCount: { fontSize: 12.5, fontWeight: '700' },
  panel: { flex: 1 },
  panelContent: { paddingHorizontal: Spacing.lg, paddingBottom: 120, gap: Spacing.sm },
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
  rowTitle: { fontSize: 14.5, fontWeight: '800', flexShrink: 1 },
  typeTag: { borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  typeTagText: { fontSize: 10, fontWeight: '800' },
  rowSub: { fontSize: 12, fontVariant: ['tabular-nums'] },
  rowNotes: { fontSize: 11.5, lineHeight: 16 },
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
  takenText: { fontSize: 11.5, fontWeight: '800' },
  rowActions: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2, gap: 10 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  emptyText: { fontSize: 13.5 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginTop: 6,
  },
  addText: { fontSize: 15, fontWeight: '800' },
});
