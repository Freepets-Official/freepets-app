import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DenialReport } from '@/components/denial-report';
import { PassportCard } from '@/components/passport-card';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 동반 출입증 — 문 앞에서 시설 직원에게 보여주는 화면.
 *
 * 여러 마리를 함께 판별했으면 아이별로 한 장씩 스와이프해서 넘긴다.
 * 그룹 전체 결과가 아니라 아이 단위로 보여주는 이유: 직원이 확인하는 대상은
 * "이 가족"이 아니라 "지금 문 앞에 있는 이 아이"이기 때문이다.
 */
export default function PassportScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pets, checks, confidenceOf } = useAppStore();
  const { width } = useWindowDimensions();

  const facilityId = Number(id);
  const facility = FACILITIES.find((f) => f.facilityId === facilityId);

  // 이 시설의 가장 최근 판별 기록
  const check = useMemo(
    () => checks.find((c) => c.facilityId === facilityId),
    [checks, facilityId],
  );

  const [page, setPage] = useState(0);

  const pageWidth = Math.min(width, MaxContentWidth);

  if (!facility || !check) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
        <Stack.Screen options={{ title: '동반 출입증' }} />
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={34} color={p.muted} />
          <Text style={[styles.emptyText, { color: p.muted }]}>
            먼저 AI 출입 판별을 해주세요.{'\n'}판별 결과로 출입증이 만들어져요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const conf = confidenceOf(facility);
  const cards = check.verdicts
    .map((v) => ({ verdict: v, pet: pets.find((x) => x.petId === v.petId) }))
    .filter((c): c is { verdict: typeof c.verdict; pet: NonNullable<typeof c.pet> } => !!c.pet);

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.surface }]}>
      <Stack.Screen options={{ title: '동반 출입증' }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 직원에게 보여주는 화면이라는 안내 — 방문자가 먼저 읽는다 */}
        <View style={[styles.guide, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="hand-left" size={14} color={p.accent} />
          <Text style={[styles.guideText, { color: p.ink }]}>
            이 화면을 시설 직원분께 보여주세요. 게시된 조건과 우리 아이 정보를 바로 대조할 수 있어요.
          </Text>
        </View>

        <View style={styles.carousel}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={cards.length > 1}
            onMomentumScrollEnd={(e) =>
              setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))
            }
            style={{ width: pageWidth }}>
            {cards.map(({ pet, verdict }) => (
              <PassportCard
                key={pet.petId}
                pet={pet}
                facility={facility}
                verdict={verdict}
                checkId={check.checkId}
                issuedAt={check.createdAt}
                confidence={conf.confidence}
                confidenceSource={conf.source}
                confirmedAt={conf.confirmedAt}
                width={pageWidth}
              />
            ))}
          </ScrollView>
        </View>

        {/* 여러 마리일 때만 페이지 표시 */}
        {cards.length > 1 && (
          <View style={styles.dots}>
            {cards.map(({ pet }, i) => (
              <View
                key={pet.petId}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === page ? p.accent : p.line,
                    width: i === page ? 18 : 6,
                  },
                ]}
              />
            ))}
            <Text style={[styles.dotLabel, { color: p.muted }]}>
              {cards[page]?.pet.name} · {page + 1}/{cards.length}
            </Text>
          </View>
        )}

        {/* 출입증을 보여줬는데도 거부당한 순간 — 가장 빠르게 손이 닿아야 하는 위치다 */}
        <View style={styles.denial}>
          <DenialReport facilityId={facilityId} />
        </View>

        <Text style={[styles.footer, { color: p.muted }]}>
          출입증은 판별 시점의 정보로 만들어집니다. 시설이 조건을 바꿨을 수 있으니
          현장 안내문과 다르면 제보해 주세요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingVertical: Spacing.lg, gap: Spacing.lg },
  guide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    marginHorizontal: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
    borderRadius: Radius.md,
  },
  guideText: { fontSize: 12.5, fontWeight: '600', lineHeight: 18, flexShrink: 1 },
  carousel: { alignItems: 'center' },
  denial: { alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.xl },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  dot: { height: 6, borderRadius: Radius.full },
  dotLabel: { fontSize: 11.5, fontWeight: '700', marginLeft: 8 },
  footer: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
