/** 인증 기록의 저장소(웹). 네이티브 키체인이 없어 localStorage를 쓴다 */
const KEY = 'freepets.authlog';

export async function readRaw(): Promise<string | null> {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function writeRaw(value: string | null): Promise<void> {
  try {
    if (value === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, value);
  } catch {
    // 진단 기록이다. 못 남겨도 앱 동작에는 영향이 없다
  }
}
