import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { SectionTitle } from '@/components/section-title';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { AMENITY_LABEL, useAppStore } from '@/store/app-store';

/**
 * 방문자 시설 상세 "사장님이 전하는 우리 매장" (docs/10) —
 * 소유 사업자가 대시보드에서 등록한 소개·편의시설·방문 혜택을 손님에게 노출한다.
 * 등록된 내용이 없으면 아무것도 그리지 않는다.
 */
export function OwnerPromotionSection({ facilityId }: { facilityId: number }) {
  const p = usePalette();
  const { promotionOf, benefitsOf } = useAppStore();
  const promo = promotionOf(facilityId);
  const benefits = benefitsOf(facilityId).filter((b) => b.active);

  const hasPromo = !!promo && (!!promo.intro || promo.amenities.length > 0 || promo.photoCount > 0);
  if (!hasPromo && benefits.length === 0) return null;

  return (
    <>
      <SectionTitle title="사장님이 전하는 우리 매장" caption="사업자 확인" />
      <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
        {/* 대표 사진 (데모: 자리표시) */}
        {promo && promo.photoCount > 0 && (
          <View style={styles.photos}>
            {Array.from({ length: promo.photoCount }).map((_, i) => (
              <View key={i} style={[styles.photo, { backgroundColor: p.accentSoft }]}>
                <Ionicons name="paw" size={20} color={p.accent} />
              </View>
            ))}
          </View>
        )}

        {/* 소개글 */}
        {promo?.intro ? (
          <Text style={[styles.intro, { color: p.ink }]}>{promo.intro}</Text>
        ) : null}

        {/* 편의시설 */}
        {promo && promo.amenities.length > 0 && (
          <View style={styles.amenities}>
            {promo.amenities.map((a) => (
              <View key={a} style={[styles.amenity, { backgroundColor: p.surface, borderColor: p.line }]}>
                <Ionicons name="checkmark-circle" size={13} color={p.accent} />
                <Text style={[styles.amenityText, { color: p.ink }]}>{AMENITY_LABEL[a]}</Text>
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
                {b.detail ? (
                  <Text style={[styles.benefitDetail, { color: p.muted }]}>{b.detail}</Text>
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
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photo: { width: 72, height: 72, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
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
