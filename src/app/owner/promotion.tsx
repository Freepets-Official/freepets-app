import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { usePalette } from '@/hooks/use-theme';
import { AMENITY_LABEL, useAppStore, type Amenity } from '@/store/app-store';

const AMENITIES = Object.keys(AMENITY_LABEL) as Amenity[];

/** 매장 소개·홍보 (사업자 대시보드 ②) — 반려동물 관점 어필을 손님 시설 상세에 노출한다 */
export default function PromotionScreen() {
  const p = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ facilityId?: string }>();
  const { businessRegs, promotionOf, setPromotion } = useAppStore();

  const facilityId = Number(params.facilityId) || Number(Object.keys(businessRegs)[0]);
  const facility = FACILITIES.find((f) => f.facilityId === facilityId);
  const existing = promotionOf(facilityId);

  const [intro, setIntro] = useState(existing?.intro ?? '');
  const [amenities, setAmenities] = useState<Amenity[]>(existing?.amenities ?? []);
  const [photoCount, setPhotoCount] = useState(existing?.photoCount ?? 0);
  const [saved, setSaved] = useState(false);

  const toggle = (a: Amenity) =>
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const save = () => {
    if (!facility) return;
    setPromotion({ facilityId, intro: intro.trim(), amenities, photoCount });
    setSaved(true);
    setTimeout(() => router.back(), 700);
  };

  if (!facility) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '매장 소개·홍보' }} />
        <Text style={[styles.empty, { color: p.muted }]}>등록된 매장이 없어요.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '매장 소개·홍보', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: p.accent }]}>{facility.name}</Text>
            <Text style={[styles.title, { color: p.ink }]}>사장님이 전하는{'\n'}우리 매장</Text>
            <Text style={[styles.sub, { color: p.muted }]}>
              여기서 적은 내용은 손님 시설 상세에 &lsquo;사장님이 전하는 우리 매장&rsquo;으로 보여져요.
            </Text>
          </View>

          {/* 대표 사진 */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: p.ink }]}>대표 사진</Text>
            <View style={styles.photos}>
              {Array.from({ length: photoCount }).map((_, i) => (
                <View key={i} style={[styles.photo, { backgroundColor: p.accentSoft }]}>
                  <Ionicons name="paw" size={20} color={p.accent} />
                  <Pressable
                    onPress={() => setPhotoCount((c) => Math.max(0, c - 1))}
                    style={[styles.photoDel, { backgroundColor: p.ink }]}>
                    <Ionicons name="close" size={11} color="#FFF" />
                  </Pressable>
                </View>
              ))}
              {photoCount < 5 && (
                <Pressable
                  onPress={() => setPhotoCount((c) => c + 1)}
                  style={[styles.photoAdd, { borderColor: p.line }]}>
                  <Ionicons name="camera-outline" size={22} color={p.muted} />
                  <Text style={[styles.photoAddText, { color: p.muted }]}>추가</Text>
                </Pressable>
              )}
            </View>
            <Text style={[styles.hint, { color: p.muted }]}>
              사진 업로드는 준비 중이에요. 우선 소개글·편의시설부터 등록해 주세요.
            </Text>
          </View>

          {/* 소개글 */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: p.ink }]}>소개글</Text>
            <TextInput
              value={intro}
              onChangeText={setIntro}
              placeholder="예) 대형견도 환영해요. 야외 테라스에 급수대와 펫 메뉴가 준비돼 있어요."
              placeholderTextColor={p.muted}
              multiline
              style={[styles.textarea, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]}
            />
          </View>

          {/* 편의시설 태그 */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: p.ink }]}>반려동물 편의시설</Text>
            <View style={styles.chips}>
              {AMENITIES.map((a) => {
                const on = amenities.includes(a);
                return (
                  <Pressable
                    key={a}
                    onPress={() => toggle(a)}
                    style={[
                      styles.chip,
                      { backgroundColor: on ? p.accentSoft : p.surface, borderColor: on ? p.accent : p.line },
                    ]}>
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'add-circle-outline'}
                      size={15}
                      color={on ? p.accent : p.muted}
                    />
                    <Text style={[styles.chipText, { color: on ? p.accent : p.muted }]}>
                      {AMENITY_LABEL[a]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={save}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: saved ? p.success : pressed ? p.accentDark : p.accent },
            ]}>
            <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={16} color={p.onAccent} />
            <Text style={[styles.saveText, { color: p.onAccent }]}>
              {saved ? '저장했어요' : '저장하기'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 64 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.xl, paddingTop: Spacing.sm },
  head: { gap: 4 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1, lineHeight: 33 },
  sub: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  field: { gap: 8 },
  label: { fontSize: 14.5, fontWeight: '800' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photo: { width: 72, height: 72, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  photoDel: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoAddText: { fontSize: 11, fontWeight: '700' },
  hint: { fontSize: 11.5, lineHeight: 17 },
  textarea: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: 14.5,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingVertical: 15,
  },
  saveText: { fontSize: 15, fontWeight: '800' },
  empty: { fontSize: 14, textAlign: 'center', padding: 40 },
});
