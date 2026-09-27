import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { CardShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { ApiError, adminApi, type ReportedReview, type ReportStatus } from '@/lib/api';
import { confirmDialog } from '@/lib/notify';
import { REVIEW_REPORT_REASON_LABEL } from '@/store/app-store';

/**
 * 리뷰 신고 처리 — 운영자 화면.
 *
 * 사용자가 리뷰를 신고하면(`POST /reviews/{id}/report`) 여기서 사람이 보고 숨기거나 반려한다.
 * 자동 조치를 두지 않는 이유는 `docs/04`가 정한 대로다 — 발자국 등급이 사업자에게 이해관계가
 * 되는 순간 조직적 신고가 들어올 수 있어, 건수만으로는 방어할 수 없다.
 *
 * **판단 대상은 신고가 아니라 리뷰다.** 서버도 그렇게 묶어서 준다(한 리뷰에 신고 셋이면
 * 항목 하나에 `reportCount: 3`). 그래서 카드의 주인공은 신고 사유가 아니라 **리뷰 본문**이다 —
 * 사유는 참고일 뿐, 실제로 숨길지는 글을 읽고 정한다.
 *
 * 권한은 서버만 안다(`useIsAdmin` 주석 참고). 일반 계정이 부르면 403이 오고, 이 화면은 그걸
 * 그대로 보여준다.
 */

const FILTERS: { key: ReportStatus; label: string; empty: string }[] = [
  { key: 'PENDING', label: '대기', empty: '처리할 신고가 없어요.' },
  { key: 'ACCEPTED', label: '숨김', empty: '숨긴 리뷰가 없어요.' },
  { key: 'REJECTED', label: '반려', empty: '반려한 신고가 없어요.' },
];

/** 서버 상한은 50이다. 그보다 크게 보내면 조용히 잘려 `hasNext`와 실제 개수가 어긋나 보인다 */
const PAGE_SIZE = 20;

export default function AdminReportsScreen() {
  const p = usePalette();
  const [filter, setFilter] = useState<ReportStatus>('PENDING');
  const [reviews, setReviews] = useState<ReportedReview[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** 실패는 문구만이 아니라 **왜 실패했는지**까지 들고 있어야 한다 — 403은 재시도가 소용없다 */
  const [failed, setFailed] = useState<{ message: string; forbidden: boolean } | null>(null);
  /** 처리 중인 리뷰. 버튼을 두 번 눌러 같은 리뷰가 두 번 처리되지 않게 한다 */
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null);

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else {
        setReviews(null);
        setFailed(null);
      }
      try {
        const r = await adminApi.reviewReports({ status: filter, page: nextPage, size: PAGE_SIZE });
        setReviews((prev) => {
          if (!append || !prev) return r.reviews;
          // 이미 들고 있는 것은 거른다 — 아래 `더 보기`가 겹치는 페이지를 일부러 다시 받는다
          const seen = new Set(prev.map((x) => x.reviewId));
          return [...prev, ...r.reviews.filter((x) => !seen.has(x.reviewId))];
        });
        setTotal(r.totalElements);
        setHasNext(r.hasNext);
      } catch (e) {
        setFailed({
          message: e instanceof Error ? e.message : '목록을 불러오지 못했어요',
          forbidden: e instanceof ApiError && e.status === 403,
        });
        if (!append) setReviews([]);
      } finally {
        setLoadingMore(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  /**
   * 처리한 줄을 목록에서 **바로 지운다.**
   *
   * 매장 심사(`admin/claims`)는 상태 뱃지만 바꾸고 줄을 남기는데, 여기서는 지운다. 처리하고 나면
   * 그 리뷰는 지금 보고 있는 목록의 조건에 더 이상 맞지 않고(대기 → 숨김/반려), 남겨 두면 다음
   * 페이지를 더 불러올 때 같은 리뷰가 두 번 그려진다. 무엇을 처리했는지는 아래 알림이 말해 준다.
   */
  const drop = (reviewId: number) => {
    setReviews((prev) => (prev ?? []).filter((r) => r.reviewId !== reviewId));
    setTotal((t) => Math.max(0, t - 1));
  };

  /**
   * 「더 보기」가 받아올 페이지. **`page + 1`이 아니라 지금 들고 있는 개수로 센다.**
   *
   * 처리한 줄은 목록에서 빠지는데, 서버 목록에서도 같이 빠진다(대기 → 숨김/반려). 20건을
   * 받아 3건을 처리했으면 서버의 21번째였던 항목이 18번째로 당겨져 있어, `page=1`(21번째부터)을
   * 부르면 **세 건을 건너뛴다.** 들고 있는 17건을 기준으로 page 0을 다시 받고 겹치는 것은
   * 위에서 걸러낸다 — 17건을 덤으로 받지만 빠뜨리는 것보다 낫다.
   */
  const nextPage = Math.floor((reviews?.length ?? 0) / PAGE_SIZE);

  /**
   * 승인·반려·되돌리기가 전부 같은 모양이다 — 본문 없는 POST 하나에 처리된 신고 수가 온다.
   *
   * 409(`REVIEW4006`/`REVIEW4007`)는 **두 운영자가 같은 리뷰를 동시에 처리했다는 뜻**이다.
   * 장애가 아니라 이미 끝난 일이므로, 실패를 알리되 그 줄도 목록에서 뺀다 — 남겨 두면 눌러도
   * 계속 409만 난다.
   */
  const act = async (
    r: ReportedReview,
    kind: 'accept' | 'reject' | 'revert',
    confirmTitle: string,
    confirmBody: string,
    confirmLabel: string,
    doneText: string,
  ) => {
    if (!(await confirmDialog(confirmTitle, confirmBody, confirmLabel))) return;
    setBusyId(r.reviewId);
    setNotice(null);
    try {
      const count =
        kind === 'accept'
          ? await adminApi.acceptReport(r.reviewId)
          : kind === 'reject'
            ? await adminApi.rejectReport(r.reviewId)
            : await adminApi.revertReport(r.reviewId);
      drop(r.reviewId);
      setNotice({ text: `${r.facilityName} · ${doneText} (신고 ${count}건)`, failed: false });
    } catch (e) {
      // 409면 이미 처리된 신고다 — 다른 운영자가 먼저 눌렀다. 코드로 본다:
      // 서버 문구는 언제든 바뀌고, 문자열로 맞히면 바뀐 날 조용히 틀린다
      if (e instanceof ApiError && e.status === 409) drop(r.reviewId);
      setNotice({ text: e instanceof Error ? e.message : '처리하지 못했어요', failed: true });
    } finally {
      setBusyId(null);
    }
  };

  const accept = (r: ReportedReview) =>
    act(
      r,
      'accept',
      '이 리뷰를 숨길까요?',
      `${r.facilityName}의 리뷰가 목록에서 사라지고, 시설의 발자국 등급 계산에서도 빠져요. 나중에 「숨김」 탭에서 되돌릴 수 있어요.`,
      '숨기기',
      '숨김 처리',
    );

  const reject = (r: ReportedReview) =>
    act(
      r,
      'reject',
      '이 신고를 반려할까요?',
      '리뷰는 그대로 두고 신고만 기각해요. 같은 사람이 이 리뷰를 다시 신고할 수는 없어요.',
      '반려',
      '신고 반려',
    );

  const revert = (r: ReportedReview) =>
    act(
      r,
      'revert',
      '이 리뷰를 다시 보이게 할까요?',
      '리뷰가 목록과 등급 계산에 다시 들어가요. 신고는 「대기」로 돌아가니, 숨김/반려로 한 번 더 끝맺어 주세요.',
      '다시 노출',
      '다시 노출',
    );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '리뷰 신고 처리', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <Text style={[styles.title, { color: p.ink }]}>리뷰 신고 처리</Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            신고 건수가 아니라 <Text style={{ fontWeight: '800', color: p.ink }}>글을 읽고</Text>{' '}
            판단해 주세요. 숨기면 시설의 발자국 등급에서도 빠져요.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((f) => (
              <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </ScrollView>

          {reviews !== null && !failed && (
            <Text style={[styles.count, { color: p.muted }]}>
              리뷰 {total.toLocaleString()}건
              {reviews.length < total ? ` · ${reviews.length}건 불러옴` : ''}
            </Text>
          )}

          {reviews === null ? (
            <LoadState kind="loading" size="page" />
          ) : failed ? (
            // 403은 장애가 아니라 "당신 화면이 아니다"다. 다시 눌러도 그대로라 재시도를 권하지 않는다
            <LoadState
              kind="failed"
              icon={failed.forbidden ? 'lock-closed-outline' : undefined}
              message={failed.message}
              onRetry={failed.forbidden ? undefined : () => void load(0, false)}
            />
          ) : reviews.length === 0 ? (
            <LoadState
              kind="empty"
              icon="checkmark-done-outline"
              message={FILTERS.find((f) => f.key === filter)?.empty ?? '해당하는 신고가 없어요.'}
            />
          ) : (
            <View style={styles.list}>
              {reviews.map((r) => (
                <ReportCard
                  key={r.reviewId}
                  review={r}
                  status={filter}
                  busy={busyId === r.reviewId}
                  onAccept={() => void accept(r)}
                  onReject={() => void reject(r)}
                  onRevert={() => void revert(r)}
                />
              ))}

              {hasNext && (
                <Pressable
                  onPress={() => void load(nextPage, true)}
                  disabled={loadingMore}
                  style={({ pressed }) => [
                    styles.more,
                    { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
                  ]}>
                  {loadingMore ? (
                    <ActivityIndicator color={p.accent} size="small" />
                  ) : (
                    <Text style={[styles.moreText, { color: p.accent }]}>더 보기</Text>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {notice && (
        <Pressable
          onPress={() => setNotice(null)}
          accessibilityLiveRegion="polite"
          style={[
            styles.notice,
            notice.failed
              ? { backgroundColor: p.dangerSoft, borderColor: p.danger }
              : { backgroundColor: p.successSoft, borderColor: p.success },
          ]}>
          <Ionicons
            name={notice.failed ? 'alert-circle' : 'checkmark-circle'}
            size={17}
            color={notice.failed ? p.danger : p.success}
          />
          <Text style={[styles.noticeText, { color: notice.failed ? p.danger : p.ink }]}>{notice.text}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

/** `2026-09-20T10:00:00` → `09.20` */
function shortDate(iso: string): string {
  return iso ? iso.slice(5, 10).replace('-', '.') : '—';
}

function ReportCard({
  review: r,
  status,
  busy,
  onAccept,
  onReject,
  onRevert,
}: {
  review: ReportedReview;
  status: ReportStatus;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onRevert: () => void;
}) {
  const p = usePalette();
  const reasons = Object.entries(r.reasonCounts) as [keyof typeof REVIEW_REPORT_REASON_LABEL, number][];
  const ratings = [r.ratingSpace, r.ratingStaff, r.ratingAmenity].filter(
    (n): n is number => typeof n === 'number',
  );
  const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  return (
    <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <View style={styles.cardHead}>
        <View style={styles.cardTitle}>
          <Text style={[styles.facility, { color: p.ink }]} numberOfLines={1}>
            {r.facilityName}
          </Text>
          <Text style={[styles.byline, { color: p.muted }]} numberOfLines={1}>
            {r.authorNickname} · {shortDate(r.reviewCreatedAt)} 작성
            {avg !== null ? ` · 평점 ${avg.toFixed(1)}` : ''}
          </Text>
        </View>
        {/* 건수는 눈에 띄게 — 같은 리뷰에 신고가 몰렸다면 먼저 볼 이유가 된다 */}
        <View style={[styles.countChip, { borderColor: p.danger, backgroundColor: p.dangerSoft }]}>
          <Ionicons name="flag" size={12} color={p.danger} />
          <Text style={[styles.countChipText, { color: p.danger }]}>{r.reportCount}</Text>
        </View>
      </View>

      {/* 판단의 대상. 자르지 않는다 — 접어 두면 안 읽고 누르게 된다 */}
      <Text style={[styles.reviewBody, { color: p.ink, backgroundColor: p.surface }]}>
        {r.content || '(본문 없는 리뷰)'}
      </Text>

      {!!r.photoUrl && (
        <Image source={{ uri: r.photoUrl }} style={styles.photo} contentFit="cover" transition={150} />
      )}

      <View style={styles.reasons}>
        {reasons.map(([code, n]) => (
          <View key={code} style={[styles.reasonChip, { borderColor: p.line, backgroundColor: p.surface }]}>
            <Text style={[styles.reasonText, { color: p.muted }]}>
              {REVIEW_REPORT_REASON_LABEL[code]} {n}
            </Text>
          </View>
        ))}
        <Text style={[styles.first, { color: p.muted }]}>{shortDate(r.firstReportedAt)} 첫 신고</Text>
      </View>

      <View style={styles.actions}>
        {busy ? (
          <ActivityIndicator color={p.accent} style={{ paddingVertical: 8 }} />
        ) : status === 'PENDING' ? (
          <>
            <Pressable
              onPress={onReject}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
              ]}>
              <Text style={[styles.btnText, { color: p.muted }]}>반려</Text>
            </Pressable>
            <Pressable
              onPress={onAccept}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: p.danger, backgroundColor: pressed ? p.dangerSoft : 'transparent' },
              ]}>
              <Text style={[styles.btnText, { color: p.danger }]}>리뷰 숨기기</Text>
            </Pressable>
          </>
        ) : status === 'ACCEPTED' ? (
          <Pressable
            onPress={onRevert}
            style={({ pressed }) => [
              styles.btn,
              { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' },
            ]}>
            <Text style={[styles.btnText, { color: p.accent }]}>다시 노출</Text>
          </Pressable>
        ) : (
          /* 반려된 신고는 되돌릴 API가 없다. 버튼 대신 왜 없는지 적는다 */
          <Text style={[styles.done, { color: p.muted }]}>
            반려로 끝난 신고예요. 리뷰는 그대로 보이고 있어요.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: 60 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.md },
  title: { fontSize: Type.screenTitle, lineHeight: 34, fontWeight: '900', letterSpacing: -1 },
  sub: { fontSize: Type.footnote, lineHeight: 19 },
  chips: { flexDirection: 'row', gap: 8, paddingRight: Spacing.lg, paddingBottom: 2 },
  count: { fontSize: Type.caption, fontWeight: '700' },
  list: { gap: Spacing.md },

  card: { gap: 8, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardTitle: { flex: 1, gap: 2 },
  facility: { fontSize: Type.sheetTitle, fontWeight: '900', letterSpacing: -0.4 },
  byline: { fontSize: Type.caption },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  countChipText: { fontSize: Type.caption, fontWeight: '900', fontVariant: ['tabular-nums'] },

  reviewBody: { fontSize: Type.body, lineHeight: 20, borderRadius: Radius.sm, padding: 11 },
  photo: { width: '100%', height: 168, borderRadius: Radius.sm },

  reasons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  reasonChip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  reasonText: { fontSize: Type.caption, fontWeight: '700' },
  first: { fontSize: Type.caption, marginLeft: 'auto' },

  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  btn: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: Radius.full, paddingVertical: 10 },
  btnText: { fontSize: Type.footnote, fontWeight: '800' },
  done: { flex: 1, fontSize: Type.caption, lineHeight: 17 },

  more: { alignItems: 'center', borderWidth: 1, borderRadius: Radius.full, paddingVertical: 11 },
  moreText: { fontSize: Type.footnote, fontWeight: '800' },

  notice: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  noticeText: { flexShrink: 1, fontSize: Type.footnote, fontWeight: '800', lineHeight: 18 },
});
