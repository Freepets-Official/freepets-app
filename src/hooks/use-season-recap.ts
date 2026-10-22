import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { buildRecap, type Recap, type RecapCheck } from '@/data/recap';
import { kstYmd } from '@/data/quest-journey';
import {
  detectNextStart,
  KNOWN_STARTS,
  RECAP_SINCE,
  recapId,
  SEASON_LABEL,
  toSpans,
  withDetected,
  type SeasonSpan,
} from '@/data/seasons';
import { useDayDiary } from '@/hooks/use-day-diary';
import { loadChecksSince, loadTravelDays } from '@/lib/recap-data';
import { loadSeenRecaps, saveSeenRecaps } from '@/lib/recap-store';
import { fetchSeoulDailyMeans } from '@/lib/season-weather';
import { useAppStore } from '@/store/app-store';

/**
 * 계절 리캡 — 계절 구간 · 열린 리캡 목록 · 본 표시를 홈·퀘스트·리캡 화면이 같은 값으로 본다.
 *
 * 서버 리캡이 생기기 전까지 앱이 기기·서버 기록으로 만든다(api-specs/season-recap.md).
 */

/* ───────── 계절 구간(모듈에 하나) ───────── */

let spans: SeasonSpan[] = toSpans(KNOWN_STARTS);
let detectedFor: string | null = null;
const spanSubs = new Set<() => void>();
const subscribeSpans = (f: () => void) => {
  spanSubs.add(f);
  return () => spanSubs.delete(f);
};

/** 하루에 한 번, 다음 계절이 왔는지 최근 기온으로 판정한다 */
function detect(today: string) {
  if (detectedFor === today) return;
  detectedFor = today;
  void fetchSeoulDailyMeans(today).then((daily) => {
    if (!daily.length) return;
    const last = KNOWN_STARTS[KNOWN_STARTS.length - 1];
    const next = detectNextStart(last, daily);
    if (!next) return;
    spans = toSpans(withDetected(KNOWN_STARTS, next));
    spanSubs.forEach((f) => f());
  });
}

/** 지금 계절(판정한 다음 계절까지 반영) — 상자에서 계절 한정 소품을 고를 때 */
export function seasonNow() {
  return spans[spans.length - 1].season;
}

export function useSeasonSpans() {
  const today = kstYmd();
  const s = useSyncExternalStore(subscribeSpans, () => spans, () => spans);
  useEffect(() => detect(today), [today]);
  const current = s[s.length - 1];
  return { spans: s, current, today };
}

/* ───────── 본 리캡(계정별) ───────── */

let seen: { account: string; ids: string[] } | null = null;
const seenSubs = new Set<() => void>();
const subscribeSeen = (f: () => void) => {
  seenSubs.add(f);
  return () => seenSubs.delete(f);
};
const setSeen = (next: { account: string; ids: string[] }) => {
  seen = next;
  seenSubs.forEach((f) => f());
};

function useAccount() {
  const { session, myUserId } = useAppStore();
  // 퀘스트 여정·하루 기록과 같은 규칙
  return session.authed ? (myUserId != null ? `u${myUserId}` : session.email ? `e${session.email}` : '') : null;
}

export const recapTitle = (span: SeasonSpan) => `${span.year} ${SEASON_LABEL[span.season]}`;

export interface RecapEntry {
  id: string;
  span: SeasonSpan;
  recap: Recap;
  seen: boolean;
}

/**
 * 열린 리캡 목록(최신 먼저)과 진행 중인 계절의 "지금까지".
 * 아무 기록이 없는 계절은 목록에서 뺀다 — 빈 리캡은 안 쓴 걸 들키는 화면이 된다.
 */
export function useRecaps() {
  const account = useAccount();
  const { spans: all, current, today } = useSeasonSpans();
  const { stamps } = useAppStore();
  const diary = useDayDiary();
  const seenSnap = useSyncExternalStore(subscribeSeen, () => seen, () => seen);
  const [checks, setChecks] = useState<{ account: string; items: RecapCheck[] } | null>(null);

  useEffect(() => {
    if (!account) return;
    if (seen?.account !== account) void loadSeenRecaps(account).then((ids) => setSeen({ account, ids }));
    let alive = true;
    loadChecksSince(account, RECAP_SINCE)
      .then((items) => {
        if (alive) setChecks({ account, items });
      })
      .catch(() => {
        if (alive) setChecks({ account, items: [] });
      });
    return () => {
      alive = false;
    };
  }, [account]);

  const ready = !!account && checks?.account === account;
  const seenIds = useMemo(() => (seenSnap?.account === account ? seenSnap.ids : []), [seenSnap, account]);

  const { list, live } = useMemo(() => {
    if (!ready) return { list: [] as RecapEntry[], live: null };
    const build = (span: SeasonSpan, to: string) =>
      buildRecap({ from: span.startsOn, to, checks: checks.items, stamps, diary: diary.map, travelDays: [] });
    const closed = all
      .filter((s): s is SeasonSpan & { endsOn: string } => !!s.endsOn && s.startsOn >= RECAP_SINCE)
      .map((span) => ({ id: recapId(span), span, recap: build(span, span.endsOn), seen: seenIds.includes(recapId(span)) }))
      .filter((e) => e.recap.size !== 'EMPTY')
      .reverse();
    const liveRecap = build(current, today);
    return {
      list: closed,
      live: liveRecap.size === 'EMPTY' ? null : { id: recapId(current), span: current, recap: liveRecap, seen: true },
    };
  }, [ready, checks, stamps, diary.map, all, current, today, seenIds]);

  const markSeen = useCallback(
    (id: string) => {
      if (!account) return;
      const ids = seen?.account === account ? seen.ids : [];
      if (ids.includes(id)) return;
      const next = { account, ids: [...ids, id] };
      setSeen(next);
      void saveSeenRecaps(account, next.ids);
    },
    [account],
  );

  // 계절이 끝나고 **30일 안**에만 새 리캡으로 권한다. 그 뒤엔 목록에만 남는다
  const fresh = list.find((e) => !e.seen && e.span.endsOn && daysSince(e.span.endsOn, today) <= 30) ?? null;

  return { ready, list, live, fresh, markSeen };
}

const daysSince = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** 리캡 화면 — 여행 일정까지 받아 한 계절을 끝까지 채운다 */
export function useRecapDetail(id: string) {
  const { spans: all, current, today } = useSeasonSpans();
  const span = all.find((s) => recapId(s) === id) ?? null;
  const live = !!span && span === current;
  const to = span ? (span.endsOn ?? today) : null;
  const { list, live: liveEntry, ready } = useRecaps();
  const base = live ? liveEntry : list.find((e) => e.id === id) ?? null;
  const [travel, setTravel] = useState<{ key: string; days: string[] } | null>(null);
  const key = span && to ? `${span.startsOn}:${to}` : '';

  useEffect(() => {
    if (!span || !to) return;
    let alive = true;
    loadTravelDays(span.startsOn, to)
      .then((days) => {
        if (alive) setTravel({ key, days });
      })
      .catch(() => {
        if (alive) setTravel({ key, days: [] });
      });
    return () => {
      alive = false;
    };
  }, [span, to, key]);

  const travelDays = travel?.key === key ? travel.days.length : null;
  const recap = base && travelDays != null ? { ...base.recap, travelDays } : base?.recap ?? null;
  return { span, live, recap, ready: ready && travel?.key === key, today };
}
