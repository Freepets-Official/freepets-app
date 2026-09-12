/**
 * 웹은 SecureStore가 없다. localStorage를 쓴다(네이티브 구현과 같은 계약).
 * 자세한 배경은 `settings-store.ts` 주석 참고.
 */
const KEY = 'freepets.settings';

export async function loadSettings<T extends object>(defaults: T): Promise<T> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return defaults;
    const merged = { ...defaults } as Record<string, unknown>;
    for (const k of Object.keys(defaults)) {
      const v = parsed[k];
      if (v !== undefined && typeof v === typeof (defaults as Record<string, unknown>)[k]) {
        merged[k] = v;
      }
    }
    return merged as T;
  } catch {
    return defaults;
  }
}

export async function saveSettings(settings: object): Promise<void> {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 사파리 프라이빗 모드 등에서 막힌다. 이번 세션에는 적용되므로 막지 않는다.
  }
}
