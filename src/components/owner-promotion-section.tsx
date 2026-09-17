import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { SectionTitle } from '@/components/section-title';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { OWNER_AMENITY_LABEL, type Facility } from '@/data/types';

/**
 * 방문자 시설 상세 "사장님이 전하는 우리 매장" (docs/10) —
 * 소유 사업자가 대시보드에서 등록한 소개·편의시설·방문 혜택을 손님에게 노출한다.
 * 상세 응답(`ownerProfile`·`benefits`)이 비어 있으면 아무것도 그리지 않는다 — 서버가 아직
 * 이 필드를 안 주는 동안은 섹션 자체가 없다.
 */
export function OwnerPromotionSection({ facility }: { facility: Facility }) {
  const p = usePalette();
  const promo = facility.ownerProfile ?? null;
  const benefits = facility.benefits ?? [];

  const hasPromo = !!promo && (!!promo.introduction || promo.amenityTags.length > 0);
  if (!hasPromo && benefits.length === 0) return null;

  return (
    <>
      <SectionTitle title="사장님이 전하는 우리 매장" caption="사업자 확인" />
      <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
        {/* 소개글 */}
        {promo?.introduction ? (
          <Text style={[styles.intro, { color: p.ink }]}>{promo.introduction}</Text>
        ) : null}

        {/* 편의시설 */}
        {promo && promo.amenityTags.length > 0 && (
          <View style={styles.amenities}>
            {promo.amenityTags.map((a) => (
              <View key={a} style={[styles.amenity, { backgroundColor: p.surface, borderColor: p.line }]}>
                <Ionicons name="checkmark-circle" size={13} color={p.accent} />
                <Text style={[styles.amenityText, { color: p.ink }]}>{OWNER_AMENITY_LABEL[a]}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 방문 혜택 */}
        {benefits.length > 0 && (
          <View style={[styles.benefitBox, { borderColor: p.accent, backgroundColor: p.accentSoft }]}>
            <View style={styles.benefitHead}>
              <Ionicons name="pricetag" size={14} color={p.accent} />
              <Text style={[styles.benefitHeadText, { color: p.accent }]}>방문 혜택</Text>
            </View>
            {benefits.map((b) => (
              <View key={b.benefitId} style={styles.benefitRow}>
                <Text style={[styles.benefitTitle, { color: p.ink }]}>{b.title}</Text>
                {b.description ? (
                  <Text style={[styles.benefitDetail, { color: p.muted }]}>{b.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  intro: { fontSize: 14, lineHeight: 21 },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  amenity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  amenityText: { fontSize: 12.5, fontWeight: '700' },
  benefitBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: 8 },
  benefitHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  benefitHeadText: { fontSize: 12.5, fontWeight: '800' },
  benefitRow: { gap: 2 },
  benefitTitle: { fontSize: 13.5, fontWeight: '800' },
  benefitDetail: { fontSize: 12, lineHeight: 17 },
});
