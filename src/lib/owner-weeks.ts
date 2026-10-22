import * as SecureStore from 'expo-secure-store';

import type { WeekSnap } from '@/data/owner-insights';

/**
 * 매장별 주 단위 숫자(최근 12주) — "지난주보다 몇 % 늘었어요"를 서버 없이 보여 주려고 앱이 남긴다.
 * 매장마다 키를 나눠 SecureStore 한 값 크기(2KB)를 넘지 않게 한다. 웹은 `.web.ts`.
 */
const keyOf = (account: string, facilityId: number) =>
  `freepets.owner.weeks.${account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60)}.${facilityId}`;

export async function loadWeeks(account: string, facilityId: number): Promise<WeekSnap[]> {
  try {
    const raw = await SecureStore.getItemAsync(keyOf(account, facilityId));
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as WeekSnap[]).filter((w) => typeof w?.week === 'string').slice(-12) : [];
  } catch {
    return [];
  }
}

export async function saveWeeks(account: string, facilityId: number, list: WeekSnap[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(keyOf(account, facilityId), JSON.stringify(list.slice(-12)));
  } catch {
    // 못 남기면 다음 주에 비교가 하나 빠질 뿐이다
  }
}
