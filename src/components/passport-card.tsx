import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ConfidenceBadge } from '@/components/confidence-badge';
import { PetAvatar } from '@/components/pet-avatar';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import {
  buildRuleRows,
  formatIssuedAt,
  passIssueCode,
  passVerifyUrl,
  type RuleStatus,
} from '@/data/passport';
import {
  BREED_SIZE_LABEL,
  CONFIDENCE_SOURCE_LABEL,
  RESULT_LABEL,
  freshnessText,
  type Confidence,
  type ConfidenceSource,
  type Facility,
  type Pet,
  type PetVerdictResult,
} from '@/data/types';
import { usePalette } from '@/hooks/use-theme';

interface Props {
  pet: Pet;
  facility: Facility;
  verdict: PetVerdictResult;
  checkId: number;
  issuedAt: string;
  confidence: Confidence;
  confidenceSource: ConfidenceSource;
  confirmedAt: string | null;
  width: number;
}

/**
 * 한 마리분 동반 출입증.
 *
 * 문 앞에서 직원에게 보여주는 화면이므로 (1) 결론이 3초 안에 읽히고,
 * (2) 시설이 게시한 조건과 아이 정보를 나란히 대조할 수 있어야 한다.
 */
export function PassportCard({
  pet,
  facility,
  verdict,
  checkId,
  issuedAt,
  confidence,
  confidenceSource,
  confirmedAt,
  width,
}: Props) {
  const p = usePalette();
  const rows = buildRuleRows(pet, facility);
  const fresh = freshnessText(confirmedAt);

  const tone = {
    ALLOWED: { color: p.success, soft: p.successSoft, icon: 'checkmark-circle' as const },
    CONDITIONAL: { color: p.warn, soft: p.warnSoft, icon: 'alert-circle' as const },
    DENIED: { color: p.danger, soft: p.dangerSoft, icon: 'close-circle' as const },
  }[verdict.result];

  const headline = {
    ALLOWED: '동반 입장 가능합니다',
    CONDITIONAL: '조건을 확인해 주세요',
    DENIED: '동반 입장이 어렵습니다',
  }[verdict.result];

  return (
    <View style={[styles.page, { width }]}>
      <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.accent }]}>
        {/* 발급처 — 위조가 아니라 특정 서비스가 발급한 증명이라는 표시 */}
        <View style={[styles.brandBar, { borderBottomColor: p.line }]}>
          <View style={styles.brand}>
            <Ionicons name="paw" size={13} color={p.accent} />
            <Text style={[styles.brandText, { color: p.accent }]}>프리펫스 동반 출입증</Text>
          </View>
          <Text style={[styles.code, { color: p.muted }]}>{passIssueCode(checkId, pet.petId)}</Text>
        </View>

        {/* 결론 — 가장 먼저 읽혀야 하는 부분 */}
        <View style={[styles.verdict, { backgroundColor: tone.soft }]}>
          <Ionicons name={tone.icon} size={26} color={tone.color} />
          <View style={styles.verdictText}>
            <Text style={[styles.headline, { color: tone.color }]}>{headline}</Text>
            <Text style={[styles.facilityName, { color: p.ink }]} numberOfLines={1}>
              {facility.name}
            </Text>
          </View>
          <View style={[styles.resultChip, { backgroundColor: tone.color }]}>
            <Text style={styles.resultChipText}>{RESULT_LABEL[verdict.result]}</Text>
          </View>
        </View>

        {/* 이 아이가 누구인가 */}
        <View style={styles.petRow}>
          <View style={[styles.avatarRing, { borderColor: p.accentSoft }]}>
            <PetAvatar pet={pet} size={52} />
          </View>
          <View style={styles.petInfo}>
            <Text style={[styles.petName, { color: p.ink }]}>{pet.name}</Text>
            <Text style={[styles.petMeta, { color: p.muted }]}>
              {pet.species} · {pet.weight}kg · {BREED_SIZE_LABEL[pet.breedSize]}견
            </Text>
            <View style={styles.petBadges}>
              <View
                style={[
                  styles.miniBadge,
                  { backgroundColor: pet.vaccinated ? p.successSoft : p.warnSoft },
                ]}>
                <Text
                  style={[
                    styles.miniBadgeText,
                    { color: pet.vaccinated ? p.success : p.warn },
                  ]}>
                  {pet.vaccinated
                    ? `접종 완료${pet.vaccinationDate ? ` · ${pet.vaccinationDate}` : ''}`
                    : '접종 미완료'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 대조표 — 이 화면의 핵심 */}
        {rows.length > 0 && (
          <View style={[styles.table, { borderColor: p.line }]}>
            <View style={[styles.tableHead, { backgroundColor: p.surface, borderBottomColor: p.line }]}>
              <Text style={[styles.th, styles.colLabel, { color: p.muted }]}>항목</Text>
              <Text style={[styles.th, styles.colRule, { color: p.muted }]}>시설 조건</Text>
              <Text style={[styles.th, styles.colMine, { color: p.muted }]}>{pet.name}</Text>
              <View style={styles.colMark} />
            </View>
            {rows.map((row, i) => (
              <View
                key={`${row.label}-${i}`}
                style={[styles.tr, i > 0 && { borderTopWidth: 1, borderTopColor: p.line }]}>
                <Text style={[styles.tdLabel, styles.colLabel, { color: p.muted }]}>{row.label}</Text>
                <Text style={[styles.td, styles.colRule, { color: p.ink }]}>{row.rule}</Text>
                <Text style={[styles.td, styles.colMine, { color: p.ink }]}>{row.mine}</Text>
                <View style={styles.colMark}>
                  <StatusMark status={row.status} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 시설이 게시한 원문 — 직원이 "우리가 쓴 문장"이라고 알아볼 수 있게 그대로 */}
        {facility.petConditionRaw && (
          <View style={[styles.raw, { backgroundColor: p.surface, borderColor: p.line }]}>
            <Text style={[styles.rawLabel, { color: p.muted }]}>시설 게시 조건 원문</Text>
            <Text style={[styles.rawText, { color: p.ink }]}>{facility.petConditionRaw}</Text>
            <Text style={[styles.rawSource, { color: p.muted }]}>
              출처 · 한국관광공사 반려동물 동반여행 데이터
              {fresh ? ` · ${fresh}` : ''}
            </Text>
          </View>
        )}

        {/* 신뢰도 — 이 정보를 얼마나 믿어도 되는지 직원에게도 알린다 */}
        <View style={styles.confRow}>
          <ConfidenceBadge confidence={confidence} size="sm" />
          <Text style={[styles.confText, { color: p.muted }]} numberOfLines={1}>
            {CONFIDENCE_SOURCE_LABEL[confidenceSource]}
          </Text>
        </View>

        {/* QR — 직원이 스캔해 판별 근거를 직접 확인 */}
        <View style={[styles.qrRow, { borderTopColor: p.line }]}>
          <View style={[styles.qrBox, { borderColor: p.line }]}>
            <QRCode
              value={passVerifyUrl(checkId, pet.petId)}
              size={72}
              color={p.ink}
              backgroundColor="#FFFFFF"
            />
          </View>
          <View style={styles.qrText}>
            <Text style={[styles.qrTitle, { color: p.ink }]}>스캔하면 판별 근거를 볼 수 있어요</Text>
            <Text style={[styles.qrBody, { color: p.muted }]}>
              시설 게시 조건과 판별 과정을 웹에서 확인할 수 있습니다.
            </Text>
            <Text style={[styles.issued, { color: p.muted }]}>{formatIssuedAt(issuedAt)}</Text>
          </View>
        </View>
      </View>

      {/* 판별 사유 — 직원이 아니라 방문자가 읽는 부분이라 카드 밖에 */}
      <Text style={[styles.reason, { color: p.muted }]}>{verdict.reason}</Text>
    </View>
  );
}

function StatusMark({ status }: { status: RuleStatus }) {
  const p = usePalette();
  if (status === 'MET') return <Ionicons name="checkmark-circle" size={17} color={p.success} />;
  if (status === 'UNMET') return <Ionicons name="close-circle" size={17} color={p.danger} />;
  return <Ionicons name="ellipse-outline" size={15} color={p.muted} />;
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 2,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingBottom: Spacing.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  brandText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  code: { fontSize: 11.5, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 0.5 },

  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  verdictText: { flex: 1, gap: 1 },
  headline: { fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  facilityName: { fontSize: 13, fontWeight: '700' },
  resultChip: { borderRadius: Radius.full, paddingHorizontal: 11, paddingVertical: 5 },
  resultChipText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },

  petRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarRing: { borderRadius: Radius.full, borderWidth: 3, padding: 2 },
  petInfo: { flex: 1, gap: 2 },
  petName: { fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  petMeta: { fontSize: 12.5 },
  petBadges: { flexDirection: 'row', gap: 5, marginTop: 3 },
  miniBadge: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  miniBadgeText: { fontSize: 11, fontWeight: '800' },

  table: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  tableHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1 },
  th: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.2 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  td: { fontSize: 12.5, fontWeight: '600' },
  tdLabel: { fontSize: 11.5, fontWeight: '700' },
  colLabel: { flex: 1.1, paddingLeft: Spacing.md },
  colRule: { flex: 1.5 },
  colMine: { flex: 1.4 },
  colMark: { width: 34, alignItems: 'center' },

  raw: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: 5 },
  rawLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  rawText: { fontSize: 12.5, lineHeight: 19 },
  rawSource: { fontSize: 10.5 },

  confRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  confText: { fontSize: 11.5, fontWeight: '600', flexShrink: 1 },

  qrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderTopWidth: 1,
    paddingTop: Spacing.md,
  },
  qrBox: { borderWidth: 1, borderRadius: Radius.sm, padding: 6, backgroundColor: '#FFFFFF' },
  qrText: { flex: 1, gap: 2 },
  qrTitle: { fontSize: 12.5, fontWeight: '800' },
  qrBody: { fontSize: 11, lineHeight: 16 },
  issued: { fontSize: 10.5, marginTop: 3, fontVariant: ['tabular-nums'] },

  reason: { fontSize: 12.5, lineHeight: 19, paddingHorizontal: Spacing.xs },
});
