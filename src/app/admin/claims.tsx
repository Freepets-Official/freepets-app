import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { CardShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { adminApi, type AdminClaim, type ClaimStatus } from '@/lib/api';
import { confirmDialog, promptText } from '@/lib/notify';

/**
 * 매장 소유권 심사 — 운영자 화면.
 *
 * 사장님이 「내 매장이다」라고 신청하면(`POST /business/facilities/{id}/claim`) 여기서
 * 사람이 보고 승인·반려한다. 승인되면 그 계정에 `OWNER` 프로필이 붙고 출입 조건을
 * **직접 확정**할 수 있게 된다 — 이 앱에서 가장 신뢰도가 높은 정보의 출처다.
 * 그래서 자동 승인을 두지 않는다.
 *
 * **권한은 서버만 안다.** 계정 응답의 `profiles`에는 `CONSUMER`·`OWNER`뿐이고 운영자 값이
 * 없다. 일반 계정이 목록을 부르면 403이 온다 — 이 화면은 그 403을 그대로 보여준다.
 * 설정의 진입 버튼도 목록 조회가 통했을 때만 나타난다(`useIsAdmin`).
 */

const STATUS_LABEL: Record<ClaimStatus, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
  REVOKED: '회수',
};

/** 필터 칩 순서 — 할 일이 있는 「대기」가 먼저다 */
const FILTERS: { key: ClaimStatus | 'ALL'; label: string }[] = [
  { key: 'PENDING', label: '대기' },
  { key: 'ALL', label: '전체' },
  { key: 'APPROVED', label: '승인' },
  { key: 'REJECTED', label: '반려' },
  { key: 'REVOKED', label: '회수' },
];

const PAGE_SIZE = 20;

