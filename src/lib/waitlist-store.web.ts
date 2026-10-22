
/**
 * 사전 신청 기록(계정별) — 서버 API가 아직 없을 수 있어 기기에 먼저 남기고, 서버에 못 보냈으면
 * `synced: false`로 두었다가 다음에 다시 보낸다. 웹(localStorage).
 */
export interface WaitlistRecord {
  product: 'PASS' | 'OWNER_PLUS';
  interests: string[];
  joinedAt: string;
  synced: boolean;
}
// 상품마다 따로 — 사용자 꼬리패스와 사장님 플러스를 같은 계정에서 각각 신청할 수 있다. PASS는 예전 키를 그대로 쓴다
const keyOf = (account: string, product: WaitlistRecord['product'] = 'PASS') =>
  `freepets.waitlist.${product === 'PASS' ? '' : 'owner.'}${account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)}`;

export async function loadWaitlist(account: string, product: WaitlistRecord['product'] = 'PASS'): Promise<WaitlistRecord | null> {
  try {
    const raw = window.localStorage.getItem(keyOf(account, product));
    return raw ? (JSON.parse(raw) as WaitlistRecord) : null;
  } catch {
    return null;
  }
}

export async function saveWaitlist(account: string, rec: WaitlistRecord): Promise<void> {
  try {
    window.localStorage.setItem(keyOf(account, rec.product), JSON.stringify(rec));
  } catch {
    // 못 남겨도 이번 세션 화면에는 반영된다
  }
}
