/**
 * 웹은 SecureStore가 없다. localStorage를 쓴다(네이티브 구현과 같은 계약).
 */
const keyOf = (account: string) => `freepets.journey.${account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)}`;

export async function loadJourney(account: string): Promise<unknown> {
  try {
    const raw = window.localStorage.getItem(keyOf(account));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveJourney(account: string, state: object): Promise<void> {
  try {
    window.localStorage.setItem(keyOf(account), JSON.stringify(state));
  } catch {
    // 사파리 개인 모드 등 저장이 막힌 환경 — 이번 세션에만 남는다
  }
}
