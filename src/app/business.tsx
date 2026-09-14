import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { BusinessVerify } from '@/components/business-verify';
import { ConfidenceBadge } from '@/components/confidence-badge';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { formatDistance } from '@/data/mock';
import { CATEGORY_LABEL, REQUIREMENT_LABEL, type Requirement } from '@/data/types';
import { useFacilityPicker } from '@/hooks/use-facility-picker';
import { usePalette } from '@/hooks/use-theme';
import { ApiError, type BusinessIdentity } from '@/lib/api';
import { useAppStore } from '@/store/app-store';

// 서버 enum 8종 전부. 빠진 게 있으면 서버가 프리필로 준 값을 화면에서 끌 수 없다
const REQUIREMENTS: Requirement[] = ['LEASH', 'CAGE', 'MUZZLE', 'VACCINATION', 'SMALL_ONLY', 'OUTDOOR_ONLY', 'STROLLER', 'MANNER_BELT'];

/**
 * 사업자 셀프 등록 (F5) — 사업자가 진위확인 후 자기 매장의 출입 조건을 직접 확정한다.
 * 모호함을 발생 지점에서 없앤다: 확정 즉시 그 시설의 신뢰도가 '확정 · 사업자 확인'으로 올라간다.
 */
export default function BusinessScreen() {
  const p = usePalette();
  const router = useRouter();
  const { claimFacility, businessRegOf, selectProfile, facilityById } = useAppStore();

  /** 1단계에서 국세청이 확인한 사업자 정보. 3단계 확정 요청에 다시 실린다 */
  const [identity, setIdentity] = useState<BusinessIdentity | null>(null);
  const [bizMasked, setBizMasked] = useState('');

  const [facilityId, setFacilityId] = useState<number | null>(null);
  // 인증이 끝나고 아직 매장을 안 골랐을 때만 검색을 돌린다 — 그 전엔 위치 권한을 묻지 않는다
  const picker = useFacilityPicker(!!identity && facilityId === null);

  const [petAllowed, setPetAllowed] = useState(true);
  const [maxWeight, setMaxWeight] = useState('');
  const [maxWeightInclusive, setMaxWeightInclusive] = useState(true);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [conditionRaw, setConditionRaw] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [done, setDone] = useState(false);

  const facility = facilityId !== null ? (facilityById(facilityId) ?? null) : null;

  const selectFacility = (id: number) => {
    setFacilityId(id);
    const f = facilityById(id);
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

  const submit = async () => {
    if (!facility || !identity || submitting) return;
    if (petAllowed && !conditionRaw.trim()) {
      return setFormError('손님이 볼 출입 조건을 한 줄이라도 적어 주세요');
    }
    const w = maxWeight.trim() === '' ? null : Number(maxWeight);
    if (w !== null && (Number.isNaN(w) || w <= 0)) {
      return setFormError('최대 허용 체중을 숫자로 입력해 주세요');
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await claimFacility(
        facility.facilityId,
        identity,
        {
          petAllowed: petAllowed ? 'ALLOWED' : 'DENIED',
          maxWeight: petAllowed ? w : null,
          maxWeightInclusive,
          requirements: petAllowed ? requirements : [],
          conditionRaw: petAllowed ? conditionRaw.trim() : '반려동물 동반이 불가능합니다.',
        },
        bizMasked,
      );
      setDone(true);
    } catch (e) {
      // 확정이 안 됐는데 완료 화면을 보여주면 손님 화면에는 옛 조건이 그대로 남는다
      setFormError(
        e instanceof ApiError && e.message
          ? e.message
          : '조건을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done && facility) {
    const already = businessRegOf(facility.facilityId);
    return (
      <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '사업자 등록', headerBackButtonDisplayMode: 'minimal'}} />
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

          <Text style={[styles.doneBody, { color: p.muted, marginTop: 2 }]}>
            사업자 프로필이 생겼어요. 이제 대시보드에서 소개·혜택·통계를 관리할 수 있어요.
          </Text>

          <Pressable
            onPress={() => {
              // 등록 즉시 사업자 프로필로 전환해 대시보드로 진입 (docs/10 흐름)
              selectProfile('owner');
              router.replace('/owner-dashboard');
            }}
            style={({ pressed }) => [styles.doneBtn, { backgroundColor: pressed ? p.accentDark : p.accent }]}>
            <Text style={[styles.doneBtnText, { color: p.onAccent }]}>내 매장 대시보드 열기</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.replace({ pathname: '/facility/[id]', params: { id: String(facility.facilityId) } })
            }
            style={styles.doneSecondary}>
            <Text style={[styles.doneSecondaryText, { color: p.accent }]}>손님 화면에서 보기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '사업자 등록' }} />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <StepLabel n={1} label="사업자 인증" done={!!identity} />
            {identity ? (
              <View style={[styles.verifiedBox, { backgroundColor: p.successSoft, borderColor: p.success }]}>
                <Ionicons name="checkmark-circle" size={17} color={p.success} />
                <Text style={[styles.verifiedText, { color: p.ink }]}>
                  {bizMasked} · {identity.representativeName} · 진위확인 완료
                </Text>
              </View>
            ) : (
              <BusinessVerify
                onVerified={(id, masked) => {
                  setIdentity(id);
                  setBizMasked(masked);
                }}
              />
            )}
          </View>

          {/* STEP 2 — 내 매장 선택 (서버 검색 — 내 위치 주변 + 키워드) */}
          {identity && (
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
                      value={picker.query}
                      onChangeText={picker.setQuery}
                      placeholder="매장명으로 찾기 (이름을 넣으면 전국)"
                      placeholderTextColor={p.muted}
                      style={[styles.input, { color: p.ink }]}
                    />
                    {picker.loading && <ActivityIndicator size="small" color={p.muted} />}
                  </View>
                  {picker.failed ? (
                    <Pressable onPress={picker.retry} style={styles.candidate}>
                      <Ionicons name="refresh" size={15} color={p.muted} />
                      <Text style={[styles.candMeta, { color: p.muted }]}>
                        매장을 불러오지 못했어요. 눌러서 다시 시도
                      </Text>
                    </Pressable>
                  ) : !picker.loading && picker.items.length === 0 ? (
                    <Text style={[styles.hint, { color: p.muted }]}>
                      {picker.query.trim()
                        ? '그 이름의 매장을 못 찾았어요. 관광공사에 등록된 이름으로 찾아보세요.'
                        : '주변 30km에 등록된 매장이 없어요. 매장명을 입력하면 전국에서 찾아요.'}
                    </Text>
                  ) : (
                    <View style={styles.candidates}>
                      {picker.items.map((f) => (
                        <Pressable
                          key={f.facilityId}
                          onPress={() => selectFacility(f.facilityId)}
                          style={({ pressed }) => [
                            styles.candidate,
                            { borderColor: p.line, backgroundColor: pressed ? p.surface : p.card },
                          ]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.candName, { color: p.ink }]}>{f.name}</Text>
                            <Text style={[styles.candMeta, { color: p.muted }]} numberOfLines={1}>
                              {CATEGORY_LABEL[f.category]}{f.distanceM !== null ? ` · ${formatDistance(f.distanceM)}` : ''} · {f.address}
                            </Text>
                          </View>
                          <ConfidenceBadge confidence={f.confidence} size="sm" />
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
            </Animated.View>
          )}

          {/* STEP 3 — 출입 조건 확정 */}
          {identity && facility && (
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
                      {/* "10kg 이하"와 "10kg 미만"은 현장에서 다른 답이 된다 — 사장님이 정한다 */}
                      {maxWeight.trim() !== '' && (
                        <View style={styles.segment}>
                          {[
                            { v: true, label: '이하' },
                            { v: false, label: '미만' },
                          ].map((opt) => {
                            const on = maxWeightInclusive === opt.v;
                            return (
                              <Pressable
                                key={opt.label}
                                onPress={() => setMaxWeightInclusive(opt.v)}
                                style={[styles.segmentBtn, { backgroundColor: on ? p.accent : 'transparent' }]}>
                                <Text style={[styles.segmentText, { color: on ? p.onAccent : p.muted }]}>
                                  {opt.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
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
                onPress={() => void submit()}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: pressed || submitting ? p.accentDark : p.accent },
                ]}>
                {submitting ? (
                  <ActivityIndicator color={p.onAccent} size="small" />
                ) : (
                  <Ionicons name="shield-checkmark" size={16} color={p.onAccent} />
                )}
                <Text style={[styles.actionBtnText, { color: p.onAccent }]}>
                  {submitting ? '서버에 확정하는 중…' : '조건 확정하기'}
                </Text>
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
  doneTitle: { fontSize: 21, lineHeight: 28, fontWeight: '900', letterSpacing: -0.5 },
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
  doneSecondary: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  doneSecondaryText: { fontSize: 14, fontWeight: '800' },
});
