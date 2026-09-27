import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ResultBadge } from '@/components/badge';
import { Text } from '@/components/text';
import { CardShadow, Radius, Spacing, Type } from '@/constants/theme';
import { validateCourse, type StopResult } from '@/data/course';
import { formatDistance } from '@/data/mock';
import { CATEGORY_LABEL, RESULT_LABEL, type CourseCheckResult } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';

/**
 * 코스 판별의 버튼·결과 화면들.
 *
 * `course.tsx`가 2000줄을 넘겨 갈라낸 조각이다. 여기 있는 것은 전부 **props만 받아 그리는
 * 컴포넌트**다 — 상태도 서버 호출도 없다. 코스 화면이 무엇을 언제 부를지 정하고, 이 파일은
 * 받은 결과를 어떻게 보일지만 정한다.
 */

export function SaveCourseAction({ running, onPress }: { running: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={running}
      style={({ pressed }) => [
        styles.saveBtn,
        { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
      ]}>
      {running ? (
        <ActivityIndicator color={p.muted} size="small" />
      ) : (
        <>
          <Ionicons name="bookmark-outline" size={15} color={p.muted} />
          <Text style={[styles.saveBtnText, { color: p.muted }]}>내 코스에 담기</Text>
        </>
      )}
    </Pressable>
  );
}

export function CourseCheckAction({
  label,
  disabled,
  running,
  onPress,
  error,
}: {
  label: string;
  disabled: boolean;
  running: boolean;
  onPress: () => void;
  /** 이 버튼으로 낸 판별이 실패했을 때의 문구. 버튼 바로 아래에 붙어야 사용자가 본다. */
  error?: string | null;
}) {
  const p = usePalette();
  return (
    <>
    <Pressable
      onPress={onPress}
      disabled={disabled || running}
      style={({ pressed }) => [
        styles.courseCheckBtn,
        {
          borderColor: disabled ? p.line : p.accent,
          backgroundColor: pressed && !disabled ? p.accentSoft : 'transparent',
        },
      ]}>
      {running ? (
        <ActivityIndicator color={p.accent} size="small" />
      ) : (
        <Text style={[styles.courseCheckBtnText, { color: disabled ? p.muted : p.accent }]}>
          {disabled ? '데려갈 아이를 골라 주세요' : label}
        </Text>
      )}
    </Pressable>
    {error && <Text style={[styles.courseCheckError, { color: p.muted }]}>{error}</Text>}
    </>
  );
}

export function CourseCheckPanel({ result }: { result: CourseCheckResult }) {
  const p = usePalette();
  const router = useRouter();
  /**
   * 스톱을 누르면 시설 상세로 간다.
   *
   * 「조건부」가 왜 조건부인지 확인하려면 시설이 게시한 원문을 봐야 하는데, 코스 판별
   * 응답에는 원문이 없다(FacilitySummary는 id·이름·카테고리뿐). 그래서 지금까지는
   * 코스를 벗어나 시설을 다시 검색해 들어갔다가 돌아와야 했다. 뒤로가기로 코스에
   * 그대로 돌아오므로 판별 결과도 남는다.
   */
  const openFacility = (facilityId: number) =>
    router.push({
      pathname: '/facility/[id]',
      params: { id: String(facilityId) },
    });
  const tone =
    result.overall === 'DENIED' ? p.danger : result.overall === 'CONDITIONAL' ? p.warn : p.success;
  return (
    <View style={[styles.checkPanel, { borderColor: p.line, backgroundColor: p.surface }]}>
      <View style={styles.checkHead}>
        <Text style={[styles.checkOverall, { color: tone }]}>{RESULT_LABEL[result.overall]}</Text>
        {result.blockedCount > 0 && (
          <Text style={[styles.checkSub, { color: p.muted }]}>
            못 가는 곳 {result.blockedCount}곳
          </Text>
        )}
        <Text style={[styles.checkSub, { color: p.muted, marginLeft: 'auto' }]}>
          시간은 예상(참고용)
        </Text>
      </View>

      {result.stops.map((st) => (
        <Pressable
          key={st.facility.facilityId}
          onPress={() => openFacility(st.facility.facilityId)}
          style={({ pressed }) => [styles.checkStop, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.checkTime, { color: p.muted }]}>{st.time}</Text>
          <View style={styles.checkStopBody}>
            <View style={styles.checkStopHead}>
              <Text style={[styles.checkStopName, { color: p.ink }]} numberOfLines={1}>
                {st.facility.name}
              </Text>
              <ResultBadge result={st.overall} />
              <Ionicons name="chevron-forward" size={15} color={p.muted} />
            </View>
            {st.verdicts.map((v) => (
              <Text key={v.petId} style={[styles.checkReason, { color: p.muted }]}>
                {v.petName ? `${v.petName} · ` : ''}
                {v.reason}
              </Text>
            ))}
            {st.overall === 'DENIED' &&
              (st.alternative ? (
                <Text style={[styles.checkAlt, { color: p.accent }]}>
                  대신 {st.alternative.name} ({st.alternative.distanceKm.toFixed(1)}km)
                </Text>
              ) : (
                <Text style={[styles.checkAlt, { color: p.muted }]}>
                  가까운 곳 중엔 대체할 만한 시설을 찾지 못했어요. 이 스톱은 빼는 걸 권해요.
                </Text>
              ))}
            <Text style={[styles.checkOpen, { color: p.accent }]}>눌러서 시설 조건 원문 보기</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function CourseResultView({
  result,
  petCount,
  onSwap,
}: {
  result: ReturnType<typeof validateCourse>;
  petCount: number;
  onSwap: (fromId: number, toId: number) => void;
}) {
  const p = usePalette();

  const tone = {
    ALLOWED: { color: p.success, soft: p.successSoft },
    CONDITIONAL: { color: p.warn, soft: p.warnSoft },
    DENIED: { color: p.danger, soft: p.dangerSoft },
  }[result.overall];

  const summary =
    result.overall === 'ALLOWED'
      ? petCount > 1
        ? '모든 스톱에 다 함께 갈 수 있어요'
        : '모든 스톱에 갈 수 있어요'
      : result.overall === 'CONDITIONAL'
        ? '조건만 지키면 코스 전체를 돌 수 있어요'
        : `${result.blockedCount}곳에서 막혀요 — 아래 대체를 확인하세요`;

  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.resultWrap}>
      <View style={[styles.resultBanner, { backgroundColor: tone.soft, borderColor: tone.color }]}>
        <Text style={[styles.resultTitle, { color: tone.color }]}>{summary}</Text>
        <ResultBadge result={result.overall} />
      </View>

      {result.stops.map((s, i) => (
        <StopResultCard key={s.facility.facilityId} stop={s} index={i} onSwap={onSwap} />
      ))}
    </Animated.View>
  );
}

export function StopResultCard({
  stop,
  index,
  onSwap,
}: {
  stop: StopResult;
  index: number;
  onSwap: (fromId: number, toId: number) => void;
}) {
  const p = usePalette();
  const denied = stop.group.overall === 'DENIED';
  const tone = {
    ALLOWED: p.success,
    CONDITIONAL: p.warn,
    DENIED: p.danger,
  }[stop.group.overall];

  return (
    <View style={[styles.resCard, CardShadow, { backgroundColor: p.card, borderColor: denied ? p.danger : p.line }]}>
      <View style={styles.resTop}>
        <View style={styles.resTime}>
          <Ionicons name="time-outline" size={13} color={p.muted} />
          <Text style={[styles.resTimeText, { color: p.muted }]}>{stop.time}</Text>
        </View>
        <ResultBadge result={stop.group.overall} />
      </View>
      <Text style={[styles.resName, { color: p.ink }]}>
        {index + 1}. {stop.facility.name}
      </Text>

      {/* 아이별 결과 */}
      <View style={styles.resVerdicts}>
        {stop.group.verdicts.map((v) => {
          const vTone = { ALLOWED: p.success, CONDITIONAL: p.warn, DENIED: p.danger }[v.result];
          return (
            <View key={v.petId} style={styles.resVerdictRow}>
              <Ionicons
                name={
                  v.result === 'ALLOWED'
                    ? 'checkmark-circle'
                    : v.result === 'CONDITIONAL'
                      ? 'alert-circle'
                      : 'close-circle'
                }
                size={15}
                color={vTone}
              />
              <Text style={[styles.resReason, { color: p.ink }]}>{v.reason}</Text>
            </View>
          );
        })}
      </View>

      {/* 막힌 스톱의 대체 제안 */}
      {denied && stop.alternative && (
        <View style={[styles.altBox, { backgroundColor: p.successSoft, borderColor: p.success }]}>
          <View style={styles.altHead}>
            <Ionicons name="swap-horizontal" size={15} color={p.success} />
            <Text style={[styles.altLabel, { color: p.success }]}>이렇게 바꾸면 다 함께 갈 수 있어요</Text>
          </View>
          <Text style={[styles.altName, { color: p.ink }]}>{stop.alternative.name}</Text>
          <Text style={[styles.altMeta, { color: p.muted }]}>
            {CATEGORY_LABEL[stop.alternative.category]} · {formatDistance(stop.alternative.distanceM)}
          </Text>
          <Pressable
            onPress={() => onSwap(stop.facility.facilityId, stop.alternative!.facilityId)}
            style={({ pressed }) => [
              styles.altBtn,
              { backgroundColor: pressed ? p.successSoft : p.card, borderColor: p.success },
            ]}>
            <Text style={[styles.altBtnText, { color: p.success }]}>이 곳으로 바꾸기</Text>
          </Pressable>
        </View>
      )}
      {denied && !stop.alternative && (
        <Text style={[styles.noAlt, { color: p.muted }]}>
          같은 성격의 대체 시설을 찾지 못했어요. 이 스톱은 빼는 것을 권장해요.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: 9, marginTop: 4,
  },
  saveBtnText: { fontSize: Type.footnote, fontWeight: '700' },
  courseCheckBtn: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingVertical: 9, alignItems: 'center', marginTop: 4,
  },
  courseCheckBtnText: { fontSize: Type.body, fontWeight: '800' },
  courseCheckError: { fontSize: Type.footnote, marginTop: 4, paddingHorizontal: 2 },
  checkPanel: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, gap: 10, marginTop: 6 },
  checkHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  checkOverall: { fontSize: Type.bodyLg, fontWeight: '800' },
  checkSub: { fontSize: Type.caption },
  checkStop: { flexDirection: 'row', gap: 10 },
  checkTime: { fontSize: Type.caption, fontWeight: '700', width: 42, fontVariant: ['tabular-nums'] },
  checkStopBody: { flex: 1, gap: 3 },
  checkStopHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkStopName: { fontSize: Type.body, fontWeight: '700', flexShrink: 1 },
  checkReason: { fontSize: Type.caption, lineHeight: 17 },
  checkOpen: { fontSize: Type.footnote, fontWeight: '700', marginTop: 4 },
  checkAlt: { fontSize: Type.caption, lineHeight: 17, fontWeight: '600' },
  resultWrap: { gap: Spacing.md },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  resultTitle: { fontSize: Type.cardTitle, fontWeight: '900', letterSpacing: -0.4, flexShrink: 1 },
  resCard: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.lg, gap: 7 },
  resTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resTimeText: { fontSize: Type.footnote, fontWeight: '700', fontVariant: ['tabular-nums'] },
  resName: { fontSize: Type.cardTitle, fontWeight: '800', letterSpacing: -0.4 },
  resVerdicts: { gap: 5, marginTop: 2 },
  resVerdictRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  resReason: { fontSize: Type.footnote, lineHeight: 18, flexShrink: 1 },
  altBox: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, gap: 3, marginTop: 4 },
  altHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  altLabel: { fontSize: Type.footnote, fontWeight: '800' },
  altName: { fontSize: Type.bodyLg, fontWeight: '800', marginTop: 2 },
  altMeta: { fontSize: Type.footnote },
  altBtn: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 10,
    marginTop: 6,
  },
  altBtnText: { fontSize: Type.body, fontWeight: '800' },
  noAlt: { fontSize: Type.footnote, lineHeight: 18, marginTop: 4 },
});
