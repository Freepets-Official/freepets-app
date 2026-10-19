/** 웹은 localStorage(네이티브 구현과 같은 계약) */
const keyOf = (account: string) => `freepets.recaps.${account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)}`;

export async function loadSeenRecaps(account: string): Promise<string[]> {
  try {
    const raw = window.localStorage.getItem(keyOf(account));
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-20) : [];
  } catch {
    return [];
  }
}

export async function saveSeenRecaps(account: string, ids: string[]): Promise<void> {
  try {
    window.localStorage.setItem(keyOf(account), JSON.stringify(ids.slice(-20)));
  } catch {
    // 개인 모드 등 — 이번 세션에만 남는다
  }
}
