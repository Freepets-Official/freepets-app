import type { WeekSnap } from '@/data/owner-insights';

/** 웹은 localStorage(네이티브와 같은 계약) */
const keyOf = (account: string, facilityId: number) =>
  `freepets.owner.weeks.${account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60)}.${facilityId}`;

export async function loadWeeks(account: string, facilityId: number): Promise<WeekSnap[]> {
  try {
    const raw = window.localStorage.getItem(keyOf(account, facilityId));
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as WeekSnap[]).filter((w) => typeof w?.week === 'string').slice(-12) : [];
  } catch {
    return [];
  }
}

export async function saveWeeks(account: string, facilityId: number, list: WeekSnap[]): Promise<void> {
  try {
    window.localStorage.setItem(keyOf(account, facilityId), JSON.stringify(list.slice(-12)));
  } catch {
    // 개인 모드 등
  }
}
