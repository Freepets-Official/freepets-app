import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OwnerLoadState } from '@/components/owner-load-state';
import { Text } from '@/components/text';
import { MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useOwnerFacilities } from '@/hooks/use-owner-facilities';
import { usePalette } from '@/hooks/use-theme';
import { OWNER_AMENITY_LABEL, type OwnerAmenity } from '@/data/types';
import { ApiError, ownerApi, type OwnerFacility } from '@/lib/api';

const AMENITIES = Object.keys(OWNER_AMENITY_LABEL) as OwnerAmenity[];

/** 매장 소개·홍보 — `PUT /owner/facilities/{id}/profile`. 소개글과 태그를 한 번에 저장한다 */
export default function PromotionScreen() {
  const p = usePalette();
  const { facilityId: idParam } = useLocalSearchParams<{ facilityId?: string }>();
  const facilityId = Number(idParam);
  const { facilities, failed, refresh } = useOwnerFacilities();
  const facility = facilities?.find((f) => f.facilityId === facilityId) ?? null;

  if (!facility) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '매장 소개·홍보', headerBackButtonDisplayMode: 'minimal' }} />
        <OwnerLoadState facilities={facilities} failed={failed} refresh={refresh} />
      </SafeAreaView>
    );
  }
  // 폼은 서버 값이 온 뒤에 마운트한다 — 초기값으로 한 번 채우고, 사용자가 고치는 중에 재조회가 덮지 않는다
  return <PromotionForm facility={facility} refresh={refresh} />;
}

function PromotionForm({ facility, refresh }: { facility: OwnerFacility; refresh: () => Promise<void> }) {
  const p = usePalette();
  const router = useRouter();
  const [intro, setIntro] = useState(facility.profile.introduction ?? '');
  const [amenities, setAmenities] = useState<OwnerAmenity[]>(facility.profile.amenityTags);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (a: OwnerAmenity) => setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await ownerApi.updateProfile(facility.facilityId, { introduction: intro.trim() || null, amenityTags: amenities });
      await refresh();
      setSaved(true);
      setTimeout(() => router.back(), 700);
    } catch (e) {
      setError(e instanceof ApiError && e.message ? e.message : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '매장 소개·홍보', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: p.accent }]}>{facility.name}</Text>
            <Text style={[styles.title, { color: p.ink }]}>사장님이 전하는{'\n'}우리 매장</Text>
            <Text style={[styles.sub, { color: p.muted }]}>여기서 적은 내용은 손님 시설 상세에 &lsquo;사장님이 전하는 우리 매장&rsquo;으로 보여져요.</Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: p.ink }]}>소개글</Text>
            <TextInput value={intro} onChangeText={setIntro} placeholder="예) 대형견도 환영해요. 야외 테라스에 급수대와 펫 메뉴가 준비돼 있어요." placeholderTextColor={p.muted} multiline maxLength={500} style={[styles.textarea, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]} />
            <Text style={[styles.hint, { color: p.muted }]}>{intro.length}/500</Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: p.ink }]}>반려동물 편의시설</Text>
            <View style={styles.chips}>
              {AMENITIES.map((a) => {
                const on = amenities.includes(a);
                return (
                  <Pressable key={a} onPress={() => toggle(a)} style={[styles.chip, { backgroundColor: on ? p.accentSoft : p.surface, borderColor: on ? p.accent : p.line }]}>
                    <Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={15} color={on ? p.accent : p.muted} />
                    <Text style={[styles.chipText, { color: on ? p.accent : p.muted }]}>{OWNER_AMENITY_LABEL[a]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={[styles.hint, { color: p.muted }]}>대표 사진 업로드는 준비 중이에요. 관광공사 사진이 동기화 때 덮어써서 별도 저장이 필요해요.</Text>
          {error && <Text style={[styles.err, { color: p.danger }]}>{error}</Text>}
          <Pressable onPress={() => void save()} disabled={saving} style={({ pressed }) => [styles.saveBtn, { backgroundColor: saved ? p.success : pressed || saving ? p.accentDark : p.accent }]}>
            {saving ? <ActivityIndicator color={p.onAccent} size="small" /> : <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={16} color={p.onAccent} />}
            <Text style={[styles.saveText, { color: p.onAccent }]}>{saved ? '저장했어요' : saving ? '저장하는 중…' : '저장하기'}</Text>
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
  eyebrow: { fontSize: Type.footnote, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: Type.screenTitle, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { fontSize: Type.body, lineHeight: 20, marginTop: 4 },
  field: { gap: 8 },
  label: { fontSize: Type.bodyLg, fontWeight: '800' },
  hint: { fontSize: Type.caption, lineHeight: 17 },
  err: { fontSize: Type.footnote, lineHeight: 18, fontWeight: '600' },
  textarea: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, fontSize: Type.bodyLg, minHeight: 96, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: Radius.full, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontSize: Type.body, fontWeight: '700' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.full, paddingVertical: 15 },
  saveText: { fontSize: Type.callout, fontWeight: '800' },
  empty: { fontSize: Type.bodyLg, textAlign: 'center', padding: 40 },
});
