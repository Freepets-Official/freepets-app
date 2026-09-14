/** 웹은 SecureStore가 없다. localStorage를 쓴다(네이티브 구현과 같은 계약). */
const KEY = 'freepets.pushToken';

export async function loadPushToken(): Promise<string | null> {
  try {
    return window.localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export async function savePushToken(token: string): Promise<void> {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    // 사생활 보호 모드 등 — 등록 자체를 막지 않는다
  }
}

export async function clearPushToken(): Promise<void> {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 이미 없거나 접근 불가
  }
}
