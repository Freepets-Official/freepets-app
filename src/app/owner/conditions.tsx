import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OwnerLoadState } from '@/components/owner-load-state';
import { Text } from '@/components/text';
import { ConfidenceBadge } from '@/components/confidence-badge';
import { MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { REQUIREMENT_LABEL, type Requirement } from '@/data/types';
import { useOwnerFacilities } from '@/hooks/use-owner-facilities';
import { usePalette } from '@/hooks/use-theme';
import { ApiError, ownerApi, type OwnerFacility } from '@/lib/api';

const REQUIREMENTS: Requirement[] = ['LEASH', 'CAGE', 'MUZZLE', 'VACCINATION', 'SMALL_ONLY', 'OUTDOOR_ONLY', 'STROLLER', 'MANNER_BELT'];

/**
 * 출입 조건 관리 — 승인된 소유자가 조건을 직접 고친다(`PUT /owner/facilities/{id}/conditions`).
 * 재심사 없이 즉시 손님 화면에 반영된다. 판별에 쓰이는 값이 실제로 바뀐 경우에만 확정 시각이 갱신된다 —
 * 같은 값으로 저장을 반복해 거부 제보 하향을 푸는 길을 서버가 막아뒀다.
 */
export default function OwnerConditionsScreen() {
  const p = usePalette();
  const { facilityId: idParam } = useLocalSearchParams<{ facilityId?: string }>();
  const facilityId = Number(idParam);
  const { facilities, failed, refresh } = useOwnerFacilities();
  const facility = facilities?.find((f) => f.facilityId === facilityId) ?? null;

  if (!facility) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '출입 조건 관리', headerBackButtonDisplayMode: 'minimal' }} />
        <OwnerLoadState facilities={facilities} failed={failed} refresh={refresh} />
      </SafeAreaView>
    );
  }
  // 폼은 서버 값이 온 뒤에 마운트한다 — 초기값으로 한 번 채우고, 사용자가 고치는 중에 재조회가 덮지 않는다
  return <ConditionsForm facility={facility} refresh={refresh} />;
}

