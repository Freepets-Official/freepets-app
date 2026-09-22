import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { CardShadow, Radius, Spacing, Type } from '@/constants/theme';
import type { Course } from '@/data/course';
import { formatDistance } from '@/data/mock';
import {
  CATEGORY_LABEL,
  type LikedCourse,
  type PresetCourse,
  type SimilarCourse,
} from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 추천 코스 카드 네 종 — 취향(liked) · 비슷한 곳(similar) · 프리셋 · 내가 고른 코스.
 *
 * `course.tsx`가 2000줄을 넘겨 갈라낸 조각이다. 넷 다 **props만 받아 그리는 카드**로,
 * 서로 다른 추천 소스를 같은 생김새로 보여주는 것이 이 파일의 일이다.
 */

export function LikedCourseCard({ course }: { course: LikedCourse }) {
  const p = usePalette();
  return (
    <View style={[styles.presetCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <Text style={[styles.presetTitle, { color: p.ink }]}>{course.title}</Text>
      {course.stops.map((st, i) => (
        <View key={st.facilityId} style={styles.presetStopBlock}>
          <View style={styles.presetStop}>
            <View style={[styles.presetOrder, { backgroundColor: p.accentSoft }]}>
              <Text style={[styles.presetOrderNum, { color: p.accent }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.presetStopName, { color: p.ink }]} numberOfLines={1}>
              {st.name}
            </Text>
            {st.isMealStop && (
              <Text style={[styles.mealTag, { backgroundColor: p.surface, color: p.muted }]}>식사</Text>
            )}
            <Text style={[styles.presetStopMeta, { color: p.muted, marginLeft: 'auto' }]}>
              {CATEGORY_LABEL[st.category]}
            </Text>
          </View>
          {!st.isMealStop && st.reasonPets.length > 0 && (
            <Text style={[styles.stopReason, { color: p.muted }]}>
              {st.reasonPets.map((rp) => `${rp.petName} ${rp.score.toFixed(1)}점`).join(' · ')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * 취향 비슷한 새곳 카드.
 *
 * `isPersonalized: false`면 취향 매치가 아니라 **리뷰 평점 기준 인기 코스**로 자동 전환된
 * 결과다. 그대로 "취향 기반"이라고 보여주면 사용자를 속이는 것이라, 제목 아래에 무엇을
 * 근거로 뽑았는지 밝힌다. 스톱별 `reason`은 서버 문구를 그대로 쓴다(재조합 금지).
 */
export function SimilarCourseCard({ course }: { course: SimilarCourse }) {
  const p = usePalette();
  return (
    <View style={[styles.presetCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <Text style={[styles.presetTitle, { color: p.ink }]}>{course.title}</Text>
      {!course.isPersonalized && (
        <Text style={[styles.coldStart, { color: p.muted }]}>
          아직 취향 데이터가 없어 평점이 좋은 곳으로 보여드려요.
        </Text>
      )}
      {course.stops.map((st, i) => (
        <View key={st.facilityId} style={styles.presetStopBlock}>
          <View style={styles.presetStop}>
            <View style={[styles.presetOrder, { backgroundColor: p.accentSoft }]}>
              <Text style={[styles.presetOrderNum, { color: p.accent }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.presetStopName, { color: p.ink }]} numberOfLines={1}>
              {st.name}
            </Text>
            {st.isMealStop && (
              <Text style={[styles.mealTag, { backgroundColor: p.surface, color: p.muted }]}>식사</Text>
            )}
          </View>
          {!!st.reason && <Text style={[styles.stopReason, { color: p.muted }]}>{st.reason}</Text>}
        </View>
      ))}
    </View>
  );
}

export function PresetCourseCard({ course }: { course: PresetCourse }) {
  const p = usePalette();
  return (
    <View style={[styles.presetCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <Text style={[styles.presetTitle, { color: p.ink }]}>{course.title}</Text>
      {course.stops.map((st, i) => (
        <View key={st.facilityId} style={styles.presetStop}>
          <View style={[styles.presetOrder, { backgroundColor: p.accentSoft }]}>
            <Text style={[styles.presetOrderNum, { color: p.accent }]}>{i + 1}</Text>
          </View>
          <Text style={[styles.presetStopName, { color: p.ink }]} numberOfLines={1}>
            {st.name}
          </Text>
          {st.isMealStop && (
            <Text style={[styles.mealTag, { backgroundColor: p.surface, color: p.muted }]}>식사</Text>
          )}
          <Text style={[styles.presetStopMeta, { color: p.muted, marginLeft: 'auto' }]}>
            {CATEGORY_LABEL[st.category]}
            {i > 0 ? ` · ${formatDistance(st.distanceM)}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function CoursePickCard({
  course,
  highlight,
  onPress,
}: {
  course: Course;
  highlight?: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  const { facilityById } = useAppStore();
  const stops = course.stopIds.map((id) => facilityById(id)?.name).filter(Boolean);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickCard,
        CardShadow,
        {
          backgroundColor: highlight ? p.accentSoft : p.card,
          borderColor: highlight ? p.accent : p.line,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View style={styles.pickCardTop}>
        <Ionicons
          name={course.source === 'RECOMMENDED' ? 'heart' : 'map'}
          size={15}
          color={p.accent}
        />
        <Text style={[styles.pickCardName, { color: p.ink }]}>{course.name}</Text>
      </View>
      {course.description && (
        <Text style={[styles.pickCardDesc, { color: p.muted }]}>{course.description}</Text>
      )}
      <Text style={[styles.pickCardStops, { color: p.accent }]} numberOfLines={1}>
        {stops.join(' → ')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  presetCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: 10 },
  presetTitle: { fontSize: Type.callout, fontWeight: '800', letterSpacing: -0.3 },
  presetStop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  presetStopBlock: { gap: 3 },
  stopReason: { fontSize: Type.caption, lineHeight: 17, paddingLeft: 30 },
  coldStart: { fontSize: Type.footnote, lineHeight: 18 },
  presetOrder: {
    width: 22, height: 22, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  presetOrderNum: { fontSize: Type.caption, fontWeight: '800' },
  presetStopName: { fontSize: Type.bodyLg, fontWeight: '700', flexShrink: 1 },
  presetStopMeta: { fontSize: Type.caption, fontVariant: ['tabular-nums'] },
  mealTag: {
    fontSize: Type.micro, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.sm, overflow: 'hidden',
  },
  pickCard: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.lg, gap: 5 },
  pickCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pickCardName: { fontSize: Type.callout, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  pickCardDesc: { fontSize: Type.footnote, lineHeight: 18 },
  pickCardStops: { fontSize: Type.footnote, fontWeight: '700' },
});
