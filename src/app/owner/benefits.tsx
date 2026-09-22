import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OwnerLoadState } from '@/components/owner-load-state';
import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { CardShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useOwnerFacilities } from '@/hooks/use-owner-facilities';
import { usePalette } from '@/hooks/use-theme';
import { ApiError, ownerApi, type OwnerBenefit } from '@/lib/api';
import { confirmDialog } from '@/lib/notify';

/** 방문 혜택 안내 — `/owner/facilities/{id}/benefits` CRUD. 안내 텍스트만, 쿠폰 발급은 2차 */
export default function BenefitsScreen() {
  const p = usePalette();
  const { facilityId: idParam } = useLocalSearchParams<{ facilityId?: string }>();
  const facilityId = Number(idParam);
  const { facilities, failed: facilitiesFailed, refresh } = useOwnerFacilities();
  const facility = facilities?.find((f) => f.facilityId === facilityId) ?? null;

  const [list, setList] = useState<OwnerBenefit[] | null>(null);
  const [failed, setFailed] = useState(false);
  // 실패하면 화면 안에서 다시 받는다 — 나갔다 들어와야만 재요청되면 안 된다
  const [attempt, setAttempt] = useState(0);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  // 요청 중인 혜택 — 그 스위치를 잠근다. 연타하면 앞 요청의 늦은 응답이 최신 화면을 덮는다
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    ownerApi
      .benefits(facilityId)
      .then((b) => alive && setList(b))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [facilityId, attempt]);
  const retry = () => {
    setFailed(false);
    setList(null);
    setAttempt((a) => a + 1);
  };

  const fail = (e: unknown, fallback: string) => setError(e instanceof ApiError && e.message ? e.message : fallback);

  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await ownerApi.addBenefit(facilityId, title.trim(), detail.trim() || null);
      setList((prev) => [...(prev ?? []), created]);
      setTitle('');
      setDetail('');
    } catch (e) {
      fail(e, '혜택을 추가하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (b: OwnerBenefit) => {
    if (toggling.has(b.benefitId)) return;
    setToggling((prev) => new Set(prev).add(b.benefitId));
    // 화면 먼저, 실패하면 되돌린다
    setList((prev) => (prev ?? []).map((x) => (x.benefitId === b.benefitId ? { ...x, isEnabled: !b.isEnabled } : x)));
    try {
      const updated = await ownerApi.setBenefitEnabled(facilityId, b.benefitId, !b.isEnabled);
      setList((prev) => (prev ?? []).map((x) => (x.benefitId === b.benefitId ? updated : x)));
    } catch (e) {
      setList((prev) => (prev ?? []).map((x) => (x.benefitId === b.benefitId ? b : x)));
      fail(e, '노출 설정을 바꾸지 못했어요');
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(b.benefitId);
        return next;
      });
    }
  };
  const remove = async (b: OwnerBenefit) => {
    if (!(await confirmDialog('혜택을 삭제할까요?', `'${b.title}'을(를) 지우면 되돌릴 수 없어요.`))) return;
    try {
      await ownerApi.removeBenefit(facilityId, b.benefitId);
      setList((prev) => (prev ?? []).filter((x) => x.benefitId !== b.benefitId));
    } catch (e) {
      fail(e, '혜택을 삭제하지 못했어요');
    }
  };

  if (!facility) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '방문 혜택 안내', headerBackButtonDisplayMode: 'minimal' }} />
        <OwnerLoadState facilities={facilities} failed={facilitiesFailed} refresh={refresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '방문 혜택 안내', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: p.accent }]}>{facility.name}</Text>
            <Text style={[styles.title, { color: p.ink }]}>방문 혜택 안내</Text>
            <Text style={[styles.sub, { color: p.muted }]}>반려동물 손님에게 줄 혜택을 안내해요. 손님 시설 상세에 &lsquo;방문 혜택&rsquo;으로 보여집니다.</Text>
          </View>

          <View style={[styles.addCard, { backgroundColor: p.surface, borderColor: p.line }]}>
            <TextInput value={title} onChangeText={setTitle} placeholder="혜택 제목 (예: 출입증 제시 시 음료 10%)" placeholderTextColor={p.muted} maxLength={50} style={[styles.input, { color: p.ink, borderColor: p.line, backgroundColor: p.card }]} />
            <TextInput value={detail} onChangeText={setDetail} placeholder="상세 안내 (선택)" placeholderTextColor={p.muted} maxLength={300} style={[styles.input, { color: p.ink, borderColor: p.line, backgroundColor: p.card }]} />
            <Pressable onPress={() => void add()} disabled={!title.trim() || busy} style={({ pressed }) => [styles.addBtn, { backgroundColor: title.trim() ? (pressed || busy ? p.accentDark : p.accent) : p.line }]}>
              {busy ? <ActivityIndicator color={p.onAccent} size="small" /> : <Ionicons name="add" size={17} color={title.trim() ? p.onAccent : p.muted} />}
              <Text style={[styles.addBtnText, { color: title.trim() ? p.onAccent : p.muted }]}>혜택 추가</Text>
            </Pressable>
          </View>

          {error && <Text style={[styles.err, { color: p.danger }]}>{error}</Text>}

          <View style={styles.list}>
            {failed ? (
              <LoadState kind="failed" message="혜택을 불러오지 못했어요." onRetry={retry} />
            ) : list === null ? (
              <LoadState kind="loading" />
            ) : list.length === 0 ? (
              <LoadState kind="empty" message="아직 등록한 혜택이 없어요. 위에서 첫 혜택을 추가해보세요." />
            ) : (
              list.map((b) => (
                <View key={b.benefitId} style={[styles.item, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
                  <View style={styles.itemBody}>
                    <Text style={[styles.itemTitle, { color: b.isEnabled ? p.ink : p.muted }]}>{b.title}</Text>
                    {b.description ? <Text style={[styles.itemDetail, { color: p.muted }]}>{b.description}</Text> : null}
                  </View>
                  <Switch value={b.isEnabled} disabled={toggling.has(b.benefitId)} onValueChange={() => void toggle(b)} trackColor={{ true: p.accent }} thumbColor="#FFFFFF" />
                  <Pressable onPress={() => void remove(b)} style={styles.del} hitSlop={6}>
                    <Ionicons name="trash-outline" size={18} color={p.muted} />
                  </Pressable>
                </View>
              ))
            )}
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
  eyebrow: { fontSize: Type.footnote, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: Type.screenTitle, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { fontSize: Type.body, lineHeight: 20, marginTop: 4 },
  addCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 12, fontSize: Type.bodyLg },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.full, paddingVertical: 12 },
  addBtnText: { fontSize: Type.bodyLg, fontWeight: '800' },
  err: { fontSize: Type.footnote, lineHeight: 18, fontWeight: '600' },
  list: { gap: Spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontSize: Type.bodyLg, fontWeight: '800' },
  itemDetail: { fontSize: Type.footnote, lineHeight: 18 },
  del: { padding: 4 },
});
