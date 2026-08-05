import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

/** 공지사항 — 정적 목록 (실서비스는 서버에서 내려받음) */
const NOTICES = [
  {
    date: '2026-08-01',
    tag: '업데이트',
    title: '예방접종 리마인더가 추가됐어요',
    body: '강아지·고양이의 다음 접종 예정일을 홈에서 알려드리고, 캘린더에 바로 등록할 수 있어요.',
  },
  {
    date: '2026-07-28',
    tag: '업데이트',
    title: '리뷰에 우리 아이 품종·몸무게를 공개할 수 있어요',
    body: '다음 방문자의 “우리 아이 기준” 판단을 돕기 위해, 원하면 리뷰에 품종·몸무게를 함께 남길 수 있어요(선택).',
  },
  {
    date: '2026-07-20',
    tag: '안내',
    title: '개·고양이 외 반려동물은 “직접 확인”으로 안내해요',
    body: '관광공사 데이터가 개·고양이 위주라, 새·토끼·파충류 등은 자동 판별 대신 시설 전화 확인을 안내합니다.',
  },
  {
    date: '2026-07-10',
    tag: '점검',
    title: '정기 서버 점검 안내',
    body: '매주 화요일 새벽 3~4시에 데이터 동기화 점검이 있을 수 있어요. 이용에 참고해 주세요.',
  },
];

export default function NoticesScreen() {
  const p = usePalette();
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '공지사항', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {NOTICES.map((n) => (
            <View
              key={n.title}
              style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
              <View style={styles.top}>
                <View style={[styles.tag, { backgroundColor: p.accentSoft }]}>
                  <Text style={[styles.tagText, { color: p.accent }]}>{n.tag}</Text>
                </View>
                <Text style={[styles.date, { color: p.muted }]}>{n.date}</Text>
              </View>
              <Text style={[styles.title, { color: p.ink }]}>{n.title}</Text>
              <Text style={[styles.body, { color: p.muted }]}>{n.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.md },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '800' },
  date: { fontSize: 11.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  title: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3 },
  body: { fontSize: 13, lineHeight: 20 },
});
