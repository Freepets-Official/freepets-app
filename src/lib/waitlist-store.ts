import * as SecureStore from 'expo-secure-store';

/**
 * 사전 신청 기록(계정별) — 서버 API가 아직 없을 수 있어 기기에 먼저 남기고, 서버에 못 보냈으면
 * `synced: false`로 두었다가 다음에 다시 보낸다. 웹은 `.web.ts`.
 */
export interface WaitlistRecord {
  product: 'PASS' | 'OWNER_PLUS';
  interests: string[];
  joinedAt: string;
  synced: boolean;
}
const keyOf = (account: string) => `freepets.waitlist.${account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)}`;

export async function loadWaitlist(account: string): Promise<WaitlistRecord | null> {
  try {
    const raw = await SecureStore.getItemAsync(keyOf(account));
    return raw ? (JSON.parse(raw) as WaitlistRecord) : null;
  } catch {
    return null;
  }
}

export async function saveWaitlist(account: string, rec: WaitlistRecord): Promise<void> {
  try {
    await SecureStore.setItemAsync(keyOf(account), JSON.stringify(rec));
  } catch {
    // 못 남겨도 이번 세션 화면에는 반영된다
  }
}
