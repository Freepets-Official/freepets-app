import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfidenceBadge } from '@/components/confidence-badge';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { FACILITIES, formatDistance } from '@/data/mock';
import {
  decisionVerdict,
  F6_DECISION,
  F6_REQUIREMENTS,
  selfCheck,
  type DecisionAnswers,
} from '@/data/restaurant';
import { CATEGORY_LABEL } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

type Step = 'pick' | 'decision' | 'checklist' | 'result' | 'done';
const STEP_ORDER: Step[] = ['pick', 'decision', 'checklist', 'result'];

/**
 * F6 반려동물 동반 음식점 등록 지원.
 * 2026-03 신고제 시행을 모르는 사업자에게 법을 알리고, 자가진단 → 요건 체크 →
 * 신고 안내 → 등록까지 도와 동반 가능 음식점을 앱이 스스로 만들어낸다.
 */
export default function RestaurantScreen() {
  const p = usePalette();
  const router = useRouter();
  const { businessRegOf, registerBusiness } = useAppStore();

  const [step, setStep] = useState<Step>('pick');
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const [decision, setDecision] = useState<Partial<DecisionAnswers>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const facility = FACILITIES.find((f) => f.facilityId === facilityId) ?? null;

  // 아직 동반 등록 안 된 음식점만 대상
  const candidates = useMemo(
    () => FACILITIES.filter((f) => f.category === 'RESTAURANT' && !businessRegOf(f.facilityId)),
    [businessRegOf],
  );

  const { eligible, missing } = selfCheck(checklist);
  const verdict = decisionVerdict(decision);
  const decisionDone = F6_DECISION.every((d) => decision[d.key] !== undefined);

  const stepIndex = STEP_ORDER.indexOf(step);

  const complete = () => {
    if (!facility) return;
    // 신고 완료 → F5와 동일하게 확정·사업자 확인으로 편입 (registerBusiness 재사용)
    registerBusiness({
      facilityId: facility.facilityId,
      bizNoMasked: '동반 음식점 신고',
      petAllowed: true,
      maxWeight: null,
      requirements: ['LEASH', 'VACCINATION'],
      conditionRaw:
        '반려동물 동반 영업장 · 개·고양이 동반 가능(예방접종 필수) · 목줄 착용 · 조리공간 출입 불가. 예방접종은 프리펫스 출입증으로 확인할 수 있어요.',
      confirmedAt: new Date().toISOString(),
    });
    setStep('done');
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '동반 음식점 등록' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {/* 진행 표시 (완료 화면 제외) */}
          {step !== 'done' && (
            <View style={styles.progress}>
              {STEP_ORDER.map((s, i) => (
                <View
                  key={s}
                  style={[
                    styles.progressDot,
                    { backgroundColor: i <= stepIndex ? p.accent : p.line, flex: i === 0 ? 0 : 1 },
                  ]}
                />
              ))}
            </View>
          )}

          {/* ── 헤드 ── */}
          {step === 'pick' && (
            <View style={styles.head}>
              <Text style={[styles.eyebrow, { color: p.accent }]}>사장님께 · 2026 신규 제도</Text>
              <Text style={[styles.title, { color: p.ink }]}>이제 우리 식당도{'\n'}반려동물을 받을 수 있어요</Text>
              <Text style={[styles.sub, { color: p.muted }]}>
                2026년 3월부터 음식점도 <Text style={{ fontWeight: '800', color: p.ink }}>신고만 하면</Text> 개·고양이 동반 출입을
                허용할 수 있어요. 아직 아는 사장님이 많지 않아요 — 우리 매장부터 시작해볼까요?
              </Text>
            </View>
          )}

          {/* ── STEP: 매장 선택 ── */}
          {step === 'pick' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.block}>
              <Text style={[styles.blockLabel, { color: p.ink }]}>어느 매장인가요?</Text>
              {candidates.length === 0 ? (
                <Text style={[styles.empty, { color: p.muted }]}>
                  등록할 음식점이 없어요. (데모: ‘초당순두부 본점’으로 시연할 수 있어요)
                </Text>
              ) : (
                candidates.map((f) => (
                  <Pressable
                    key={f.facilityId}
                    onPress={() => {
                      setFacilityId(f.facilityId);
                      setStep('decision');
                    }}
                    style={({ pressed }) => [
                      styles.pickRow,
                      CardShadow,
                      { backgroundColor: pressed ? p.accentSoft : p.card, borderColor: p.line },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickName, { color: p.ink }]}>{f.name}</Text>
                      <Text style={[styles.pickMeta, { color: p.muted }]}>
                        {CATEGORY_LABEL[f.category]} · {f.address}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={p.accent} />
                  </Pressable>
                ))
              )}
            </Animated.View>
          )}

          {/* ── STEP: 도입 자가진단 ── */}
          {step === 'decision' && facility && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.block}>
              <StepTitle p={p} n={1} label="받아도 될까요? 자가진단" facility={facility.name} />
              <Text style={[styles.hint, { color: p.muted }]}>
                무조건 등록을 권하지 않아요. 아래 세 가지를 솔직하게 골라 주세요.
              </Text>
              {F6_DECISION.map((d) => (
                <View key={d.key} style={[styles.qCard, { borderColor: p.line }]}>
                  <Text style={[styles.qText, { color: p.ink }]}>{d.q}</Text>
                  <Text style={[styles.qHint, { color: p.muted }]}>{d.hint}</Text>
                  <View style={styles.yn}>
                    {[
                      { v: true, label: '네' },
                      { v: false, label: '아니오' },
                    ].map((opt) => {
                      const on = decision[d.key] === opt.v;
                      return (
                        <Pressable
                          key={opt.label}
                          onPress={() => setDecision((prev) => ({ ...prev, [d.key]: opt.v }))}
                          style={[
                            styles.ynBtn,
                            { borderColor: on ? p.accent : p.line, backgroundColor: on ? p.accentSoft : 'transparent' },
                          ]}>
                          <Text style={[styles.ynText, { color: on ? p.accent : p.muted }]}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              {decisionDone && (
                <View
                  style={[
                    styles.verdictCard,
                    {
                      backgroundColor:
                        verdict.tone === 'go' ? p.successSoft : verdict.tone === 'hold' ? p.dangerSoft : p.warnSoft,
                      borderColor:
                        verdict.tone === 'go' ? p.success : verdict.tone === 'hold' ? p.danger : p.warn,
                    },
                  ]}>
                  <Ionicons
                    name={verdict.tone === 'go' ? 'thumbs-up' : verdict.tone === 'hold' ? 'hand-left' : 'alert-circle'}
                    size={17}
                    color={verdict.tone === 'go' ? p.success : verdict.tone === 'hold' ? p.danger : p.warn}
                  />
                  <Text style={[styles.verdictText, { color: p.ink }]}>{verdict.message}</Text>
                </View>
              )}

              <PrimaryBtn
                p={p}
                label="다음 · 요건 확인하기"
                disabled={!decisionDone}
                onPress={() => setStep('checklist')}
              />
            </Animated.View>
          )}

          {/* ── STEP: 요건 체크리스트 ── */}
          {step === 'checklist' && facility && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.block}>
              <StepTitle p={p} n={2} label="시설 요건 체크리스트" facility={facility.name} />
              <Text style={[styles.hint, { color: p.muted }]}>
                2026 개정·완화 기준이에요. 갖춘 항목을 눌러 주세요. (필수 전부 충족 시 신고 가능)
              </Text>
              {F6_REQUIREMENTS.map((r) => {
                const on = !!checklist[r.key];
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setChecklist((prev) => ({ ...prev, [r.key]: !prev[r.key] }))}
                    style={[styles.reqRow, { borderColor: on ? p.accent : p.line, backgroundColor: on ? p.accentSoft : p.card }]}>
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={on ? p.accent : p.muted}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.reqTop}>
                        <Text style={[styles.reqLabel, { color: p.ink }]}>{r.label}</Text>
                        <View
                          style={[
                            styles.reqTag,
                            { backgroundColor: r.mandatory ? p.dangerSoft : p.surface },
                          ]}>
                          <Text style={[styles.reqTagText, { color: r.mandatory ? p.danger : p.muted }]}>
                            {r.mandatory ? '필수' : '권장'}
                          </Text>
                        </View>
                      </View>
                      {r.help ? <Text style={[styles.reqHelp, { color: p.muted }]}>{r.help}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}

              <View style={[styles.countBar, { backgroundColor: eligible ? p.successSoft : p.surface }]}>
                <Ionicons
                  name={eligible ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={eligible ? p.success : p.muted}
                />
                <Text style={[styles.countText, { color: eligible ? p.success : p.muted }]}>
                  {eligible ? '필수 요건을 모두 갖췄어요' : `필수 ${missing.length}개 남음`}
                </Text>
              </View>

              <PrimaryBtn p={p} label="판정 보기" onPress={() => setStep('result')} />
            </Animated.View>
          )}

          {/* ── STEP: 판정 · 신고 안내 ── */}
          {step === 'result' && facility && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.block}>
              <StepTitle p={p} n={3} label={eligible ? '신고할 수 있어요' : '조금만 더 갖추면 돼요'} facility={facility.name} />

              {!eligible ? (
                <>
                  <View style={[styles.noticeCard, { backgroundColor: p.warnSoft, borderColor: p.warn }]}>
                    <Text style={[styles.noticeTitle, { color: p.warn }]}>아직 필수 요건이 부족해요</Text>
                    {missing.map((m) => (
                      <View key={m.key} style={styles.missingRow}>
                        <Ionicons name="ellipse" size={5} color={p.warn} />
                        <Text style={[styles.missingText, { color: p.ink }]}>
                          {m.label}
                          {m.help ? ` — ${m.help}` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <PrimaryBtn p={p} label="체크리스트로 돌아가기" onPress={() => setStep('checklist')} />
                </>
              ) : (
                <>
                  <View style={[styles.noticeCard, { backgroundColor: p.successSoft, borderColor: p.success }]}>
                    <Text style={[styles.noticeTitle, { color: p.success }]}>신고 준비가 됐어요</Text>
                    <Text style={[styles.noticeBody, { color: p.ink }]}>
                      아래 순서로 <Text style={{ fontWeight: '800' }}>새올시스템</Text>에서 직접 신고하시면 돼요. 프리펫스는
                      안내와 서류 준비만 도와드려요.
                    </Text>
                    <View style={styles.stepList}>
                      <GuideStep p={p} n={1} text="새올시스템 → 영업 정보 → ‘반려동물 동반 여부’ 등록" />
                      <GuideStep p={p} n={2} text="(선택) 관할 구청에 사전검토 신청서·체크리스트 제출" />
                      <GuideStep p={p} n={3} text="신고 후 1개월 내 시설조사 → 완료" />
                    </View>
                  </View>

                  <Pressable
                    onPress={() => Linking.openURL('https://www.egov.go.kr')}
                    style={({ pressed }) => [
                      styles.linkBtn,
                      { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' },
                    ]}>
                    <Ionicons name="document-text" size={16} color={p.accent} />
                    <Text style={[styles.linkText, { color: p.accent }]}>사전검토 체크리스트 문서 만들기</Text>
                  </Pressable>

                  <Text style={[styles.disclaimer, { color: p.muted }]}>
                    ※ 요건·신고 방법은 지자체별로 다를 수 있어요. 최종 기준과 신고는 관할 구청에서 확인하세요.
                  </Text>

                  <PrimaryBtn p={p} label="신고를 마쳤어요 · 우리 식당 등록" onPress={complete} />
                </>
              )}
            </Animated.View>
          )}

          {/* ── 완료 ── */}
          {step === 'done' && facility && (
            <View style={styles.doneWrap}>
              <View style={[styles.doneIcon, { backgroundColor: p.successSoft }]}>
                <Ionicons name="restaurant" size={32} color={p.success} />
              </View>
              <Text style={[styles.doneTitle, { color: p.ink }]}>동반 음식점이 됐어요</Text>
              <Text style={[styles.doneBody, { color: p.muted }]}>
                {facility.name}이(가) 프리펫스에 <Text style={{ fontWeight: '800', color: p.success }}>반려동물 동반 가능</Text>{' '}
                음식점으로 등록됐어요. 손님은 앱에서 <Text style={{ fontWeight: '800', color: p.ink }}>확정 정보</Text>로 보게 되고,
                예방접종은 손님의 <Text style={{ fontWeight: '800', color: p.ink }}>동반 출입증</Text>으로 확인할 수 있어요.
              </Text>

              <View style={[styles.doneCard, CardShadow, { backgroundColor: p.card, borderColor: p.success }]}>
                <View style={styles.doneCardHead}>
                  <ConfidenceBadge confidence="CONFIRMED" />
                  <Text style={[styles.doneCardSource, { color: p.muted }]}>사업자 확인 · 동반 음식점 신고</Text>
                </View>
                <Text style={[styles.doneCondition, { color: p.ink }]}>
                  개·고양이 동반 가능(예방접종 필수) · 목줄 착용 · 조리공간 출입 불가
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  router.replace({ pathname: '/facility/[id]', params: { id: String(facility.facilityId) } })
                }
                style={({ pressed }) => [styles.doneBtn, { backgroundColor: pressed ? p.accentDark : p.accent }]}>
                <Text style={[styles.doneBtnText, { color: p.onAccent }]}>우리 식당 화면 보기</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StepTitle({ p, n, label, facility }: { p: any; n: number; label: string; facility: string }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.stepTitleRow}>
        <View style={[styles.stepNum, { backgroundColor: p.accent }]}>
          <Text style={styles.stepNumText}>{n}</Text>
        </View>
        <Text style={[styles.stepTitleText, { color: p.ink }]}>{label}</Text>
      </View>
      <Text style={[styles.stepFacility, { color: p.muted }]}>{facility}</Text>
    </View>
  );
}

function GuideStep({ p, n, text }: { p: any; n: number; text: string }) {
  return (
    <View style={styles.guideStep}>
      <View style={[styles.guideNum, { borderColor: p.success }]}>
        <Text style={[styles.guideNumText, { color: p.success }]}>{n}</Text>
      </View>
      <Text style={[styles.guideText, { color: p.ink }]}>{text}</Text>
    </View>
  );
}

function PrimaryBtn({
  p,
  label,
  onPress,
  disabled,
}: {
  p: any;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        { backgroundColor: disabled ? p.line : pressed ? p.accentDark : p.accent },
      ]}>
      <Text style={[styles.primaryBtnText, { color: disabled ? p.muted : p.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 64, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.lg, paddingTop: Spacing.sm },
  progress: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  progressDot: { height: 4, borderRadius: Radius.full, minWidth: 20 },
  head: { gap: 4 },
  eyebrow: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  title: { fontSize: 25, fontWeight: '900', letterSpacing: -1, lineHeight: 33 },
  sub: { fontSize: 13.5, lineHeight: 21, marginTop: 4 },
  block: { gap: Spacing.md },
  blockLabel: { fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 19 },
  empty: { fontSize: 13.5, paddingVertical: Spacing.lg, textAlign: 'center' },

  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  pickName: { fontSize: 15.5, fontWeight: '800' },
  pickMeta: { fontSize: 12, marginTop: 2 },

  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepNum: { width: 22, height: 22, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  stepTitleText: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  stepFacility: { fontSize: 12.5, marginLeft: 30 },

  qCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: 6 },
  qText: { fontSize: 14.5, fontWeight: '700', lineHeight: 20 },
  qHint: { fontSize: 12, lineHeight: 17 },
  yn: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  ynBtn: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: Radius.full, paddingVertical: 10 },
  ynText: { fontSize: 14, fontWeight: '800' },

  verdictCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  verdictText: { fontSize: 13, lineHeight: 19, flex: 1 },

  reqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  reqTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reqLabel: { fontSize: 14.5, fontWeight: '800', flexShrink: 1 },
  reqTag: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  reqTagText: { fontSize: 10.5, fontWeight: '800' },
  reqHelp: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  countBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  countText: { fontSize: 13.5, fontWeight: '800' },

  noticeCard: { borderWidth: 1.5, borderRadius: Radius.lg, padding: Spacing.lg, gap: 8 },
  noticeTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.3 },
  noticeBody: { fontSize: 13, lineHeight: 20 },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  missingText: { fontSize: 13, lineHeight: 19, flexShrink: 1 },
  stepList: { gap: 8, marginTop: 4 },
  guideStep: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  guideNum: { width: 20, height: 20, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  guideNumText: { fontSize: 11, fontWeight: '900' },
  guideText: { fontSize: 13, lineHeight: 19, flexShrink: 1 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 13,
  },
  linkText: { fontSize: 13.5, fontWeight: '800' },
  disclaimer: { fontSize: 11.5, lineHeight: 17 },

  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    paddingVertical: 15,
    marginTop: 2,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800' },

  doneWrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  doneIcon: { width: 74, height: 74, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  doneBody: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  doneCard: { width: '100%', borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.xl, gap: 8, marginTop: 4 },
  doneCardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  doneCardSource: { fontSize: 12.5, fontWeight: '600' },
  doneCondition: { fontSize: 14, lineHeight: 21 },
  doneBtn: { width: '100%', alignItems: 'center', borderRadius: Radius.full, paddingVertical: 16, marginTop: 4 },
  doneBtnText: { fontSize: 15.5, fontWeight: '800' },
});
