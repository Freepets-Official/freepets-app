import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfidenceBadge } from '@/components/confidence-badge';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { FACILITIES, formatDistance } from '@/data/mock';
import { CATEGORY_LABEL, REQUIREMENT_LABEL, type Requirement } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const REQUIREMENTS: Requirement[] = ['LEASH', 'CAGE', 'MUZZLE', 'VACCINATION', 'SMALL_ONLY', 'OUTDOOR_ONLY'];

/** 사업자등록번호 10자리만 남긴다 */
const digitsOnly = (s: string) => s.replace(/[^0-9]/g, '').slice(0, 10);
const formatBizNo = (d: string) =>
  d.length <= 3 ? d : d.length <= 5 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
/** 앞 5자리만 보이고 뒤는 가린다 (원본은 저장하지 않으므로 표시용) */
const maskBizNo = (d: string) => `${d.slice(0, 3)}-${d.slice(3, 5)}-*****`;

/**
 * 사업자 셀프 등록 (F5) — 사업자가 진위확인 후 자기 매장의 출입 조건을 직접 확정한다.
 * 모호함을 발생 지점에서 없앤다: 확정 즉시 그 시설의 신뢰도가 '확정 · 사업자 확인'으로 올라간다.
 */
export default function BusinessScreen() {
  const p = usePalette();
  const router = useRouter();
  const { registerBusiness, businessRegOf } = useAppStore();

  const [bizDigits, setBizDigits] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [bizError, setBizError] = useState<string | null>(null);

  const [facilityId, setFacilityId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const [petAllowed, setPetAllowed] = useState(true);
  const [maxWeight, setMaxWeight] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [conditionRaw, setConditionRaw] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [done, setDone] = useState(false);

  const facility = FACILITIES.find((f) => f.facilityId === facilityId) ?? null;

  const candidates = useMemo(() => {
    const q = query.trim();
    return FACILITIES.filter((f) => !q || f.name.includes(q) || f.address.includes(q)).slice(0, 6);
  }, [query]);

  const verify = () => {
    if (verifying) return;
    if (bizDigits.length !== 10) return setBizError('사업자등록번호 10자리를 정확히 입력해 주세요');
    setBizError(null);
    setVerifying(true);
    // 데모: 국세청 진위확인 API 호출을 흉내. 실제 연동은 백엔드가 data.go.kr 키로 처리한다.
    setTimeout(() => {
      setVerified(true);
      setVerifying(false);
    }, 900);
  };

  const selectFacility = (id: number) => {
    setFacilityId(id);
    const f = FACILITIES.find((x) => x.facilityId === id);
    if (f) {
      // 기존 관광공사 정보를 초깃값으로 채워 사업자가 수정만 하면 되게 한다
      setPetAllowed(f.petAllowed !== false);
      setMaxWeight(f.maxWeight !== null ? String(f.maxWeight) : '');
      setRequirements(f.requirements);
      setConditionRaw(f.petConditionRaw ?? '');
    }
  };

  const toggleReq = (r: Requirement) => {
    setRequirements((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const submit = () => {
    if (!facility) return;
    if (petAllowed && !conditionRaw.trim()) {
      return setFormError('손님이 볼 출입 조건을 한 줄이라도 적어 주세요');
    }
    const w = maxWeight.trim() === '' ? null : Number(maxWeight);
    if (w !== null && (Number.isNaN(w) || w <= 0)) {
      return setFormError('최대 허용 체중을 숫자로 입력해 주세요');
    }
    setFormError(null);
    registerBusiness({
      facilityId: facility.facilityId,
      bizNoMasked: maskBizNo(bizDigits),
      petAllowed,
      maxWeight: petAllowed ? w : null,
      requirements: petAllowed ? requirements : [],
      conditionRaw: petAllowed
        ? conditionRaw.trim()
        : '반려동물 동반이 불가능합니다.',
      confirmedAt: new Date().toISOString(),
    });
    setDone(true);
  };

  if (done && facility) {
    const already = businessRegOf(facility.facilityId);
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '사업자 등록' }} />
        <View style={styles.doneWrap}>
          <View style={[styles.doneIcon, { backgroundColor: p.successSoft }]}>
            <Ionicons name="shield-checkmark" size={34} color={p.success} />
          </View>
          <Text style={[styles.doneTitle, { color: p.ink }]}>조건을 확정했어요</Text>
          <Text style={[styles.doneBody, { color: p.muted }]}>
            {facility.name}의 출입 조건이 사업자 확인으로 등록됐어요.{'\n'}
            이제 손님에게 <Text style={{ fontWeight: '800', color: p.success }}>확정</Text> 정보로 보여집니다.
          </Text>

          <View style={[styles.doneCard, CardShadow, { backgroundColor: p.card, borderColor: p.success }]}>
            <View style={styles.doneCardHead}>
              <ConfidenceBadge confidence="CONFIRMED" />
              <Text style={[styles.doneCardSource, { color: p.muted }]}>
                사업자 확인 · {already?.bizNoMasked}
              </Text>
            </View>
            <Text style={[styles.doneCondition, { color: p.ink }]}>
              {already?.conditionRaw}
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.replace({ pathname: '/facility/[id]', params: { id: String(facility.facilityId) } })
            }
            style={({ pressed }) => [styles.doneBtn, { backgroundColor: pressed ? p.accentDark : p.accent }]}>
            <Text style={[styles.doneBtnText, { color: p.onAccent }]}>내 매장 화면 보기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '사업자 등록' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: p.accent }]}>사업자 셀프 등록</Text>
            <Text style={[styles.title, { color: p.ink }]}>내 매장 조건을{'\n'}직접 확정하세요</Text>
            <Text style={[styles.sub, { color: p.muted }]}>
              사장님이 확정한 조건은 &lsquo;확정&rsquo; 정보로 손님에게 보여져요. 모호함 때문에 헛걸음하거나
              문 앞에서 실랑이하는 일이 사라집니다.
            </Text>
          </View>

          {/* STEP 1 — 사업자 진위확인 */}
          <View style={styles.stepBlock}>
            <StepLabel n={1} label="사업자 인증" done={verified} />
            {verified ? (
              <View style={[styles.verifiedBox, { backgroundColor: p.successSoft, borderColor: p.success }]}>
                <Ionicons name="checkmark-circle" size={17} color={p.success} />
                <Text style={[styles.verifiedText, { color: p.ink }]}>
                  {maskBizNo(bizDigits)} · 진위확인 완료
                </Text>
              </View>
            ) : (
              <>
                <View style={[styles.inputRow, { backgroundColor: p.surface, borderColor: bizError ? p.danger : p.line }]}>
                  <Ionicons name="business" size={17} color={p.muted} />
                  <TextInput
                    value={formatBizNo(bizDigits)}
                    onChangeText={(t) => setBizDigits(digitsOnly(t))}
                    placeholder="사업자등록번호 (숫자 10자리)"
                    placeholderTextColor={p.muted}
                    keyboardType="number-pad"
                    style={[styles.input, { color: p.ink }]}
                  />
                </View>
                {bizError && <Text style={[styles.err, { color: p.danger }]}>{bizError}</Text>}
                <Pressable
                  onPress={verify}
                  disabled={verifying}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: pressed || verifying ? p.accentDark : p.accent },
                  ]}>
                  {verifying ? (
                    <>
                      <ActivityIndicator color={p.onAccent} size="small" />
                      <Text style={[styles.actionBtnText, { color: p.onAccent }]}>진위확인 중…</Text>
                    </>
                  ) : (
                    <Text style={[styles.actionBtnText, { color: p.onAccent }]}>진위확인</Text>
                  )}
                </Pressable>
                <Text style={[styles.hint, { color: p.muted }]}>
                  국세청 사업자등록정보로 진위만 확인해요. 번호 원본은 저장하지 않습니다.
                </Text>
              </>
            )}
          </View>

          {/* STEP 2 — 내 매장 선택 */}
          {verified && (
            <Animated.View entering={FadeInDown.duration(260)} style={styles.stepBlock}>
              <StepLabel n={2} label="내 매장 선택" done={!!facility} />
              {facility ? (
                <View style={[styles.pickedRow, { borderColor: p.accent, backgroundColor: p.accentSoft }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickedName, { color: p.ink }]}>{facility.name}</Text>
                    <Text style={[styles.pickedMeta, { color: p.muted }]}>
                      {CATEGORY_LABEL[facility.category]} · {facility.address}
                    </Text>
                  </View>
                  <Pressable onPress={() => setFacilityId(null)}>
                    <Text style={[styles.change, { color: p.accent }]}>변경</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={[styles.inputRow, { backgroundColor: p.surface, borderColor: p.line }]}>
                    <Ionicons name="search" size={17} color={p.muted} />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="매장명이나 주소로 찾기"
                      placeholderTextColor={p.muted}
                      style={[styles.input, { color: p.ink }]}
                    />
                  </View>
                  <View style={styles.candidates}>
                    {candidates.map((f) => (
                      <Pressable
                        key={f.facilityId}
                        onPress={() => selectFacility(f.facilityId)}
                        style={({ pressed }) => [
                          styles.candidate,
                          { borderColor: p.line, backgroundColor: pressed ? p.surface : p.card },
                        ]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.candName, { color: p.ink }]}>{f.name}</Text>
                          <Text style={[styles.candMeta, { color: p.muted }]}>
                            {CATEGORY_LABEL[f.category]} · {formatDistance(f.distanceM)}
                          </Text>
                        </View>
                        <ConfidenceBadge confidence={f.confidence} size="sm" />
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </Animated.View>
          )}

          {/* STEP 3 — 출입 조건 확정 */}
          {verified && facility && (
            <Animated.View entering={FadeInDown.duration(260)} style={styles.stepBlock}>
              <StepLabel n={3} label="출입 조건 확정" done={false} />

              <View style={[styles.toggleRow, { borderColor: p.line }]}>
                <Text style={[styles.toggleLabel, { color: p.ink }]}>반려동물 동반</Text>
                <View style={styles.segment}>
                  {[
                    { v: true, label: '가능' },
                    { v: false, label: '불가' },
                  ].map((opt) => {
                    const on = petAllowed === opt.v;
                    return (
                      <Pressable
                        key={opt.label}
                        onPress={() => setPetAllowed(opt.v)}
                        style={[
                          styles.segmentBtn,
                          { backgroundColor: on ? p.accent : 'transparent' },
                        ]}>
                        <Text style={[styles.segmentText, { color: on ? p.onAccent : p.muted }]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {petAllowed && (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.fieldLabel, { color: p.ink }]}>최대 허용 체중 (선택)</Text>
                    <View style={[styles.inputRow, { backgroundColor: p.surface, borderColor: p.line }]}>
                      <TextInput
                        value={maxWeight}
                        onChangeText={(t) => setMaxWeight(t.replace(/[^0-9.]/g, ''))}
                        placeholder="예) 10 · 제한 없으면 비워두세요"
                        placeholderTextColor={p.muted}
                        keyboardType="decimal-pad"
                        style={[styles.input, { color: p.ink }]}
                      />
                      <Text style={[styles.unit, { color: p.muted }]}>kg</Text>
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.fieldLabel, { color: p.ink }]}>필수 조건</Text>
                    <View style={styles.reqChips}>
                      {REQUIREMENTS.map((r) => {
                        const on = requirements.includes(r);
                        return (
                          <Pressable
                            key={r}
                            onPress={() => toggleReq(r)}
                            style={[
                              styles.reqChip,
                              { backgroundColor: on ? p.accentSoft : p.surface, borderColor: on ? p.accent : p.line },
                            ]}>
                            <Ionicons
                              name={on ? 'checkmark-circle' : 'add-circle-outline'}
                              size={15}
                              color={on ? p.accent : p.muted}
                            />
                            <Text style={[styles.reqChipText, { color: on ? p.accent : p.muted }]}>
                              {REQUIREMENT_LABEL[r]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.fieldLabel, { color: p.ink }]}>손님에게 보여줄 안내 문구</Text>
                    <TextInput
                      value={conditionRaw}
                      onChangeText={setConditionRaw}
                      placeholder="예) 리드줄 착용 시 야외 테라스 동반 가능. 실내는 10kg 이하 소형견만 입장."
                      placeholderTextColor={p.muted}
                      multiline
                      style={[styles.textarea, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]}
                    />
                  </View>
                </>
              )}

              {formError && <Text style={[styles.err, { color: p.danger }]}>{formError}</Text>}

              <Pressable
                onPress={submit}
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: pressed ? p.accentDark : p.accent }]}>
                <Ionicons name="shield-checkmark" size={16} color={p.onAccent} />
                <Text style={[styles.actionBtnText, { color: p.onAccent }]}>조건 확정하기</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StepLabel({ n, label, done }: { n: number; label: string; done: boolean }) {
  const p = usePalette();
  return (
    <View style={styles.stepLabel}>
      <View style={[styles.stepNum, { backgroundColor: done ? p.success : p.accent }]}>
        {done ? (
          <Ionicons name="checkmark" size={13} color="#FFFFFF" />
        ) : (
          <Text style={styles.stepNumText}>{n}</Text>
        )}
      </View>
      <Text style={[styles.stepText, { color: p.ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 64, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.xl, paddingTop: Spacing.sm },
  head: { gap: 4 },
  eyebrow: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { fontSize: 13.5, lineHeight: 20, marginTop: 4 },

  stepBlock: { gap: Spacing.sm },
  stepLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  stepNum: { width: 22, height: 22, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  stepText: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },
  unit: { fontSize: 14, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingVertical: 15,
  },
  actionBtnText: { fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 11.5, lineHeight: 17 },
  err: { fontSize: 12.5, fontWeight: '700' },

  verifiedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
  },
  verifiedText: { fontSize: 13.5, fontWeight: '700' },

  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  pickedName: { fontSize: 15, fontWeight: '800' },
  pickedMeta: { fontSize: 12, marginTop: 2 },
  change: { fontSize: 13, fontWeight: '800' },
  candidates: { gap: Spacing.sm },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  candName: { fontSize: 14.5, fontWeight: '700' },
  candMeta: { fontSize: 12, marginTop: 1 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  toggleLabel: { fontSize: 14.5, fontWeight: '700' },
  segment: { flexDirection: 'row', borderRadius: Radius.full, overflow: 'hidden' },
  segmentBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: Radius.full },
  segmentText: { fontSize: 13.5, fontWeight: '800' },

  field: { gap: 7 },
  fieldLabel: { fontSize: 14, fontWeight: '800' },
  reqChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  reqChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  reqChipText: { fontSize: 13, fontWeight: '700' },
  textarea: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: 14.5,
    minHeight: 92,
    textAlignVertical: 'top',
  },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  doneIcon: { width: 76, height: 76, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  doneBody: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  doneCard: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing.xl,
    gap: 8,
    marginTop: Spacing.sm,
  },
  doneCardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  doneCardSource: { fontSize: 12.5, fontWeight: '600' },
  doneCondition: { fontSize: 14.5, lineHeight: 21 },
  doneBtn: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingVertical: 16,
    marginTop: Spacing.sm,
  },
  doneBtnText: { fontSize: 15.5, fontWeight: '800' },
});
