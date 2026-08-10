import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  CAL_EVENT_META,
  CAL_REPEAT_LABEL,
  ymd,
  type CalEventType,
  type CalRepeat,
} from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const TYPES: CalEventType[] = ['VACCINE', 'MED', 'CHECKUP', 'TRAVEL'];
const REPEATS: CalRepeat[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'];

export default function CalendarEventScreen() {
  const p = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; eventId?: string }>();
  const { pets, calendarEvents, addCalendarEvent, updateCalendarEvent } = useAppStore();

  // 편집 모드: eventId가 있으면 그 일정을 찾아 폼을 채운다
  const editing = params.eventId ? calendarEvents.find((e) => String(e.eventId) === params.eventId) : undefined;

  const [type, setType] = useState<CalEventType>(editing?.type ?? 'VACCINE');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [petId, setPetId] = useState<number | null>(editing ? editing.petId : pets[0]?.petId ?? null);
  const [date, setDate] = useState(editing?.date ?? params.date ?? ymd(new Date()));
  const [time, setTime] = useState(editing?.time ?? '');
  const [repeat, setRepeat] = useState<CalRepeat>(editing?.repeat ?? 'NONE');
  const [reminder, setReminder] = useState(editing?.reminder ?? true);
  const [notes, setNotes] = useState(editing?.notes ?? '');

  const canSave = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const save = () => {
    if (!canSave) return;
    const payload = {
      petId,
      type,
      title: title.trim(),
      date,
      time: time.trim() || null,
      repeat,
      reminder,
      notes: notes.trim() || null,
    };
    if (editing) updateCalendarEvent(editing.eventId, payload);
    else addCalendarEvent(payload);
    router.back();
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen
        options={{ title: editing ? '일정 수정' : '일정 추가', headerBackButtonDisplayMode: 'minimal' }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {/* 종류 */}
          <Text style={[styles.label, { color: p.ink }]}>종류</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => {
              const meta = CAL_EVENT_META[t];
              const on = type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.typeChip,
                    { borderColor: on ? meta.color : p.line, backgroundColor: on ? meta.soft : p.surface },
                  ]}>
                  <Ionicons name={meta.icon as never} size={16} color={on ? meta.color : p.muted} />
                  <Text style={[styles.typeChipText, { color: on ? meta.color : p.muted }]}>
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 제목 */}
          <Text style={[styles.label, { color: p.ink }]}>제목</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="예) 종합백신 2차 · 심장사상충 예방약"
            placeholderTextColor={p.muted}
            style={[styles.input, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]}
          />

          {/* 아이 선택 */}
          <Text style={[styles.label, { color: p.ink }]}>아이</Text>
          <View style={styles.petRow}>
            <Chip label="전체" on={petId === null} color={p.accent} onPress={() => setPetId(null)} />
            {pets.map((pt) => (
              <Chip
                key={pt.petId}
                label={pt.name}
                on={petId === pt.petId}
                color={p.accent}
                onPress={() => setPetId(pt.petId)}
              />
            ))}
          </View>

          {/* 날짜·시간 */}
          <View style={styles.pairRow}>
            <View style={styles.pairCol}>
              <Text style={[styles.label, { color: p.ink }]}>날짜</Text>
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={p.muted}
                style={[styles.input, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]}
              />
            </View>
            <View style={styles.pairCol}>
              <Text style={[styles.label, { color: p.ink }]}>시간 (선택)</Text>
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="09:00"
                placeholderTextColor={p.muted}
                style={[styles.input, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]}
              />
            </View>
          </View>

          {/* 반복 */}
          <Text style={[styles.label, { color: p.ink }]}>반복</Text>
          <View style={styles.petRow}>
            {REPEATS.map((r) => (
              <Chip
                key={r}
                label={CAL_REPEAT_LABEL[r]}
                on={repeat === r}
                color={p.accent}
                onPress={() => setRepeat(r)}
              />
            ))}
          </View>

          {/* 알림 */}
          <View style={[styles.reminderRow, { backgroundColor: p.surface, borderColor: p.line }]}>
            <Ionicons name="notifications-outline" size={18} color={p.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.reminderLabel, { color: p.ink }]}>알림 받기</Text>
              <Text style={[styles.reminderSub, { color: p.muted }]}>일정 시간에 맞춰 알려드려요</Text>
            </View>
            <Switch value={reminder} onValueChange={setReminder} trackColor={{ true: p.accent }} thumbColor="#FFFFFF" />
          </View>

          {/* 메모 */}
          <Text style={[styles.label, { color: p.ink }]}>메모 (선택)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="예) 강릉동물병원 · 12시간 공복"
            placeholderTextColor={p.muted}
            multiline
            style={[styles.textarea, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]}
          />

          <Pressable
            onPress={save}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: canSave ? (pressed ? p.accentDark : p.accent) : p.line },
            ]}>
            <Text style={[styles.saveText, { color: canSave ? p.onAccent : p.muted }]}>저장하기</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  on,
  color,
  onPress,
}: {
  label: string;
  on: boolean;
  color: string;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: on ? color : p.line, backgroundColor: on ? p.accentSoft : p.surface },
      ]}>
      <Text style={[styles.chipText, { color: on ? color : p.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 64 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.sm, paddingTop: Spacing.md },
  label: { fontSize: 13.5, fontWeight: '800', marginTop: Spacing.sm },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingVertical: 12,
  },
  typeChipText: { fontSize: 12, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    fontSize: 14.5,
  },
  petRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1.5, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },
  pairRow: { flexDirection: 'row', gap: Spacing.md },
  pairCol: { flex: 1 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    marginTop: Spacing.md,
  },
  reminderLabel: { fontSize: 14, fontWeight: '700' },
  reminderSub: { fontSize: 11.5 },
  textarea: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: 14.5,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingVertical: 15,
    marginTop: Spacing.lg,
  },
  saveText: { fontSize: 15.5, fontWeight: '800' },
});
