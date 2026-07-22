import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { PetAvatar } from '@/components/pet-avatar';
import { ScoreSlider } from '@/components/score-slider';
import { SectionTitle } from '@/components/section-title';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { satisfactionMood } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 우리 아이 만족도 — 사업자 리뷰와 분리된, 본인에게만 보이는 개인 기록.
 * 아이마다 같은 장소를 다르게 평가할 수 있다(강아지 9.5 / 고양이 4.0처럼).
 */
export function SatisfactionSection({ facilityId }: { facilityId: number }) {
  const p = usePalette();
  const { pets, satisfactionOf, setSatisfaction } = useAppStore();

  if (pets.length === 0) return null;

  return (
    <>
      <SectionTitle title="우리 아이 만족도" caption="나만 볼 수 있어요" />

      <View style={[styles.privacy, { backgroundColor: p.accentSoft }]}>
        <Ionicons name="lock-closed" size={13} color={p.accent} />
        <Text style={[styles.privacyText, { color: p.ink }]}>
          이 점수는 사업자 리뷰에 반영되지 않아요. 홈에서 아이별 좋아한 곳 TOP 3로 모여요.
        </Text>
      </View>

      <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
        {pets.map((pet, i) => {
          const score = satisfactionOf(pet.petId, facilityId) ?? 0;
          const rated = satisfactionOf(pet.petId, facilityId) !== null;
          const mood = satisfactionMood(score);
          return (
            <View
              key={pet.petId}
              style={[
                styles.petRow,
                i > 0 && { borderTopWidth: 1, borderTopColor: p.line, paddingTop: Spacing.lg },
              ]}>
              <View style={styles.petHead}>
                <PetAvatar pet={pet} size={34} />
                <Text style={[styles.petName, { color: p.ink }]}>{pet.name}</Text>
                <View style={styles.scoreWrap}>
                  {rated ? (
                    <>
                      <Text style={styles.mood}>{mood.emoji}</Text>
                      <Text style={[styles.score, { color: p.accent }]}>{score.toFixed(1)}</Text>
                    </>
                  ) : (
                    <Text style={[styles.unrated, { color: p.muted }]}>기록 전</Text>
                  )}
                </View>
              </View>
              <ScoreSlider
                value={score}
                onChange={(v) => setSatisfaction(pet.petId, facilityId, v)}
              />
              <View style={styles.scale}>
                <Text style={[styles.scaleEnd, { color: p.muted }]}>0</Text>
                <Text style={[styles.scaleMid, { color: p.muted }]}>
                  {rated ? mood.label : '슬라이드해서 점수를 남겨보세요'}
                </Text>
                <Text style={[styles.scaleEnd, { color: p.muted }]}>10</Text>
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  privacyText: { fontSize: 12, fontWeight: '600', flexShrink: 1, lineHeight: 17 },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, gap: Spacing.lg },
  petRow: { gap: 8 },
  petHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  petName: { fontSize: 15, fontWeight: '800', flex: 1 },
  scoreWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mood: { fontSize: 16 },
  score: { fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  unrated: { fontSize: 12.5, fontWeight: '700' },
  scale: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scaleEnd: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scaleMid: { fontSize: 11.5, fontWeight: '600' },
});
