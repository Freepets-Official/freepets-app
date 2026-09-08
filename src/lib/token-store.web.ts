import type { StoredSession } from './token-store';

export type { StoredSession };

/**
 * 웹은 SecureStore가 없다(네이티브 키체인이 없으므로). localStorage를 쓴다.
 *
 * 토큰이 스크립트에서 읽히는 건 SPA의 알려진 절충이다. 서버가 세션 쿠키를 주지
 * 않아 대안이 없고, 지금도 토큰은 자바스크립트 메모리에 그대로 있다.
 * 저장 위치는 아티팩트가 아니라 **이 도메인의 브라우저**이고 다른 사용자에게 가지 않는다.
 */
const KEY = 'freepets.session';

export async function saveSession(s: StoredSession): Promise<void> {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 사생활 보호 모드·저장 용량 초과 등. 이번 세션은 메모리로 계속 쓴다.
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    return typeof s?.accessToken === 'string' && s.accessToken ? s : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 접근이 막혀 있으면 지울 것도 없다.
  }
}
