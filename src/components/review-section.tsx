import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PawBadge } from '@/components/paw-badge';
import { SectionTitle } from '@/components/section-title';
import { StarsDisplay } from '@/components/star-rating';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import {
  PET_KIND_LABEL,
  REVIEW_TAG_LABEL,
  pawGradeOf,
  type Review,
  type ReviewTag,
} from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import {
  REVIEW_REPORT_REASON_LABEL,
  useAppStore,
  type ReviewReportReason,
} from '@/store/app-store';

const REASONS = Object.keys(REVIEW_REPORT_REASON_LABEL) as ReviewReportReason[];

function avg(rs: Review[], pick: (r: Review) => number): number {
  return rs.length ? rs.reduce((s, r) => s + pick(r), 0) / rs.length : 0;
}

/** 카드용 한 줄 요약 — "말티즈 3.4kg, 골든리트리버 28kg" (넘치면 …로 잘림) */
function petSummary(r: Review): string {
  return r.pets.map((pi) => `${pi.species}${pi.weight > 0 ? ` ${pi.weight}kg` : ''}`).join(', ');
}

function topTags(rs: Review[], limit = 4): { tag: ReviewTag; count: number }[] {
  const counts = new Map<ReviewTag, number>();
  rs.forEach((r) => r.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function ReviewSection({
  reviews,
  canWrite,
  onWrite,
}: {
  reviews: Review[];
  canWrite: boolean;
  onWrite: () => void;
}) {
  const p = usePalette();
  const { reportedReviewIds, reportReview, myUserId, removeReview } = useAppStore();
  const [reportTarget, setReportTarget] = useState<Review | null>(null);
  const [detailTarget, setDetailTarget] = useState<Review | null>(null);

  // 신고된 리뷰는 등급 산정에서만 빠지고 목록에는 그대로 남는다 (docs/04 4-2)
  const scored = reviews.filter((r) => !reportedReviewIds.has(r.reviewId));
  const grade = pawGradeOf(scored);
  const tags = topTags(scored);
  const written = reviews.filter((r) => r.content);

  const rows: { label: string; value: number }[] = [
    { label: '공간 여유', value: avg(scored, (r) => r.ratingSpace) },
    { label: '직원 친절도', value: avg(scored, (r) => r.ratingStaff) },
    { label: '편의시설', value: avg(scored, (r) => r.ratingAmenity) },
  ];

  return (
    <>
      <SectionTitle title="반려동물 친화도" caption={`리뷰 ${scored.length}건`} />

      <View style={[styles.summary, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
        <View style={styles.gradeRow}>
          <PawBadge grade={grade} size="lg" />
          {grade.score !== null && (
            <Text style={[styles.score, { color: p.muted }]}>{grade.score.toFixed(0)}점</Text>
          )}
        </View>

        {grade.level === null && grade.needMore > 0 && (
          <Text style={[styles.pendingHint, { color: p.muted }]}>
            리뷰 {grade.needMore}건이 더 모이면 발자국 등급이 부여돼요.
          </Text>
        )}

        <View style={[styles.ratings, { borderTopColor: p.line }]}>
          {rows.map((row) => (
            <View key={row.label} style={styles.ratingRow}>
              <Text style={[styles.ratingLabel, { color: p.muted }]}>{row.label}</Text>
              <View style={styles.ratingRight}>
                <StarsDisplay value={row.value} />
                <Text style={[styles.ratingValue, { color: p.ink }]}>{row.value.toFixed(1)}</Text>
              </View>
            </View>
          ))}
        </View>

        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map(({ tag, count }) => (
              <View key={tag} style={[styles.tag, { backgroundColor: p.surface, borderColor: p.line }]}>
                <Text style={[styles.tagText, { color: p.ink }]}>{REVIEW_TAG_LABEL[tag]}</Text>
                <Text style={[styles.tagCount, { color: p.muted }]}>{count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Pressable
        onPress={onWrite}
        style={({ pressed }) => [
          styles.writeButton,
          {
            borderColor: canWrite ? p.accent : p.line,
            backgroundColor: pressed && canWrite ? p.accentSoft : 'transparent',
          },
        ]}>
        <Ionicons
          name={canWrite ? 'create' : 'lock-closed'}
          size={16}
          color={canWrite ? p.accent : p.muted}
        />
        <Text style={[styles.writeLabel, { color: canWrite ? p.accent : p.muted }]}>
          {canWrite ? '리뷰 쓰기' : 'AI 판별 후에 리뷰를 쓸 수 있어요'}
        </Text>
      </Pressable>

      {written.slice(0, 3).map((r) => {
        const reported = reportedReviewIds.has(r.reviewId);
        return (
          <Pressable
            key={r.reviewId}
            onPress={() => setDetailTarget(r)}
            style={({ pressed }) => [
              styles.review,
              { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.94 : 1 },
            ]}>
            <View style={styles.reviewTop}>
              <View style={styles.reviewer}>
                <Text style={[styles.nickname, { color: p.ink }]}>{r.nickname}</Text>
                {r.pets.length > 0 && (
                  <Text style={[styles.petName, { color: p.muted }]} numberOfLines={1}>
                    {petSummary(r)}
                  </Text>
                )}
              </View>
              <StarsDisplay
                value={(r.ratingSpace + r.ratingStaff + r.ratingAmenity) / 3}
                size={13}
              />
            </View>
            {r.content && <Text style={[styles.reviewText, { color: p.ink }]}>{r.content}</Text>}
            {r.tags.length > 0 && (
              <View style={styles.reviewTags}>
                {r.tags.map((t) => (
                  <Text key={t} style={[styles.reviewTag, { color: p.accent }]}>
                    #{REVIEW_TAG_LABEL[t]}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.reviewFoot}>
              <Text style={[styles.visited, { color: p.muted }]}>{r.visitedAt} 방문</Text>
              {r.userId === myUserId ? (
                // 내 리뷰 — 신고 대신 삭제
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    removeReview(r.reviewId);
                  }}
                  hitSlop={8}>
                  <Text style={[styles.reportLink, { color: p.danger }]}>삭제</Text>
                </Pressable>
              ) : reported ? (
                <Text style={[styles.reportedMark, { color: p.warn }]}>
                  신고 접수 · 등급 산정 제외
                </Text>
              ) : (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setReportTarget(r);
                  }}
                  hitSlop={8}>
                  <Text style={[styles.reportLink, { color: p.muted }]}>신고</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        );
      })}

      <Modal
        visible={reportTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReportTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setReportTarget(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: p.card }]}
            onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: p.ink }]}>이 리뷰를 신고하는 이유는?</Text>
            <Text style={[styles.sheetBody, { color: p.muted }]}>
              신고해도 리뷰가 바로 지워지지는 않아요. 검토 전까지 발자국 등급 계산에서만 빠집니다.
            </Text>

            {REASONS.map((reason) => (
              <Pressable
                key={reason}
                onPress={() => {
                  if (reportTarget) reportReview(reportTarget.reviewId, reason);
                  setReportTarget(null);
                }}
                style={({ pressed }) => [
                  styles.reasonRow,
                  { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
                ]}>
                <Text style={[styles.reasonText, { color: p.ink }]}>
                  {REVIEW_REPORT_REASON_LABEL[reason]}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={p.muted} />
              </Pressable>
            ))}

            <Pressable onPress={() => setReportTarget(null)} style={styles.cancel}>
              <Text style={[styles.cancelText, { color: p.muted }]}>취소</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 리뷰 상세 — 함께 방문한 아이들의 종류·품종·몸무게가 전부 보인다 */}
      <Modal
        visible={detailTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetailTarget(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: p.card }]} onPress={(e) => e.stopPropagation()}>
            {detailTarget && (
              <>
                <View style={styles.detailHead}>
                  <Text style={[styles.sheetTitle, { color: p.ink }]}>{detailTarget.nickname}</Text>
                  <StarsDisplay
                    value={(detailTarget.ratingSpace + detailTarget.ratingStaff + detailTarget.ratingAmenity) / 3}
                    size={14}
                  />
                </View>

                {detailTarget.pets.length > 0 ? (
                  <View style={[styles.detailPets, { borderColor: p.line }]}>
                    <Text style={[styles.detailPetsLabel, { color: p.muted }]}>함께 방문한 아이</Text>
                    {detailTarget.pets.map((pi, i) => (
                      <View key={i} style={styles.detailPetRow}>
                        <Ionicons name="paw" size={13} color={p.accent} />
                        <Text style={[styles.detailPetText, { color: p.ink }]}>
                          {PET_KIND_LABEL[pi.kind]} · {pi.species}
                          {pi.weight > 0 ? ` · ${pi.weight}kg` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.sheetBody, { color: p.muted }]}>
                    반려동물 정보는 비공개된 리뷰예요.
                  </Text>
                )}

                {detailTarget.content && (
                  <Text style={[styles.detailContent, { color: p.ink }]}>{detailTarget.content}</Text>
                )}
                {detailTarget.tags.length > 0 && (
                  <View style={styles.reviewTags}>
                    {detailTarget.tags.map((t) => (
                      <Text key={t} style={[styles.reviewTag, { color: p.accent }]}>
                        #{REVIEW_TAG_LABEL[t]}
                      </Text>
                    ))}
                  </View>
                )}
                <Text style={[styles.visited, { color: p.muted }]}>{detailTarget.visitedAt} 방문</Text>
              </>
            )}
            <Pressable onPress={() => setDetailTarget(null)} style={styles.cancel}>
              <Text style={[styles.cancelText, { color: p.muted }]}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, gap: Spacing.md },
  gradeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pendingHint: { fontSize: 12.5, lineHeight: 19 },
  ratings: { borderTopWidth: 1, paddingTop: Spacing.md, gap: 9 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingLabel: { fontSize: 13, fontWeight: '600' },
  ratingRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ratingValue: { fontSize: 12.5, fontWeight: '800', fontVariant: ['tabular-nums'], width: 24 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { fontSize: 12, fontWeight: '700' },
  tagCount: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 13,
  },
  writeLabel: { fontSize: 14, fontWeight: '800' },
  review: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: 7 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewer: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  nickname: { fontSize: 14, fontWeight: '800' },
  petName: { fontSize: 11.5 },
  reviewText: { fontSize: 13.5, lineHeight: 20 },
  reviewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reviewTag: { fontSize: 12, fontWeight: '700' },
  reviewFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  visited: { fontSize: 11 },
  reportLink: { fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  reportedMark: { fontSize: 11, fontWeight: '700' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  sheetTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  sheetBody: { fontSize: 12.5, lineHeight: 19, marginBottom: Spacing.sm },
  detailHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailPets: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: 6, marginTop: 4 },
  detailPetsLabel: { fontSize: 11.5, fontWeight: '800' },
  detailPetRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailPetText: { fontSize: 13.5, fontWeight: '700' },
  detailContent: { fontSize: 14, lineHeight: 21, marginTop: 4 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  reasonText: { fontSize: 14, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: 4 },
  cancelText: { fontSize: 14, fontWeight: '700' },
});
