/**
 * 웹은 SecureStore가 없다. localStorage를 쓴다(네이티브 구현과 같은 계약).
 * 자세한 배경은 `hidden-checks.ts` 주석 참고.
 */
const KEY = 'freepets.hiddenChecks';

export async function loadHiddenChecks(): Promise<number[]> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export async function saveHiddenChecks(ids: number[]): Promise<void> {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // 사생활 보호 모드·용량 초과. 이번 세션에만 숨겨진다.
  }
}
