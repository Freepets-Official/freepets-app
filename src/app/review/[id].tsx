import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { StarInput } from '@/components/star-rating';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { PET_KIND_LABEL, REVIEW_TAG_LABEL, type ReviewTag } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const TAGS = Object.keys(REVIEW_TAG_LABEL) as ReviewTag[];

export default function ReviewWriteScreen() {
  const p = usePalette();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pets, checks, addReview } = useAppStore();

  const facilityId = Number(id);
  const facility = FACILITIES.find((f) => f.facilityId === facilityId);
  const lastCheck = checks.find((c) => c.facilityId === facilityId);
  // 판별했던 아이들을 기본 선택 — 없으면 첫 아이
  const defaultPetIds = lastCheck?.petIds ?? (pets[0] ? [pets[0].petId] : []);

  const [space, setSpace] = useState(0);
  const [staff, setStaff] = useState(0);
  const [amenity, setAmenity] = useState(0);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [content, setContent] = useState('');
  const [petIds, setPetIds] = useState<number[]>(defaultPetIds);
  const [showPetInfo, setShowPetInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const togglePetId = (petId: number) =>
    setPetIds((prev) => (prev.includes(petId) ? prev.filter((x) => x !== petId) : [...prev, petId]));

  if (!facility) {
    return (
      <Screen>
        <Text style={{ color: p.muted, textAlign: 'center', paddingVertical: 48 }}>
          시설을 찾을 수 없어요.
        </Text>
      </Screen>
    );
  }

  const toggleTag = (t: ReviewTag) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = () => {
    if (!space || !staff || !amenity) {
      setError('세 항목 모두 별점을 남겨 주세요');
      return;
    }
    addReview({
      facilityId,
      petIds,
      showPetInfo,
      ratingSpace: space,
      ratingStaff: staff,
      ratingAmenity: amenity,
      content: content.trim() || null,
      tags,
    });
    haptic.success();
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: '리뷰 쓰기' }} />

      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: p.accent }]}>방문 리뷰</Text>
        <Text style={[styles.title, { color: p.ink }]}>{facility.name}</Text>
        <Text style={[styles.sub, { color: p.muted }]}>
          반려동물과 함께한 경험만 평가해 주세요. 이 점수가 발자국 등급이 됩니다.
        </Text>
      </View>

      <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
        <StarInput
          label="공간 여유"
          hint="반려동물이 머물기에 공간이 넉넉했나요?"
          value={space}
          onChange={setSpace}
        />
        <View style={[styles.divider, { backgroundColor: p.line }]} />
        <StarInput
          label="직원 친절도"
          hint="직원분들이 반려동물을 반겨 주셨나요?"
          value={staff}
          onChange={setStaff}
        />
        <View style={[styles.divider, { backgroundColor: p.line }]} />
        <StarInput
          label="편의시설"
          hint="배변봉투·급수대 같은 편의시설이 있었나요?"
          value={amenity}
          onChange={setAmenity}
        />
      </View>

      {pets.length > 0 && (
        <View style={styles.block}>
          <Text style={[styles.blockLabel, { color: p.ink }]}>함께 방문한 반려동물</Text>
          <Text style={[styles.blockHint, { color: p.muted }]}>여러 마리를 고를 수 있어요</Text>
          <View style={styles.tagWrap}>
            {pets.map((pet) => {
              const on = petIds.includes(pet.petId);
              return (
                <Pressable
                  key={pet.petId}
                  onPress={() => togglePetId(pet.petId)}
                  style={[
                    styles.tag,
                    { backgroundColor: on ? p.ink : p.surface, borderColor: on ? p.ink : p.line },
                  ]}>
                  <Text style={[styles.tagText, { color: on ? p.bg : p.muted }]}>{pet.name}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* 품종·몸무게 공개 (옵트인) — 다음 방문자의 '우리 아이 기준' 판단에 큰 도움 */}
          <View style={[styles.discloseRow, { backgroundColor: p.surface, borderColor: p.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.discloseLabel, { color: p.ink }]}>우리 아이 품종·몸무게 공개</Text>
              <Text style={[styles.discloseSub, { color: p.muted }]}>
                {showPetInfo
                  ? petIds.length > 0
                    ? pets
                        .filter((pt) => petIds.includes(pt.petId))
                        .map((pt) => `${PET_KIND_LABEL[pt.kind]}·${pt.species}${pt.weight > 0 ? ` ${pt.weight}kg` : ''}`)
                        .join(', ')
                    : '함께 방문한 아이를 골라주세요'
                  : '공개하지 않으면 리뷰에 품종·몸무게가 표시되지 않아요'}
              </Text>
            </View>
            <Switch
              value={showPetInfo}
              onValueChange={setShowPetInfo}
              trackColor={{ true: p.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      )}

      <View style={styles.block}>
        <Text style={[styles.blockLabel, { color: p.ink }]}>어떤 점이 좋았나요?</Text>
        <Text style={[styles.blockHint, { color: p.muted }]}>해당하는 것을 모두 골라 주세요</Text>
        <View style={styles.tagWrap}>
          {TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <Pressable
                key={t}
                onPress={() => toggleTag(t)}
                style={[
                  styles.tag,
                  {
                    backgroundColor: on ? p.accentSoft : p.surface,
                    borderColor: on ? p.accent : p.line,
                  },
                ]}>
                <Text style={[styles.tagText, { color: on ? p.accent : p.muted }]}>
                  {REVIEW_TAG_LABEL[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={[styles.blockLabel, { color: p.ink }]}>한 줄 후기 (선택)</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="다음 방문자에게 도움이 될 이야기를 남겨 주세요"
          placeholderTextColor={p.muted}
          multiline
          style={[
            styles.textarea,
            { backgroundColor: p.surface, borderColor: p.line, color: p.ink },
          ]}
        />
      </View>

      {error && <Text style={[styles.error, { color: p.danger }]}>{error}</Text>}

      <Pressable
        onPress={submit}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: pressed ? p.accentDark : p.accent },
        ]}>
        <Ionicons name="paw" size={17} color={p.onAccent} />
        <Text style={[styles.submitLabel, { color: p.onAccent }]}>리뷰 등록</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4, paddingTop: Spacing.sm },
  eyebrow: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  sub: { fontSize: 13.5, lineHeight: 20, marginTop: 2 },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, gap: Spacing.lg },
  divider: { height: 1 },
  block: { gap: 8 },
  blockLabel: { fontSize: 15, fontWeight: '800' },
  blockHint: { fontSize: 12.5, marginTop: -4 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 13, paddingVertical: 7 },
  tagText: { fontSize: 12.5, fontWeight: '700' },
  discloseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    marginTop: 4,
  },
  discloseLabel: { fontSize: 14, fontWeight: '800' },
  discloseSub: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  textarea: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: 14.5,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  error: { fontSize: 13, fontWeight: '700' },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingVertical: 16,
  },
  submitLabel: { fontSize: 15.5, fontWeight: '800' },
});
