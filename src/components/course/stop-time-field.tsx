import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { formatTime, normalizeTime } from '@/data/course-plan';
import { usePalette } from '@/hooks/use-theme';

/**
 * 스톱 하나의 방문 시각.
 *
 * 정해두지 않았으면 「시간 정하기」만 보인다 — 빈 입력칸을 열 개 늘어놓으면 코스 화면이
 * 서식처럼 보이고, 시간을 안 정하는 것도 정상적인 사용이기 때문이다.
 *
 * 입력은 **느슨하게 받는다.** `9`·`930`·`9:3`·`9시 30분`을 전부 `09:30`으로 읽는다
 * (`normalizeTime`). 여행 중에 한 손으로 치는 값이라 콜론을 강제하면 성가시다.
 * 못 읽는 값은 저장하지 않고 원래 값으로 되돌린다 — 조용히 0시로 떨어뜨리면 더 나쁘다.
 */
export function StopTimeField({
  value,
  outOfOrder,
  onChange,
}: {
  /** `"HH:MM"` 또는 정하지 않았으면 undefined */
  value: string | undefined;
  /** 앞 스톱보다 이른 시각이면 true — 막지는 않고 표시만 한다 */
  outOfOrder?: boolean;
  onChange: (time: string | null) => void;
}) {
  const p = usePalette();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  // 바깥에서 값이 바뀌면(다른 코스를 열면) 입력 중이 아닐 때만 따라간다
  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const t = draft.trim();
    if (!t) {
      onChange(null);
      return;
    }
    const parsed = normalizeTime(t);
    if (!parsed) {
      setDraft(value ?? ''); // 못 읽었다 — 원래 값으로 되돌린다
      return;
    }
    onChange(parsed);
    setDraft(parsed);
  };

  if (editing) {
    return (
      <View style={[styles.editRow, { borderColor: p.accent, backgroundColor: p.surface }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          autoFocus
          keyboardType="numbers-and-punctuation"
          placeholder="09:30"
          placeholderTextColor={p.muted}
          // '9시 30분'처럼 한글을 섞어 쳐도 받는다(normalizeTime이 읽는다)
          maxLength={8}
          returnKeyType="done"
          accessibilityLabel="방문 시각"
          style={[styles.input, { color: p.ink }]}
        />
        <Pressable onPress={commit} hitSlop={8}>
          <Ionicons name="checkmark" size={15} color={p.accent} />
        </Pressable>
      </View>
    );
  }

  if (!value) {
    return (
      <Pressable
        onPress={() => setEditing(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.empty, { opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button">
        <Ionicons name="time-outline" size={13} color={p.muted} />
        <Text style={[styles.emptyText, { color: p.muted }]}>시간 정하기</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => setEditing(true)}
      onLongPress={() => onChange(null)}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: outOfOrder ? p.warn : p.accent,
          backgroundColor: pressed ? p.accentSoft : 'transparent',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`방문 시각 ${formatTime(value)}${outOfOrder ? ', 앞 스톱보다 이른 시각' : ''}`}>
      <Ionicons
        name={outOfOrder ? 'warning-outline' : 'time'}
        size={13}
        color={outOfOrder ? p.warn : p.accent}
      />
      <Text style={[styles.chipText, { color: outOfOrder ? p.warn : p.accent }]}>
        {formatTime(value)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  emptyText: { fontSize: Type.caption, fontWeight: '700' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  chipText: { fontSize: Type.caption, fontWeight: '800', fontVariant: ['tabular-nums'] },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  input: { width: 66, fontSize: Type.caption, fontWeight: '800', padding: 0, fontVariant: ['tabular-nums'] },
});
