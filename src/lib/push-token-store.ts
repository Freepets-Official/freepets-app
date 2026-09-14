import * as SecureStore from 'expo-secure-store';

/**
 * 서버에 등록한 푸시 토큰을 기기에 남긴다.
 *
 * 등록 토큰을 메모리에만 들고 있으면, 등록한 채로 앱을 껐다가 다시 켠 직후 알림을 끄거나
 * 로그아웃할 때 **해제할 토큰이 없어 서버 등록이 남는다.** 개인정보처리방침이 "끄면 저장된
 * 푸시 토큰도 함께 삭제"라고 약속하므로 지켜야 한다.
 */
const KEY = 'freepets.pushToken';

export async function loadPushToken(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(KEY)) || null;
  } catch {
    return null;
  }
}

export async function savePushToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, token);
  } catch {
    // 못 남기면 다음 실행에서 해제를 못 할 뿐이다. 등록 자체를 막지 않는다
  }
}

export async function clearPushToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // 이미 없거나 접근 불가 — 지우려던 목적은 달성된 것으로 본다
  }
}
