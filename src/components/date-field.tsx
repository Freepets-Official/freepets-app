import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

/**
 * 날짜 입력 — 연·월·일을 휠로 고른다.
 *
 * 예전에는 `2026-03-15` 형식을 직접 치게 했는데, 숫자·하이픈을 정확히 맞춰야 해서
 * 오타가 나기 쉽고 키보드가 화면을 가렸다. 접종일처럼 "달력에서 짚으면 되는" 값에는
 * 타이핑을 시킬 이유가 없다.
 *
 * 값은 그대로 `YYYY-MM-DD` 문자열로 주고받는다 — 서버 계약과 기존 저장 형식이 그것이라,
 * 여기서 Date 객체로 바꾸면 화면마다 변환이 늘어난다.
 */
export function DateField({
  value,
  onChange,
  placeholder,
  /** `date`면 `YYYY-MM-DD`, `time`이면 `HH:mm`을 주고받는다 */
  mode = 'date',
  /** 고를 수 있는 가장 이른/늦은 날. 접종일은 미래가, 예정일은 과거가 의미 없다 */
  minimumDate,
  maximumDate,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  mode?: 'date' | 'time';
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const p = usePalette();
  const [open, setOpen] = useState(false);

  // 저장된 문자열이 깨져 있어도 화면이 죽지 않게 한다. 그때는 지금을 기준으로 연다.
  const current = parseValue(value, mode) ?? new Date();
  const format = mode === 'time' ? toHm : toYmd;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [
          styles.field,
          { borderColor: open ? p.accent : p.line, backgroundColor: pressed ? p.surface : p.surface },
        ]}>
        <Ionicons
          name={mode === 'time' ? 'time-outline' : 'calendar-outline'}
          size={16}
          color={open ? p.accent : p.muted}
        />
        <Text style={[styles.value, { color: value ? p.ink : p.muted }]}>{value || placeholder}</Text>
        {value !== '' && (
          // 선택을 되돌릴 방법이 있어야 한다. 접종일은 비워둘 수 있는 값이다.
          <Pressable
            onPress={() => {
              onChange('');
              setOpen(false);
            }}
            hitSlop={8}
            accessibilityLabel="날짜 지우기">
            <Ionicons name="close-circle" size={16} color={p.muted} />
          </Pressable>
        )}
      </Pressable>

      {open && (
        <View style={[styles.picker, { borderColor: p.line, backgroundColor: p.card }]}>
          <DateTimePicker
            value={current}
            mode={mode}
            // iOS 기본은 달력형이다. 연·월·일 휠은 spinner에서만 나온다.
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            locale="ko-KR"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(event, picked) => {
              // 안드로이드는 다이얼로그라 고르는 순간 닫는다. iOS는 휠이 계속 떠 있어야 한다.
              if (Platform.OS !== 'ios') setOpen(false);
              if (event.type === 'dismissed' || !picked) return;
              onChange(format(picked));
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable
              onPress={() => {
                // 한 번도 안 굴리고 닫으면 값이 비어 있다. 그때는 지금 보이는 날짜를 택한 것으로 본다.
                if (!value) onChange(format(current));
                setOpen(false);
              }}
              style={[styles.done, { borderTopColor: p.line }]}>
              <Text style={[styles.doneText, { color: p.accent }]}>완료</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/** 로컬 시간대 기준 `YYYY-MM-DD`. `toISOString()`은 UTC로 바꿔서 하루가 밀린다. */
function toYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function toHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 저장된 문자열을 Date로. 형식이 어긋나면 `null` — 호출부가 지금 시각으로 대신한다. */
function parseValue(value: string, mode: 'date' | 'time'): Date | null {
  if (!value) return null;
  if (mode === 'time') {
    const m = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!m) return null;
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  }
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: 13,
  },
  value: { fontSize: 14.5, flex: 1 },
  picker: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  done: { alignItems: 'center', paddingVertical: 11, borderTopWidth: 1 },
  doneText: { fontSize: 14, fontWeight: '800' },
});
