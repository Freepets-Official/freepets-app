import * as SecureStore from 'expo-secure-store';

/** 이미 본 리캡 id — 홈 말풍선이 같은 리캡을 계속 권하지 않게(계정별). 웹은 `.web.ts` */
const keyOf = (account: string) => `freepets.recaps.${account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)}`;

export async function loadSeenRecaps(account: string): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(keyOf(account));
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-20) : [];
  } catch {
    return [];
  }
}

export async function saveSeenRecaps(account: string, ids: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(keyOf(account), JSON.stringify(ids.slice(-20)));
  } catch {
    // 못 남기면 다음에 한 번 더 권할 뿐이다
  }
}
