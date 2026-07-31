import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/** 방문 혜택 안내 (사업자 대시보드 ③) — MVP는 안내 텍스트만, 쿠폰 발급은 2차 */
export default function BenefitsScreen() {
  const p = usePalette();
  const params = useLocalSearchParams<{ facilityId?: string }>();
  const { businessRegs, benefitsOf, addBenefit, toggleBenefit, removeBenefit } = useAppStore();

  const facilityId = Number(params.facilityId) || Number(Object.keys(businessRegs)[0]);
  const facility = FACILITIES.find((f) => f.facilityId === facilityId);
  const list = benefitsOf(facilityId);

  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');

  const add = () => {
    if (!title.trim()) return;
    addBenefit(facilityId, title.trim(), detail.trim());
    setTitle('');
    setDetail('');
  };

  if (!facility) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '방문 혜택 안내' }} />
        <Text style={[styles.empty, { color: p.muted }]}>등록된 매장이 없어요.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '방문 혜택 안내', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: p.accent }]}>{facility.name}</Text>
            <Text style={[styles.title, { color: p.ink }]}>방문 혜택 안내</Text>
            <Text style={[styles.sub, { color: p.muted }]}>
              반려동물 손님에게 줄 혜택을 안내해요. 손님 시설 상세에 &lsquo;방문 혜택&rsquo;으로 보여집니다.
            </Text>
          </View>

          {/* 혜택 추가 */}
          <View style={[styles.addCard, { backgroundColor: p.surface, borderColor: p.line }]}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="혜택 제목 (예: 출입증 제시 시 음료 10%)"
              placeholderTextColor={p.muted}
              style={[styles.input, { color: p.ink, borderColor: p.line }]}
            />
            <TextInput
              value={detail}
              onChangeText={setDetail}
              placeholder="상세 안내 (선택)"
              placeholderTextColor={p.muted}
              style={[styles.input, { color: p.ink, borderColor: p.line }]}
            />
            <Pressable
              onPress={add}
              style={({ pressed }) => [
                styles.addBtn,
                { backgroundColor: title.trim() ? (pressed ? p.accentDark : p.accent) : p.line },
              ]}>
              <Ionicons name="add" size={17} color={title.trim() ? p.onAccent : p.muted} />
              <Text style={[styles.addBtnText, { color: title.trim() ? p.onAccent : p.muted }]}>
                혜택 추가
              </Text>
            </Pressable>
          </View>

          {/* 혜택 목록 */}
          <View style={styles.list}>
            {list.map((b) => (
              <View
                key={b.benefitId}
                style={[styles.item, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                <View style={styles.itemBody}>
                  <Text style={[styles.itemTitle, { color: b.active ? p.ink : p.muted }]}>
                    {b.title}
                  </Text>
                  {b.detail ? (
                    <Text style={[styles.itemDetail, { color: p.muted }]}>{b.detail}</Text>
                  ) : null}
                </View>
                <Switch
                  value={b.active}
                  onValueChange={() => toggleBenefit(facilityId, b.benefitId)}
                  trackColor={{ true: p.accent }}
                  thumbColor="#FFFFFF"
                />
                <Pressable onPress={() => removeBenefit(facilityId, b.benefitId)} style={styles.del}>
                  <Ionicons name="trash-outline" size={18} color={p.muted} />
                </Pressable>
              </View>
            ))}
            {list.length === 0 && (
              <Text style={[styles.emptyList, { color: p.muted }]}>
                아직 등록한 혜택이 없어요. 위에서 첫 혜택을 추가해보세요.
              </Text>
            )}
          </View>

          <View style={[styles.note, { backgroundColor: p.accentSoft }]}>
            <Ionicons name="information-circle-outline" size={16} color={p.accent} />
            <Text style={[styles.noteText, { color: p.ink }]}>
              지금은 <Text style={{ fontWeight: '800' }}>안내 문구</Text>까지예요. 쿠폰 발급·사용
              처리(코드·1회성·정산)는 2차에서 붙습니다.
            </Text>
          </View>
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
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  sub: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  addCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    fontSize: 14.5,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: Radius.full,
    paddingVertical: 12,
  },
  addBtnText: { fontSize: 14, fontWeight: '800' },
  list: { gap: Spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 14.5, fontWeight: '800' },
  itemDetail: { fontSize: 12.5, lineHeight: 18 },
  del: { padding: 2 },
  emptyList: { fontSize: 13, textAlign: 'center', paddingVertical: 28, lineHeight: 20 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  empty: { fontSize: 14, textAlign: 'center', padding: 40 },
});
