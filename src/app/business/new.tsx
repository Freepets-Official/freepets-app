import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusinessVerify } from '@/components/business-verify';
import { Text } from '@/components/text';
import { CardShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { CATEGORY_LABEL, REQUIREMENT_LABEL, type Category, type Requirement } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { ApiError, businessApi, duplicateCandidatesOf, type BusinessIdentity, type DuplicateCandidate } from '@/lib/api';
import { useAppStore } from '@/store/app-store';

const CATEGORIES: Category[] = ['CAFE', 'RESTAURANT', 'STAY', 'TOUR', 'LEISURE', 'SHOPPING'];
const REQUIREMENTS: Requirement[] = ['LEASH', 'CAGE', 'MUZZLE', 'VACCINATION', 'SMALL_ONLY', 'OUTDOOR_ONLY', 'STROLLER', 'MANNER_BELT'];

/**
 * 신규 매장 등록 — 관광공사 목록에 없는 매장(새로 연 카페 등)을 사업자가 직접 만든다.
 *
 * 기존 매장 claim(`/business`)과는 **완전히 다른 경로**다(business.md 5번). 등록증 업로드도,
 * 운영자 승인도 없다 — 대조할 관광공사 데이터가 없으니 국세청 진위확인으로 대신하고,
 * 성공하면 시설·소유권이 그 자리에서 확정된다(응답 `APPROVED`).
 *
 * 좌표는 보내지 않는다. 서버가 주소를 카카오 로컬로 지오코딩해 채운다 — 주소 오탈자는
 * `BUSINESS4011`로 돌아오므로 그 메시지를 그대로 보여준다.
 */
export default function NewFacilityScreen() {
  const p = usePalette();
  const router = useRouter();
  const { registerNewFacility, stampRegions, reloadStampRegions, selectProfile } = useAppStore();

  const [identity, setIdentity] = useState<BusinessIdentity | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<Category>('CAFE');
  const [sidoCode, setSidoCode] = useState<string | null>(null);
  const [sigunguCode, setSigunguCode] = useState<string | null>(null);

  const [petAllowed, setPetAllowed] = useState(true);
  const [maxWeight, setMaxWeight] = useState('');
  const [maxWeightInclusive, setMaxWeightInclusive] = useState(true);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [conditionRaw, setConditionRaw] = useState('');

  /** 중복 후보 — 이름·주소를 다 적으면 서버에 먼저 물어 "이 매장 아닌가요?"를 띄운다(5-1) */
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [checking, setChecking] = useState(false);
  /** 후보를 보고도 "다른 매장이다"를 확인했는가. 확인 없이는 서버가 BUSINESS4010으로 막는다 */
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ facilityId: number; name: string } | null>(null);

  const sido = useMemo(() => stampRegions.find((r) => r.sidoCode === sidoCode) ?? null, [stampRegions, sidoCode]);
  useEffect(() => {
    if (identity && stampRegions.length === 0) void reloadStampRegions();
  }, [identity, stampRegions.length, reloadStampRegions]);

  // 이름·주소가 멈춘 뒤에 한 번만 물어본다 — 타이핑마다 부르면 지오코딩 쿼터를 태운다
  const trimmedName = name.trim();
  const trimmedAddress = address.trim();
  useEffect(() => {
    let alive = true;
    const ready = !!identity && trimmedName.length >= 2 && trimmedAddress.length >= 5;
    const t = setTimeout(() => {
      void (async () => {
        if (!ready) {
          setCandidates([]);
          setChecking(false);
          return;
        }
        setChecking(true);
        try {
          const list = await businessApi.duplicateCheck(trimmedName, trimmedAddress);
          if (!alive) return;
          setCandidates(list);
          setAcknowledged(false);
        } catch {
          // 주소를 못 찾거나(BUSINESS4011) 카카오가 흔들린 경우 — 등록 시도 자체는 막지 않는다.
          // 서버가 저장 직전에 같은 검사를 다시 하므로 여기서 놓쳐도 중복이 그냥 통과하지는 않는다.
          if (alive) setCandidates([]);
        } finally {
          if (alive) setChecking(false);
        }
      })();
    }, ready ? 800 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [identity, trimmedName, trimmedAddress]);

  const toggleReq = (r: Requirement) => setRequirements((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const submit = async () => {
    if (!identity || submitting) return;
    if (trimmedName.length === 0) return setError('매장명을 입력해 주세요');
    if (trimmedAddress.length === 0) return setError('매장 주소를 입력해 주세요');
    if (!sidoCode) return setError('매장이 있는 지역을 골라 주세요');
    if (petAllowed && !conditionRaw.trim()) return setError('손님이 볼 출입 조건을 한 줄이라도 적어 주세요');
    const w = maxWeight.trim() === '' ? null : Number(maxWeight);
    if (w !== null && (Number.isNaN(w) || w <= 0)) return setError('최대 허용 체중을 숫자로 입력해 주세요');
    if (candidates.length > 0 && !acknowledged) return setError('근처에 이름이 비슷한 매장이 있어요. 목록을 확인해 주세요');
    setError(null);
    setSubmitting(true);
    try {
      const res = await registerNewFacility(identity, {
        name: trimmedName,
        category,
        address: trimmedAddress,
        phone: phone.trim() || null,
        sidoCode,
        sigunguCode,
        petAllowed: petAllowed ? 'ALLOWED' : 'DENIED',
        maxWeight: petAllowed ? w : null,
        maxWeightInclusive,
        requirements: petAllowed ? requirements : [],
        conditionRaw: petAllowed ? conditionRaw.trim() : '반려동물 동반이 불가능합니다.',
        duplicateCheckAcknowledged: acknowledged,
      });
      setDone({ facilityId: res.facilityId, name: res.name });
    } catch (e) {
      // 서버가 저장 직전에 다시 검사한다 — 그때 나온 후보를 보여주고 확인을 받는다
      const found = duplicateCandidatesOf(e);
      if (found.length > 0) {
        setCandidates(found);
        setAcknowledged(false);
        setError('근처에 이름이 비슷한 매장이 있어요. 같은 매장이면 그 매장을 등록해 주세요.');
      } else {
        setError(e instanceof ApiError && e.message ? e.message : '매장을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '신규 매장 등록', headerBackButtonDisplayMode: 'minimal' }} />
        <View style={styles.doneWrap}>
          <View style={[styles.doneIcon, { backgroundColor: p.successSoft }]}>
            <Ionicons name="checkmark" size={34} color={p.success} />
          </View>
          <Text style={[styles.doneTitle, { color: p.ink }]}>등록이 끝났어요</Text>
          <Text style={[styles.doneBody, { color: p.muted }]}>
            {done.name}이(가) 지도에 올라갔어요.{'\n'}
            사장님 확정 정보라 손님 화면에 <Text style={{ fontWeight: '800', color: p.ink }}>확정</Text> 배지로 보여요 — 운영자 승인을 기다리지 않아요.
          </Text>
          <Pressable
            onPress={() => {
              selectProfile('owner');
              router.replace('/owner-dashboard');
            }}
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: pressed ? p.accentDark : p.accent }]}>
            <Text style={[styles.primaryBtnText, { color: p.onAccent }]}>사업자 대시보드로</Text>
          </Pressable>
          <Pressable onPress={() => router.replace({ pathname: '/facility/[id]', params: { id: String(done.facilityId) } })} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryBtnText, { color: p.muted }]}>등록한 매장 보기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '신규 매장 등록', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: p.accent }]}>사업자 등록</Text>
            <Text style={[styles.title, { color: p.ink }]}>목록에 없는 매장{'\n'}직접 등록하기</Text>
            <Text style={[styles.sub, { color: p.muted }]}>
              관광공사 데이터에 아직 없는 매장이라면 사장님이 직접 올릴 수 있어요. 등록증 없이 사업자 진위확인만 통과하면 바로 확정돼요.
            </Text>
          </View>

          <View style={styles.stepBlock}>
            <StepLabel n={1} label="사업자 진위확인" done={!!identity} />
            {identity ? (
              <View style={[styles.doneRow, { backgroundColor: p.successSoft }]}>
                <Ionicons name="shield-checkmark" size={16} color={p.success} />
                <Text style={[styles.doneRowText, { color: p.success }]}>확인됐어요</Text>
              </View>
            ) : (
              <BusinessVerify onVerified={(id) => setIdentity(id)} />
            )}
          </View>

          {identity && (
            <Animated.View entering={FadeInDown.duration(260)} style={styles.stepBlock}>
              <StepLabel n={2} label="매장 정보" done={trimmedName.length > 0 && trimmedAddress.length > 0 && !!sidoCode} />
              <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                <Field label="매장명">
                  <TextInput value={name} onChangeText={setName} placeholder="예) 카페 파도살롱" placeholderTextColor={p.muted} maxLength={200} style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]} />
                </Field>
                <Field label="주소" hint="도로명 주소를 정확히 적어 주세요. 이 주소로 지도 위치가 정해져요.">
                  <TextInput value={address} onChangeText={setAddress} placeholder="예) 강원 강릉시 창해로 17" placeholderTextColor={p.muted} maxLength={300} style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]} />
                </Field>
                <Field label="연락처 (선택)">
                  <TextInput value={phone} onChangeText={setPhone} placeholder="예) 033-123-4567" placeholderTextColor={p.muted} keyboardType="phone-pad" maxLength={200} style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]} />
                </Field>
                <Field label="분류">
                  <View style={styles.chips}>
                    {CATEGORIES.map((c) => {
                      const on = category === c;
                      return (
                        <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, { backgroundColor: on ? p.accentSoft : p.surface, borderColor: on ? p.accent : p.line }]}>
                          <Text style={[styles.chipText, { color: on ? p.accent : p.muted }]}>{CATEGORY_LABEL[c]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>
                <Field label="지역" hint="랭킹·지역 검색에 쓰여요.">
                  {stampRegions.length === 0 ? (
                    <Pressable onPress={() => void reloadStampRegions()}>
                      <Text style={[styles.hint, { color: p.muted }]}>지역 목록을 불러오지 못했어요. 눌러서 다시 시도</Text>
                    </Pressable>
                  ) : (
                    <>
                      <View style={styles.chips}>
                        {stampRegions.map((r) => {
                          const on = sidoCode === r.sidoCode;
                          return (
                            <Pressable
                              key={r.sidoCode}
                              onPress={() => {
                                setSidoCode(r.sidoCode);
                                setSigunguCode(null);
                              }}
                              style={[styles.chip, { backgroundColor: on ? p.accentSoft : p.surface, borderColor: on ? p.accent : p.line }]}>
                              <Text style={[styles.chipText, { color: on ? p.accent : p.muted }]}>{r.sido}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {sido && sido.sigungus.length > 0 && (
                        <View style={[styles.chips, { marginTop: 6 }]}>
                          {sido.sigungus.map((sg) => {
                            const on = sigunguCode === sg.sigunguCode;
                            return (
                              <Pressable key={sg.sigunguCode} onPress={() => setSigunguCode(on ? null : sg.sigunguCode)} style={[styles.chipSm, { backgroundColor: on ? p.accent : p.surface, borderColor: on ? p.accent : p.line }]}>
                                <Text style={[styles.chipSmText, { color: on ? p.onAccent : p.muted }]}>{sg.sigungu}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </>
                  )}
                </Field>
              </View>

              {checking && <Text style={[styles.hint, { color: p.muted }]}>근처에 같은 매장이 있는지 확인하는 중…</Text>}
              {candidates.length > 0 && (
                <View style={[styles.dupCard, { borderColor: p.warn, backgroundColor: p.warnSoft }]}>
                  <View style={styles.dupHead}>
                    <Ionicons name="alert-circle" size={16} color={p.warn} />
                    <Text style={[styles.dupTitle, { color: p.ink }]}>이 매장인가요?</Text>
                  </View>
                  <Text style={[styles.dupBody, { color: p.muted }]}>
                    근처에 이름이 비슷한 매장이 이미 있어요. 같은 매장이면 새로 만들지 말고 그 매장을 등록해야 손님 리뷰·판별 기록이 흩어지지 않아요.
                  </Text>
                  {candidates.map((c) => (
                    <Pressable
                      key={c.facilityId}
                      onPress={() => router.replace({ pathname: '/business', params: { facilityId: String(c.facilityId) } })}
                      style={({ pressed }) => [styles.dupItem, { backgroundColor: pressed ? p.surface : p.card, borderColor: p.line }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dupName, { color: p.ink }]}>{c.name}</Text>
                        <Text style={[styles.dupAddr, { color: p.muted }]} numberOfLines={1}>
                          {c.address ?? '주소 미등록'}
                          {c.distanceMeters !== null ? ` · ${Math.round(c.distanceMeters)}m` : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={p.muted} />
                    </Pressable>
                  ))}
                  <Pressable onPress={() => setAcknowledged((v) => !v)} style={styles.ackRow}>
                    <Ionicons name={acknowledged ? 'checkbox' : 'square-outline'} size={19} color={acknowledged ? p.accent : p.muted} />
                    <Text style={[styles.ackText, { color: acknowledged ? p.ink : p.muted }]}>위 목록에 없는 다른 매장이에요</Text>
                  </Pressable>
                </View>
              )}
            </Animated.View>
          )}

          {identity && (
            <Animated.View entering={FadeInDown.duration(260)} style={styles.stepBlock}>
              <StepLabel n={3} label="출입 조건" done={petAllowed ? conditionRaw.trim().length > 0 : true} />
              <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                <View style={styles.segment}>
                  {[
                    { v: true, label: '동반 가능' },
                    { v: false, label: '동반 불가' },
                  ].map((opt) => {
                    const on = petAllowed === opt.v;
                    return (
                      <Pressable key={String(opt.v)} onPress={() => setPetAllowed(opt.v)} style={[styles.segmentItem, { backgroundColor: on ? p.accent : p.surface, borderColor: on ? p.accent : p.line }]}>
                        <Text style={[styles.segmentText, { color: on ? p.onAccent : p.muted }]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {petAllowed && (
                  <>
                    <Field label="최대 허용 체중 (선택)">
                      <View style={styles.weightRow}>
                        <TextInput value={maxWeight} onChangeText={setMaxWeight} placeholder="예) 10" placeholderTextColor={p.muted} keyboardType="number-pad" maxLength={3} style={[styles.input, styles.weightInput, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]} />
                        <Text style={[styles.unit, { color: p.muted }]}>kg</Text>
                        <View style={styles.segmentSm}>
                          {[
                            { v: true, label: '이하' },
                            { v: false, label: '미만' },
                          ].map((opt) => {
                            const on = maxWeightInclusive === opt.v;
                            return (
                              <Pressable key={String(opt.v)} onPress={() => setMaxWeightInclusive(opt.v)} style={[styles.chipSm, { backgroundColor: on ? p.accent : p.surface, borderColor: on ? p.accent : p.line }]}>
                                <Text style={[styles.chipSmText, { color: on ? p.onAccent : p.muted }]}>{opt.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    </Field>
                    <Field label="요구사항">
                      <View style={styles.chips}>
                        {REQUIREMENTS.map((r) => {
                          const on = requirements.includes(r);
                          return (
                            <Pressable key={r} onPress={() => toggleReq(r)} style={[styles.chip, { backgroundColor: on ? p.accentSoft : p.surface, borderColor: on ? p.accent : p.line }]}>
                              <Text style={[styles.chipText, { color: on ? p.accent : p.muted }]}>{REQUIREMENT_LABEL[r]}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </Field>
                    <Field label="손님에게 보여줄 안내문">
                      <TextInput value={conditionRaw} onChangeText={setConditionRaw} placeholder="예) 리드줄 착용 시 야외 테라스만 동반 가능해요" placeholderTextColor={p.muted} multiline maxLength={500} style={[styles.input, styles.textarea, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]} />
                    </Field>
                  </>
                )}
              </View>

              {error && <Text style={[styles.error, { color: p.danger }]}>{error}</Text>}
              <Pressable onPress={() => void submit()} disabled={submitting} style={({ pressed }) => [styles.primaryBtn, { backgroundColor: pressed || submitting ? p.accentDark : p.accent }]}>
                {submitting ? <ActivityIndicator color={p.onAccent} size="small" /> : <Ionicons name="storefront" size={16} color={p.onAccent} />}
                <Text style={[styles.primaryBtnText, { color: p.onAccent }]}>{submitting ? '등록하는 중…' : '매장 등록하기'}</Text>
              </Pressable>
              <Text style={[styles.hint, { color: p.muted }]}>
                등록하면 사장님이 확정한 조건으로 바로 공개돼요. 나중에 「출입 조건 관리」에서 고칠 수 있어요.
              </Text>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: p.ink }]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: p.muted }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function StepLabel({ n, label, done }: { n: number; label: string; done: boolean }) {
  const p = usePalette();
  return (
    <View style={styles.stepLabel}>
      <View style={[styles.stepNum, { backgroundColor: done ? p.success : p.accent }]}>
        {done ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : <Text style={styles.stepNumText}>{n}</Text>}
      </View>
      <Text style={[styles.stepText, { color: p.ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 72 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.xl, paddingTop: Spacing.sm },
  head: { gap: 4 },
  eyebrow: { fontSize: Type.footnote, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: Type.screenTitle, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { fontSize: Type.body, lineHeight: 20, marginTop: 4 },
  stepBlock: { gap: Spacing.sm },
  stepLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  stepNum: { width: 22, height: 22, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: Type.footnote, fontWeight: '900', color: '#FFFFFF' },
  stepText: { fontSize: Type.bodyLg, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.lg },
  field: { gap: 6 },
  fieldLabel: { fontSize: Type.body, fontWeight: '800' },
  hint: { fontSize: Type.caption, lineHeight: 17 },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: Type.bodyLg },
  textarea: { minHeight: 78, textAlignVertical: 'top', paddingTop: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1.5, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: Type.footnote, fontWeight: '700' },
  chipSm: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  chipSmText: { fontSize: Type.footnote, fontWeight: '700' },
  segment: { flexDirection: 'row', gap: Spacing.sm },
  segmentItem: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: Radius.md, paddingVertical: 11 },
  segmentText: { fontSize: Type.bodyLg, fontWeight: '800' },
  segmentSm: { flexDirection: 'row', gap: 6 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weightInput: { width: 76 },
  unit: { fontSize: Type.body, fontWeight: '700' },
  dupCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  dupHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dupTitle: { fontSize: Type.bodyLg, fontWeight: '800' },
  dupBody: { fontSize: Type.footnote, lineHeight: 18 },
  dupItem: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11 },
  dupName: { fontSize: Type.body, fontWeight: '800' },
  dupAddr: { fontSize: Type.caption, marginTop: 2 },
  ackRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  ackText: { fontSize: Type.body, fontWeight: '700' },
  error: { fontSize: Type.footnote, lineHeight: 18, fontWeight: '600' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.full, paddingVertical: 15 },
  primaryBtnText: { fontSize: Type.callout, fontWeight: '800' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 12 },
  secondaryBtnText: { fontSize: Type.body, fontWeight: '700' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11 },
  doneRowText: { fontSize: Type.body, fontWeight: '800' },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
  doneIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: Type.headline, fontWeight: '900', letterSpacing: -0.5 },
  doneBody: { fontSize: Type.body, lineHeight: 21, textAlign: 'center' },
});