function ConditionsForm({ facility, refresh }: { facility: OwnerFacility; refresh: () => Promise<void> }) {
  const p = usePalette();
  const router = useRouter();
  const c = facility.entryCondition;
  const [petAllowed, setPetAllowed] = useState<'ALLOWED' | 'DENIED'>(c.petAllowed === 'DENIED' ? 'DENIED' : 'ALLOWED');
  const [maxWeight, setMaxWeight] = useState(c.maxWeight !== null ? String(c.maxWeight) : '');
  const [inclusive, setInclusive] = useState(c.maxWeightInclusive !== false);
  const [requirements, setRequirements] = useState<Requirement[]>(c.requirements);
  const [conditionRaw, setConditionRaw] = useState(c.conditionRaw ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleReq = (r: Requirement) =>
    setRequirements((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const save = async () => {
    if (saving) return;
    const w = maxWeight.trim() === '' ? null : Number(maxWeight);
    if (w !== null && (Number.isNaN(w) || w <= 0)) return setError('최대 허용 체중을 숫자로 입력해 주세요');
    if (petAllowed === 'ALLOWED' && !conditionRaw.trim()) return setError('손님이 볼 출입 조건을 한 줄이라도 적어 주세요');
    setError(null);
    setSaving(true);
    try {
      await ownerApi.updateConditions(facility.facilityId, {
        petAllowed,
        maxWeight: petAllowed === 'ALLOWED' ? w : null,
        maxWeightInclusive: petAllowed === 'ALLOWED' && w !== null ? inclusive : null,
        requirements: petAllowed === 'ALLOWED' ? requirements : [],
        conditionRaw: petAllowed === 'ALLOWED' ? conditionRaw.trim() : '반려동물 동반이 불가능합니다.',
      });
      await refresh();
      setSaved(true);
      setTimeout(() => router.back(), 700);
    } catch (e) {
      setError(e instanceof ApiError && e.message ? e.message : '조건을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '출입 조건 관리', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: p.accent }]}>{facility.name}</Text>
            <Text style={[styles.title, { color: p.ink }]}>출입 조건 관리</Text>
            <View style={styles.status}>
              <ConfidenceBadge confidence={c.confidence} size="sm" />
              <Text style={[styles.statusText, { color: p.muted }]}>
                {c.confidenceSource === 'DENIAL_REPORT'
                  ? '거부 제보가 들어와 신뢰도가 내려간 상태예요. 조건이 바뀌었다면 여기서 고쳐 주세요.'
                  : c.confirmedAt
                    ? `${c.confirmedAt.slice(0, 10)} 확정 · 저장하면 손님 화면에 바로 반영돼요`
                    : '저장하면 손님 화면에 바로 반영돼요'}
              </Text>
            </View>
          </View>

          <View style={[styles.toggleRow, { borderColor: p.line }]}>
            <Text style={[styles.toggleLabel, { color: p.ink }]}>반려동물 동반</Text>
            <View style={styles.segment}>
              {([['ALLOWED', '가능'], ['DENIED', '불가']] as const).map(([v, label]) => (
                <Pressable key={v} onPress={() => setPetAllowed(v)} style={[styles.segmentBtn, { backgroundColor: petAllowed === v ? p.accent : 'transparent' }]}>
                  <Text style={[styles.segmentText, { color: petAllowed === v ? p.onAccent : p.muted }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {petAllowed === 'ALLOWED' && (
            <>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: p.ink }]}>최대 허용 체중 (선택)</Text>
                <View style={[styles.inputRow, { backgroundColor: p.surface, borderColor: p.line }]}>
                  <TextInput value={maxWeight} onChangeText={(t) => setMaxWeight(t.replace(/[^0-9.]/g, ''))} placeholder="예) 10 · 제한 없으면 비워두세요" placeholderTextColor={p.muted} keyboardType="decimal-pad" style={[styles.input, { color: p.ink }]} />
                  <Text style={[styles.unit, { color: p.muted }]}>kg</Text>
                  {maxWeight.trim() !== '' && (
                    <View style={styles.segment}>
                      {([[true, '이하'], [false, '미만']] as const).map(([v, label]) => (
                        <Pressable key={label} onPress={() => setInclusive(v)} style={[styles.segmentBtn, { backgroundColor: inclusive === v ? p.accent : 'transparent' }]}>
                          <Text style={[styles.segmentText, { color: inclusive === v ? p.onAccent : p.muted }]}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: p.ink }]}>필수 조건</Text>
                <View style={styles.chips}>
                  {REQUIREMENTS.map((r) => {
                    const on = requirements.includes(r);
                    return (
                      <Pressable key={r} onPress={() => toggleReq(r)} style={[styles.chip, { backgroundColor: on ? p.accentSoft : p.surface, borderColor: on ? p.accent : p.line }]}>
                        <Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={15} color={on ? p.accent : p.muted} />
                        <Text style={[styles.chipText, { color: on ? p.accent : p.muted }]}>{REQUIREMENT_LABEL[r]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: p.ink }]}>손님에게 보여줄 안내 문구</Text>
                <TextInput value={conditionRaw} onChangeText={setConditionRaw} placeholder="예) 리드줄 착용 시 야외 테라스 동반 가능. 실내는 10kg 이하 소형견만 입장." placeholderTextColor={p.muted} multiline maxLength={500} style={[styles.textarea, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]} />
              </View>
            </>
          )}

          {error && <Text style={[styles.err, { color: p.danger }]}>{error}</Text>}
          <Pressable onPress={() => void save()} disabled={saving} style={({ pressed }) => [styles.saveBtn, { backgroundColor: saved ? p.success : pressed || saving ? p.accentDark : p.accent }]}>
            {saving ? <ActivityIndicator color={p.onAccent} size="small" /> : <Ionicons name={saved ? 'checkmark' : 'shield-checkmark'} size={16} color={p.onAccent} />}
            <Text style={[styles.saveText, { color: p.onAccent }]}>{saved ? '저장했어요' : saving ? '저장하는 중…' : '조건 저장하기'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 64 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.xl, paddingTop: Spacing.sm },
  head: { gap: 6 },
  eyebrow: { fontSize: Type.footnote, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: Type.screenTitle, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  statusText: { fontSize: Type.footnote, lineHeight: 18, flexShrink: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 10 },
  toggleLabel: { fontSize: Type.bodyLg, fontWeight: '800' },
  segment: { flexDirection: 'row', borderRadius: Radius.full, overflow: 'hidden', gap: 2 },
  segmentBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  segmentText: { fontSize: Type.footnote, fontWeight: '800' },
  field: { gap: 8 },
  fieldLabel: { fontSize: Type.bodyLg, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 10 },
  input: { flex: 1, fontSize: Type.callout, padding: 0 },
  unit: { fontSize: Type.body, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: Radius.full, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontSize: Type.body, fontWeight: '700' },
  textarea: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, fontSize: Type.bodyLg, minHeight: 96, textAlignVertical: 'top' },
  err: { fontSize: Type.footnote, lineHeight: 18, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.full, paddingVertical: 15 },
  saveText: { fontSize: Type.callout, fontWeight: '800' },
  empty: { fontSize: Type.bodyLg, textAlign: 'center', padding: 40 },
});
