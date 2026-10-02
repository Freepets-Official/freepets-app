import * as SecureStore from 'expo-secure-store';

import { logAuth } from '@/lib/auth-log';

/**
 * 로그인 세션을 기기에 남긴다. 남기지 않으면 앱을 다시 열 때마다 로그인해야 한다.
 *
 * 이메일까지 함께 두는 이유는 서버 `GET /users/account`가 닉네임·아바타만 주고
 * **이메일을 주지 않기 때문**이다. 복원할 때 이메일이 없으면 설정·프로필 화면이
 * 계정 주소를 못 보여준다(네이버·카카오는 애초에 이메일을 주지 않아 그때도 빈다).
 *
 * 네이티브는 SecureStore(키체인·keystore)를 쓰고, 웹은 별도 구현(.web.ts)이 받는다.
 */
export type StoredSession = {
  accessToken: string;
  refreshToken: string | null;
  email: string | null;
  /** 어느 방법으로 들어왔는지. 예전 저장분에는 없어서 복원하면 null이 된다 */
  provider?: LoginProvider | null;
};

/** 로그인 방법 — 소셜 4종 + 이메일 */
export type LoginProvider = 'kakao' | 'naver' | 'google' | 'apple' | 'email';

const KEY = 'freepets.session';

export async function saveSession(s: StoredSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(s));
  } catch (e) {
    // 저장에 실패해도 이번 세션은 메모리로 계속 쓸 수 있다. 로그인을 막지 않는다.
    // 다만 다음 실행에서 옛 토큰으로 복원되므로, 그 뒤 로그아웃을 읽을 수 있게 남긴다
    logAuth(`세션 저장 실패: ${e instanceof Error ? e.message.slice(0, 120) : '알 수 없음'}`);
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    return typeof s?.accessToken === 'string' && s.accessToken ? s : null;
  } catch (e) {
    // 기기가 잠긴 채 앱이 깨어나면 키체인을 못 읽어 여기로 온다(저장분은 멀쩡하다).
    // "없음"과 구분할 수 있게 진단 기록에 남긴다
    logAuth(`키체인 읽기 실패: ${e instanceof Error ? e.message.slice(0, 120) : '알 수 없음'}`);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // 이미 없거나 접근 불가. 지우려던 목적은 달성된 것으로 본다.
  }
}
