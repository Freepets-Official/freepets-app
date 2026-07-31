import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PetAllowedBadge, ResultBadge } from '@/components/badge';
import { ConfidenceBadge } from '@/components/confidence-badge';
import { ConfidencePanel } from '@/components/confidence-panel';
import { DenialAlert } from '@/components/denial-alert';
import { DenialReport } from '@/components/denial-report';
import { FacilityCard } from '@/components/facility-card';
import { OwnerPromotionSection } from '@/components/owner-promotion-section';
import { PawBadge } from '@/components/paw-badge';
import { ReviewSection } from '@/components/review-section';
import { SatisfactionSection } from '@/components/satisfaction-section';
import { Screen } from '@/components/screen';
import { SectionTitle } from '@/components/section-title';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { FACILITIES, formatDistance } from '@/data/mock';
import { CATEGORY_LABEL, pawGradeOf, type PetCheck } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

export default function FacilityDetailScreen() {
  const p = usePalette();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pets, runCheck, reviewsOf, canReview, confidenceOf, effectiveFacility } = useAppStore();

  const base = FACILITIES.find((f) => f.facilityId === Number(id));
  // 사업자가 확정한 조건이 있으면 그 값으로 표시한다 (판별은 runCheck가 내부에서 같은 override를 적용) (F5)
  const facility = base ? effectiveFacility(base) : undefined;

  // 기본은 등록된 모든 아이 선택 — 다 함께 갈 수 있는지 한 번에 확인
  const [selectedIds, setSelectedIds] = useState<number[]>(pets.map((p) => p.petId));
  const [loading, setLoading] = useState(false);
  const [check, setCheck] = useState<PetCheck | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const alternatives = useMemo(() => {
    if (!facility) return [];
    return FACILITIES.filter(
      (f) =>
        f.facilityId !== facility.facilityId &&
        f.category === facility.category &&
        f.petAllowed === true,
    )
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 3);
  }, [facility]);

  if (!facility) {
    return (
      <Screen>
        <Text style={{ color: p.muted, textAlign: 'center', paddingVertical: 48 }}>
          시설을 찾을 수 없어요.
        </Text>
      </Screen>
    );
  }

  const togglePet = (petId: number) => {
    setSelectedIds((prev) =>
      prev.includes(petId) ? prev.filter((x) => x !== petId) : [...prev, petId],
    );
  };

  const startCheck = () => {
    if (selectedIds.length === 0 || loading) return;
    setLoading(true);
    setCheck(null);
    // 데모: 백엔드 B(Claude AI) 호출을 흉내 내는 지연. 실제 연동 시 POST /api/v1/ai/check 로 대체.
    setTimeout(() => {
      setCheck(runCheck(facility.facilityId, selectedIds));
      setDone(new Set());
      setLoading(false);
    }, 900);
  };

  const toggleDone = (item: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  // 그룹 전체 결과에 대한 배너 톤·문구
  const petName = (petId: number) => pets.find((x) => x.petId === petId)?.name ?? '';
  const deniedNames = check
    ? check.verdicts.filter((v) => v.result === 'DENIED').map((v) => petName(v.petId))
    : [];
  const overallTitle = check
    ? check.overall === 'ALLOWED'
      ? check.petIds.length > 1
        ? '다 함께 갈 수 있어요'
        : '입장 가능해요'
      : check.overall === 'CONDITIONAL'
        ? '조건부로 갈 수 있어요'
        : deniedNames.length === check.verdicts.length
          ? '입장이 어려워요'
          : `${deniedNames.join('·')}는 함께 갈 수 없어요`
    : '';
  const tone =
    check &&
    {
      ALLOWED: { color: p.success, soft: p.successSoft },
      CONDITIONAL: { color: p.warn, soft: p.warnSoft },
      DENIED: { color: p.danger, soft: p.dangerSoft },
    }[check.overall];

  // 결과 × 신뢰도 조합 메시지 (판별 결과가 얼마나 믿을 만한지)
  const facilityConfidence = facility ? confidenceOf(facility).confidence : 'UNVERIFIED';
  const confidenceMessage =
    facilityConfidence === 'CONFIRMED'
      ? '최근 확인된 정보라 안심해도 돼요'
      : facilityConfidence === 'LIKELY'
        ? '원문 기준 · 현장에서 바뀌었을 수 있어요'
        : facilityConfidence === 'ESTIMATED'
          ? '추정 정보 · 방문 전 확인을 권장해요'
          : '정보가 없어요 · 꼭 전화로 확인하세요';

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.category, { color: p.accent }]}>
            {CATEGORY_LABEL[facility.category]}
          </Text>
          <PetAllowedBadge allowed={facility.petAllowed} />
        </View>
        <Text style={[styles.name, { color: p.ink }]}>{facility.name}</Text>
        <View style={styles.pawRow}>
          <PawBadge grade={pawGradeOf(reviewsOf(facility.facilityId))} />
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location" size={14} color={p.muted} />
          <Text style={[styles.meta, { color: p.muted }]}>
            {facility.address} · {formatDistance(facility.distanceM)}
          </Text>
        </View>
        {facility.phone && (
          <View style={styles.metaRow}>
            <Ionicons name="call" size={14} color={p.muted} />
            <Text style={[styles.meta, { color: p.muted }]}>{facility.phone}</Text>
          </View>
        )}
      </View>

      {/* 누군가 방금 여기서 거부당했다면 판별 결과보다 먼저 눈에 들어와야 한다 */}
      <DenialAlert facilityId={facility.facilityId} />

      <View style={[styles.rawCard, { backgroundColor: p.surface, borderColor: p.line }]}>
        <View style={styles.rawHead}>
          <Text style={[styles.rawLabel, { color: p.muted }]}>출입 조건 원문</Text>
          <ConfidenceBadge confidence={confidenceOf(facility).confidence} size="sm" />
        </View>
        <Text style={[styles.rawText, { color: p.ink }]}>
          {facility.petConditionRaw ?? '등록된 출입 조건 정보가 없어요. 방문 전 시설에 확인해 주세요.'}
        </Text>
        <Text style={[styles.rawSource, { color: p.muted }]}>
          출처 · 한국관광공사 반려동물 동반여행 데이터
        </Text>
      </View>

      <ConfidencePanel facility={facility} />

      <SectionTitle title="AI 출입 판별" caption={pets.length > 1 ? '데려갈 아이를 골라요' : undefined} />

      {pets.length === 0 ? (
        <Text style={[styles.meta, { color: p.muted }]}>
          내 반려동물 탭에서 반려동물을 먼저 등록해 주세요.
        </Text>
      ) : (
        <>
          <View style={styles.petRow}>
            {pets.map((pet) => {
              const on = selectedIds.includes(pet.petId);
              return (
                <Pressable
                  key={pet.petId}
                  onPress={() => togglePet(pet.petId)}
                  style={[
                    styles.petChip,
                    { backgroundColor: on ? p.accentSoft : p.surface, borderColor: on ? p.accent : p.line },
                  ]}>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={on ? p.accent : p.muted}
                  />
                  <Text style={[styles.petChipText, { color: on ? p.accent : p.muted }]}>
                    {pet.name} · {pet.weight}kg
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={startCheck}
            disabled={loading || selectedIds.length === 0}
            style={({ pressed }) => [
              styles.checkButton,
              {
                backgroundColor:
                  selectedIds.length === 0 ? p.line : pressed || loading ? p.accentDark : p.accent,
              },
            ]}>
            {loading ? (
              <>
                <ActivityIndicator color={p.onAccent} size="small" />
                <Text style={[styles.checkLabel, { color: p.onAccent }]}>
                  AI가 출입 조건을 분석하고 있어요…
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={17} color={p.onAccent} />
                <Text style={[styles.checkLabel, { color: p.onAccent }]}>
                  {selectedIds.length > 1 ? `${selectedIds.length}마리 함께 판별하기` : 'AI 출입 판별하기'}
                </Text>
              </>
            )}
          </Pressable>
        </>
      )}

      {check && tone && (
        <>
          <Animated.View
            entering={FadeInDown.duration(320)}
            style={[styles.resultCard, { backgroundColor: tone.soft, borderColor: tone.color }]}>
            <View style={styles.resultTop}>
              <Text style={[styles.resultTitle, { color: tone.color }]}>{overallTitle}</Text>
              <ResultBadge result={check.overall} />
            </View>

            {/* 결과 × 신뢰도 — 결과가 얼마나 믿을 만한지 함께 안내 */}
            <View style={styles.confLine}>
              <ConfidenceBadge confidence={confidenceOf(facility).confidence} size="sm" />
              <Text style={[styles.confLineText, { color: p.muted }]}>{confidenceMessage}</Text>
            </View>

            {/* 아이별 결과 — 한 마리 한 마리 따로 보여준다 */}
            <View style={styles.verdictList}>
              {check.verdicts.map((v) => {
                const vTone = {
                  ALLOWED: { color: p.success, icon: 'checkmark-circle' as const },
                  CONDITIONAL: { color: p.warn, icon: 'alert-circle' as const },
                  DENIED: { color: p.danger, icon: 'close-circle' as const },
                }[v.result];
                return (
                  <View key={v.petId} style={[styles.verdictRow, { borderColor: p.line }]}>
                    <View style={styles.verdictHead}>
                      <View style={styles.verdictName}>
                        <Ionicons name={vTone.icon} size={17} color={vTone.color} />
                        <Text style={[styles.verdictPet, { color: p.ink }]}>{petName(v.petId)}</Text>
                      </View>
                      <ResultBadge result={v.result} />
                    </View>
                    <Text style={[styles.verdictReason, { color: p.muted }]}>{v.reason}</Text>
                    {v.conditions.map((c) => (
                      <View key={c} style={styles.conditionRow}>
                        <Ionicons name="ellipse" size={5} color={vTone.color} />
                        <Text style={[styles.conditionItem, { color: p.ink }]}>{c}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {check.checklist.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(320).delay(90)}
              style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
              <Text style={[styles.cardTitle, { color: p.ink }]}>방문 전 체크리스트</Text>
              {check.checklist.map((item) => {
                const isDone = done.has(item);
                return (
                  <Pressable
                    key={item}
                    onPress={() => toggleDone(item)}
                    style={({ pressed }) => [styles.checkItem, { opacity: pressed ? 0.6 : 1 }]}>
                    <Ionicons
                      name={isDone ? 'checkbox' : 'square-outline'}
                      size={21}
                      color={isDone ? p.success : p.muted}
                    />
                    <Text
                      style={[
                        styles.checkItemLabel,
                        { color: isDone ? p.muted : p.ink },
                        isDone && styles.checkItemDone,
                      ]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
              {check.tips.map((tip) => (
                <View key={tip} style={[styles.tip, { backgroundColor: p.accentSoft }]}>
                  <Ionicons name="bulb" size={14} color={p.accent} />
                  <Text style={[styles.tipText, { color: p.ink }]}>{tip}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* 동반 출입증 — 문 앞에서 직원에게 보여줄 화면. 불가 판정이면 보여줄 이유가 없다 */}
          {check.overall !== 'DENIED' && (
            <Animated.View entering={FadeInDown.duration(320).delay(140)}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/passport/[id]',
                    params: { id: String(facility.facilityId) },
                  })
                }
                style={({ pressed }) => [
                  styles.passButton,
                  { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : p.card },
                ]}>
                <View style={[styles.passIcon, { backgroundColor: p.accentSoft }]}>
                  <Ionicons name="qr-code" size={19} color={p.accent} />
                </View>
                <View style={styles.passText}>
                  <Text style={[styles.passTitle, { color: p.ink }]}>동반 출입증 보기</Text>
                  <Text style={[styles.passBody, { color: p.muted }]}>
                    문 앞에서 직원에게 보여주면 조건 대조가 끝나요
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={p.accent} />
              </Pressable>
            </Animated.View>
          )}

          {check.overall === 'DENIED' && alternatives.length > 0 && (
            <Animated.View entering={FadeInDown.duration(320).delay(180)} style={styles.altWrap}>
              <SectionTitle title="대신 여기는 어때요?" caption="같은 카테고리 · 동반 가능" />
              <View style={styles.altList}>
                {alternatives.map((f) => (
                  <FacilityCard key={f.facilityId} facility={f} />
                ))}
              </View>
            </Animated.View>
          )}

          {/* 현장에서 막 거부당한 사람을 위한 원터치 경로 — 서술형 제보보다 위에 둔다 */}
          <DenialReport facilityId={facility.facilityId} />

          <Pressable
            onPress={() =>
              router.push({ pathname: '/report/[id]', params: { id: String(facility.facilityId) } })
            }
            style={({ pressed }) => [
              styles.reportLink,
              { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
            ]}>
            <Ionicons name="flag" size={14} color={p.muted} />
            <Text style={[styles.reportText, { color: p.muted }]}>
              AI 판별이 실제와 달랐나요? 제보하기
            </Text>
          </Pressable>
        </>
      )}

      <OwnerPromotionSection facilityId={facility.facilityId} />

      <SatisfactionSection facilityId={facility.facilityId} />

      <ReviewSection
        reviews={reviewsOf(facility.facilityId)}
        canWrite={canReview(facility.facilityId)}
        onWrite={() => {
          if (!canReview(facility.facilityId)) return;
          router.push({ pathname: '/review/[id]', params: { id: String(facility.facilityId) } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, paddingTop: Spacing.sm },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  category: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  name: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  pawRow: { marginBottom: 8 },
  passButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  passIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passText: { flex: 1, gap: 2 },
  passTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  passBody: { fontSize: 12, lineHeight: 17 },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 12,
  },
  reportText: { fontSize: 13, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 13, flexShrink: 1 },
  rawCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, gap: 7 },
  rawHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rawLabel: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  confLine: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  confLineText: { fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  rawText: { fontSize: 14.5, lineHeight: 22 },
  rawSource: { fontSize: 11.5 },
  petRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  petChipText: { fontSize: 13.5, fontWeight: '700' },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.full,
    paddingVertical: 16,
  },
  checkLabel: { fontSize: 15.5, fontWeight: '800' },
  resultCard: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.xl, gap: Spacing.md },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  resultTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.5, flexShrink: 1 },
  verdictList: { gap: Spacing.sm },
  verdictRow: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    gap: 5,
  },
  verdictHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  verdictName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verdictPet: { fontSize: 15, fontWeight: '800' },
  verdictReason: { fontSize: 13, lineHeight: 19 },
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  conditionItem: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, gap: Spacing.md },
  cardTitle: { fontSize: 16.5, fontWeight: '800', letterSpacing: -0.4 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  checkItemLabel: { fontSize: 14.5, flexShrink: 1 },
  checkItemDone: { textDecorationLine: 'line-through' },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  tipText: { fontSize: 13, flexShrink: 1, lineHeight: 20 },
  altWrap: { gap: Spacing.lg },
  altList: { gap: Spacing.md },
});
