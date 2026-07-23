import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { FacilityCard } from '@/components/facility-card';
import { Screen } from '@/components/screen';
import { SectionTitle } from '@/components/section-title';
import { Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { CATEGORY_LABEL, type Category } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export default function ExploreScreen() {
  const p = usePalette();
  const router = useRouter();
  const { settings } = useAppStore();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<Category | null>(null);

  const facilities = useMemo(() => {
    const q = keyword.trim();
    return FACILITIES.filter((f) => {
      if (settings.hideDenied && f.petAllowed === false) return false;
      if (category && f.category !== category) return false;
      if (q && !f.name.includes(q) && !f.address.includes(q)) return false;
      return true;
    }).sort((a, b) => a.distanceM - b.distanceM);
  }, [keyword, category, settings.hideDenied]);

  return (
    <Screen
      eyebrow="반려동물 동반여행"
      title="가도 될까?"
      subtitle="시설마다 다른 출입 조건, AI가 우리 아이 기준으로 판단해 드려요.">
      <View style={[styles.search, { backgroundColor: p.surface, borderColor: p.line }]}>
        <Ionicons name="search" size={18} color={p.muted} />
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="시설명이나 지역으로 검색"
          placeholderTextColor={p.muted}
          style={[styles.searchInput, { color: p.ink }]}
        />
        {keyword.length > 0 && (
          <Ionicons name="close-circle" size={17} color={p.muted} onPress={() => setKeyword('')} />
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}>
        <Chip label="전체" selected={category === null} onPress={() => setCategory(null)} />
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABEL[c]}
            selected={category === c}
            onPress={() => setCategory(category === c ? null : c)}
          />
        ))}
      </ScrollView>

      {/* 여행 코스 판별 진입점 — 낱개 시설이 아니라 하루 동선 전체를 검증한다 */}
      <Pressable
        onPress={() => router.push('/course')}
        style={({ pressed }) => [
          styles.courseCta,
          { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : p.card },
        ]}>
        <View style={[styles.courseIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="map" size={20} color={p.accent} />
        </View>
        <View style={styles.courseText}>
          <Text style={[styles.courseTitle, { color: p.ink }]}>여행 코스 판별</Text>
          <Text style={[styles.courseBody, { color: p.muted }]}>
            여러 곳을 코스로 묶어 하루 동선을 한 번에 확인해요
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={p.accent} />
      </Pressable>

      <SectionTitle title="내 주변 시설" caption={`${facilities.length}곳 · 강릉역 기준`} />

      <View style={styles.list}>
        {facilities.map((f) => (
          <FacilityCard key={f.facilityId} facility={f} />
        ))}
        {facilities.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="search" size={30} color={p.muted} />
            <Text style={[styles.emptyText, { color: p.muted }]}>
              조건에 맞는 시설이 없어요.{'\n'}검색어나 카테고리를 바꿔 보세요.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  chips: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.xl },
  list: { gap: Spacing.md },
  courseCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  courseIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseText: { flex: 1, gap: 2 },
  courseTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  courseBody: { fontSize: 12, lineHeight: 17 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 56 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