export default function AdminClaimsScreen() {
  const p = usePalette();
  const [filter, setFilter] = useState<ClaimStatus | 'ALL'>('PENDING');
  const [claims, setClaims] = useState<AdminClaim[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /** 지금 처리 중인 신청. 버튼을 두 번 눌러 같은 신청이 두 번 승인되지 않게 한다 */
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null);

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else {
        setClaims(null);
        setFailed(null);
      }
      try {
        const r = await adminApi.claims({
          status: filter === 'ALL' ? undefined : filter,
          page: nextPage,
          size: PAGE_SIZE,
        });
        setClaims((prev) => (append && prev ? [...prev, ...r.claims] : r.claims));
        setTotal(r.totalElements);
        setHasNext(r.hasNext);
        setPage(r.page);
      } catch (e) {
        // 403은 "장애"가 아니라 "당신 화면이 아니다"다. 다시 시도를 권하면 안 된다
        setFailed(e instanceof Error ? e.message : '목록을 불러오지 못했어요');
        if (!append) setClaims([]);
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
   * 처리 뒤 목록을 통째로 다시 받지 않고 **그 줄만** 바꾼다.
   *
   * 「대기」 필터에서 승인하면 그 줄은 목록 조건에서 빠지지만, 바로 지우지는 않는다 —
   * 방금 무엇을 처리했는지 눈으로 확인할 시간이 필요하다. 상태 뱃지만 바뀐다.
   */
  const applyResult = (claimId: number, status: ClaimStatus, reason: string | null) =>
    setClaims((prev) =>
      (prev ?? []).map((c) =>
        c.claimId === claimId
          ? { ...c, status, reviewReason: reason, reviewedAt: new Date().toISOString() }
          : c,
      ),
    );

  const approve = async (c: AdminClaim) => {
    if (
      !(await confirmDialog(
        '이 신청을 승인할까요?',
        c.hasApprovedOwner
          ? `${c.facilityName}에는 이미 승인된 사장님이 있어요. 그래도 승인하면 주인이 둘이 됩니다.`
          : `${c.facilityName}의 출입 조건을 ${c.applicantNickname}님이 직접 확정할 수 있게 됩니다.`,
      ))
    ) {
      return;
    }
    setBusyId(c.claimId);
    setNotice(null);
    try {
      const status = await adminApi.approve(c.claimId);
      applyResult(c.claimId, status, null);
      setNotice({ text: `${c.facilityName} 승인 완료`, failed: false });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : '승인하지 못했어요', failed: true });
    } finally {
      setBusyId(null);
    }
  };

  /**
   * 반려·회수는 **사유가 필수**다.
   *
   * 신청자는 내 신청 목록에서 이 문장을 그대로 본다(`MyClaim.reviewReason`). 비워 두면
   * "반려됨"만 남아서, 무엇을 고쳐 다시 신청해야 하는지 알 수 없다.
   */
  const rejectOrRevoke = async (c: AdminClaim, kind: 'reject' | 'revoke') => {
    const isReject = kind === 'reject';
    const reason = await promptText(
      isReject ? '반려 사유' : '승인 회수 사유',
      isReject
        ? '신청자에게 그대로 보여요. 무엇을 고쳐야 하는지 적어 주세요.'
        : '승인을 거둬들이는 이유를 적어 주세요. 사장님에게 그대로 보여요.',
    );
    const text = reason?.trim();
    if (!text) return;
    setBusyId(c.claimId);
    setNotice(null);
    try {
      const status = isReject
        ? await adminApi.reject(c.claimId, text)
        : await adminApi.revoke(c.claimId, text);
      applyResult(c.claimId, status, text);
      setNotice({ text: `${c.facilityName} ${isReject ? '반려' : '회수'} 완료`, failed: false });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : '처리하지 못했어요', failed: true });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '매장 소유권 심사', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <Text style={[styles.title, { color: p.ink }]}>매장 소유권 심사</Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            승인하면 그 계정이 시설의 출입 조건을 직접 확정할 수 있어요. 이 앱에서 가장 믿을 수
            있는 정보라, 사업자등록증을 확인하고 승인해 주세요.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                selected={filter === f.key}
                onPress={() => setFilter(f.key)}
              />
            ))}
          </ScrollView>

          {claims !== null && !failed && (
            <Text style={[styles.count, { color: p.muted }]}>
              {total.toLocaleString()}건
              {claims.length < total ? ` · ${claims.length}건 불러옴` : ''}
            </Text>
          )}

          {claims === null ? (
            <LoadState kind="loading" size="page" />
          ) : failed ? (
            /*
              403이면 재시도 버튼을 주지 않는다 — 권한이 없는 것은 다시 눌러도 그대로다.
              다른 실패(네트워크 등)만 다시 시도할 수 있게 한다.
            */
            <LoadState
              kind="failed"
              icon={failed.includes('권한') ? 'lock-closed-outline' : undefined}
              message={failed}
              onRetry={failed.includes('권한') ? undefined : () => void load(0, false)}
            />
          ) : claims.length === 0 ? (
            <LoadState
              kind="empty"
              icon="checkmark-done-outline"
              message={filter === 'PENDING' ? '대기 중인 신청이 없어요.' : '해당하는 신청이 없어요.'}
            />
          ) : (
            <View style={styles.list}>
              {claims.map((c) => (
                <ClaimCard
                  key={c.claimId}
                  claim={c}
                  busy={busyId === c.claimId}
                  onApprove={() => void approve(c)}
                  onReject={() => void rejectOrRevoke(c, 'reject')}
                  onRevoke={() => void rejectOrRevoke(c, 'revoke')}
                />
              ))}

              {hasNext && (
                <Pressable
                  onPress={() => void load(page + 1, true)}
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

          <PendingCapabilities />
        </View>
      </ScrollView>

      {notice && (
        <Pressable
          onPress={() => setNotice(null)}
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
          <Text style={[styles.noticeText, { color: notice.failed ? p.danger : p.ink }]}>
            {notice.text}
          </Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function ClaimCard({
  claim: c,
  busy,
  onApprove,
  onReject,
  onRevoke,
}: {
  claim: AdminClaim;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRevoke: () => void;
}) {
  const p = usePalette();
  const tone =
    c.status === 'APPROVED'
      ? p.success
      : c.status === 'PENDING'
        ? p.warn
        : c.status === 'REJECTED'
          ? p.danger
          : p.muted;

  const allowedText =
    c.requestedPetAllowed === 'ALLOWED'
      ? '동반 가능'
      : c.requestedPetAllowed === 'DENIED'
        ? '동반 불가'
        : c.requestedPetAllowed === 'PENDING'
          ? '미정'
          : '요청 없음';

  const weightText =
    c.requestedMaxWeight === null
      ? '제한 없음'
      : `${c.requestedMaxWeight}kg ${c.requestedMaxWeightInclusive === false ? '미만' : '이하'}`;

  return (
    <View style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <View style={styles.cardHead}>
        <View style={styles.cardTitle}>
          <Text style={[styles.facility, { color: p.ink }]} numberOfLines={1}>
            {c.facilityName}
          </Text>
          {!!c.facilityAddress && (
            <Text style={[styles.address, { color: p.muted }]} numberOfLines={1}>
              {c.facilityAddress}
            </Text>
          )}
        </View>
        <View style={[styles.statusChip, { borderColor: tone }]}>
          <Text style={[styles.statusText, { color: tone }]}>{STATUS_LABEL[c.status]}</Text>
        </View>
      </View>

      {/* 같은 시설에 주인이 둘이 되는 것을 막는 유일한 단서다. 신청서만 봐서는 알 수 없다 */}
      {c.hasApprovedOwner && c.status === 'PENDING' && (
        <View style={[styles.warn, { backgroundColor: p.warnSoft, borderColor: p.warn }]}>
          <Ionicons name="warning" size={14} color={p.warn} />
          <Text style={[styles.warnText, { color: p.warn }]}>
            이 시설에는 이미 승인된 사장님이 있어요
          </Text>
        </View>
      )}

      <Row label="신청자" value={c.applicantNickname} />
      <Row label="사업자번호" value={c.maskedBusinessNumber ?? '확인 안 됨'} />
      <Row
        label="진위확인"
        value={c.verifiedAt ? c.verifiedAt.slice(0, 10).replace(/-/g, '.') : '안 거침'}
        alert={!c.verifiedAt}
      />
      <Row label="신청일" value={c.appliedAt ? c.appliedAt.slice(0, 10).replace(/-/g, '.') : '—'} />

      <View style={[styles.divider, { backgroundColor: p.line }]} />

      <Text style={[styles.sectionLabel, { color: p.muted }]}>요청한 출입 조건</Text>
      <Row label="동반" value={allowedText} />
      <Row label="몸무게" value={weightText} />
      {c.requestedRequirements.length > 0 && (
        <Row label="준비물" value={c.requestedRequirements.join(' · ')} />
      )}
      {!!c.requestedConditionRaw && (
        <Text style={[styles.raw, { color: p.ink, backgroundColor: p.surface }]}>
          {c.requestedConditionRaw}
        </Text>
      )}

      {!!c.registrationCertificateUrl && (
        <Pressable
          onPress={() => void Linking.openURL(c.registrationCertificateUrl as string)}
          style={({ pressed }) => [
            styles.certBtn,
            { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : 'transparent' },
          ]}>
          <Ionicons name="document-text-outline" size={15} color={p.accent} />
          <Text style={[styles.certText, { color: p.accent }]}>사업자등록증 보기</Text>
        </Pressable>
      )}

      {!!c.reviewReason && (
        <Text style={[styles.reason, { color: p.muted }]}>
          처리 사유 · {c.reviewReason}
        </Text>
      )}

      <View style={styles.actions}>
        {busy ? (
          <ActivityIndicator color={p.accent} style={{ paddingVertical: 8 }} />
        ) : c.status === 'PENDING' ? (
          <>
            <Pressable
              onPress={onReject}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: p.danger, backgroundColor: pressed ? p.dangerSoft : 'transparent' },
              ]}>
              <Text style={[styles.btnText, { color: p.danger }]}>반려</Text>
            </Pressable>
            <Pressable
              onPress={onApprove}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: p.success, backgroundColor: pressed ? p.successSoft : 'transparent' },
              ]}>
              <Text style={[styles.btnText, { color: p.success }]}>승인</Text>
            </Pressable>
          </>
        ) : c.status === 'APPROVED' ? (
          <Pressable
            onPress={onRevoke}
            style={({ pressed }) => [
              styles.btn,
              { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
            ]}>
            <Text style={[styles.btnText, { color: p.muted }]}>승인 회수</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Row({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: p.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: alert ? p.warn : p.ink }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * 아직 못 하는 운영 업무.
 *
 * 리뷰 신고 처리도 운영자 화면에 있어야 하지만 **서버에 그 API가 없다**(라이브 Swagger
 * 75개 확인, 2026-09-22). 접수(`POST /reviews/{id}/report`)만 있고 목록·처리가 없다.
 *
 * 빈 화면을 만들어 두지 않고 **무엇이 없는지 적는다.** 동작하지 않는 메뉴가 있으면
 * 운영자는 그게 고장인지 미구현인지 알 수 없다.
 *
 * 테스트 계정 정리는 여기 없다. 운영자가 계정을 지울 일이 아니라 **랭킹이 활동 없는
 * 계정을 빼면 되는 일**이기 때문이다(2026-09-22 실측: 참여자 37명 중 33명이 XP 0인 테스트
 * 계정). 백엔드에 `GET /gamification/ranking`에서 XP 0을 제외해 달라고 요청해 뒀다.
 * 계정 삭제는 리뷰·판별 이력까지 CASCADE로 함께 날아가 되돌릴 수 없다.
 */
function PendingCapabilities() {
  const p = usePalette();
  return (
    <View style={[styles.pending, { borderColor: p.line, backgroundColor: p.surface }]}>
      <Text style={[styles.pendingTitle, { color: p.ink }]}>아직 여기서 못 하는 일</Text>
      <Text style={[styles.pendingItem, { color: p.muted }]}>
        <Text style={{ fontWeight: '800' }}>리뷰 신고 처리</Text> — 접수만 있고 목록·처리 API가
        없어요. 신고 목록 조회와 숨김·기각이 필요해요.
      </Text>

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

  card: { gap: 5, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardTitle: { flex: 1, gap: 2 },
  facility: { fontSize: Type.sheetTitle, fontWeight: '900', letterSpacing: -0.4 },
  address: { fontSize: Type.caption },
  statusChip: { borderWidth: 1.5, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 2 },
  statusText: { fontSize: Type.caption, fontWeight: '800' },

  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 2,
  },
  warnText: { flexShrink: 1, fontSize: Type.caption, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowLabel: { width: 68, fontSize: Type.footnote, fontWeight: '700' },
  rowValue: { flex: 1, fontSize: Type.footnote, fontWeight: '700' },

  divider: { height: 1, marginVertical: 6 },
  sectionLabel: { fontSize: Type.caption, fontWeight: '800', letterSpacing: 0.2 },
  raw: { fontSize: Type.footnote, lineHeight: 18, borderRadius: Radius.sm, padding: 10, marginTop: 4 },

  certBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 9,
    marginTop: 8,
  },
  certText: { fontSize: Type.footnote, fontWeight: '800' },
  reason: { fontSize: Type.caption, lineHeight: 17, marginTop: 6 },

  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 10 },
  btn: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: Radius.full, paddingVertical: 10 },
  btnText: { fontSize: Type.footnote, fontWeight: '800' },

  more: { alignItems: 'center', borderWidth: 1, borderRadius: Radius.full, paddingVertical: 11 },
  moreText: { fontSize: Type.footnote, fontWeight: '800' },

  pending: { gap: 7, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, marginTop: Spacing.lg },
  pendingTitle: { fontSize: Type.body, fontWeight: '800' },
  pendingItem: { fontSize: Type.caption, lineHeight: 17 },

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
    ...CardShadow,
  },
  noticeText: { flex: 1, fontSize: Type.footnote, lineHeight: 19, fontWeight: '700' },
});
