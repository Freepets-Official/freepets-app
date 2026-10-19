import type { RecapCheck } from '@/data/recap';
import { addDays } from '@/data/seasons';
import { aiApi, calendarApi } from '@/lib/api';

/**
 * 리캡에 필요한 서버 기록 — 판별 이력과 캘린더 여행 일정.
 * 리캡을 여러 번 열어도 다시 받지 않게 계정별로 10분 담아 둔다.
 */
const TTL = 10 * 60_000;
let checksCache: { account: string; at: number; since: string; items: RecapCheck[] } | null = null;

/** `since` 이후 판별 이력. 최신순으로 오므로 `since`보다 오래된 게 나오면 멈춘다(최대 500건) */
export async function loadChecksSince(account: string, since: string): Promise<RecapCheck[]> {
  if (checksCache && checksCache.account === account && checksCache.since <= since && Date.now() - checksCache.at < TTL) {
    return checksCache.items;
  }
  const items: RecapCheck[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const { items: page } = await aiApi.history({ limit: 100, offset });
    items.push(...page.map((c) => ({ facilityId: c.facilityId, overall: c.overall, createdAt: c.createdAt })));
    if (page.length < 100 || page.some((c) => c.createdAt.slice(0, 10) < since)) break;
  }
  checksCache = { account, at: Date.now(), since, items };
  return items;
}

/** 기간에 걸친 여행 일정의 날짜들 */
export async function loadTravelDays(from: string, to: string): Promise<string[]> {
  const months: string[] = [];
  for (let d = `${from.slice(0, 7)}-01`; d <= to; d = addMonth(d)) months.push(d.slice(0, 7));
  const snaps = await Promise.all(months.map((m) => calendarApi.month(m).catch(() => ({ events: [], taken: [] }))));
  const days = new Set<string>();
  const seen = new Set<number>();
  for (const s of snaps)
    for (const e of s.events) {
      if (e.type !== 'TRAVEL' || seen.has(e.eventId)) continue;
      seen.add(e.eventId);
      const end = e.endDate && e.endDate > e.date ? e.endDate : e.date;
      for (let d = e.date; d <= end; d = addDays(d, 1)) if (d >= from && d <= to) days.add(d);
    }
  return [...days];
}

function addMonth(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

export function clearRecapCache() {
  checksCache = null;
}
