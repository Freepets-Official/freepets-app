import * as SecureStore from 'expo-secure-store';

/**
 * 퀘스트 연속 기록·간식 상자·꾸미기를 기기에 남긴다(서버 API가 아직 없다).
 *
 * **계정마다 따로** 둔다. 한 기기에서 다른 계정으로 로그인하면 남의 연속 기록이 보이면 안 된다.
 * SecureStore 키에는 영문·숫자·`._-`만 쓸 수 있어 계정 식별자를 그 안으로 줄인다.
 * 네이티브는 SecureStore, 웹은 별도 구현(.web.ts)이 받는다.
 */
const keyOf = (account: string) => `freepets.journey.${account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)}`;

export async function loadJourney(account: string): Promise<unknown> {
  try {
    const raw = await SecureStore.getItemAsync(keyOf(account));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveJourney(account: string, state: object): Promise<void> {
  try {
    await SecureStore.setItemAsync(keyOf(account), JSON.stringify(state));
  } catch {
    // 저장에 실패해도 이번 세션에는 남는다
  }
}
