import * as SecureStore from 'expo-secure-store';

/**
 * 인증 기록의 저장소(네이티브). 웹은 `.web.ts`가 받는다.
 *
 * 세션 저장소와 달리 **첫 잠금 해제 이후**면 읽고 쓸 수 있게 둔다. 이 기록의 목적 하나가
 * "기기가 잠긴 채 앱이 깨어나 세션을 못 읽었는가"를 잡는 것이라, 기록마저 잠금에 막히면
 * 정작 그 순간이 남지 않는다.
 */
const KEY = 'freepets.authlog';

export async function readRaw(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  } catch {
    return null;
  }
}

export async function writeRaw(value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(KEY);
    else await SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  } catch {
    // 진단 기록이다. 못 남겨도 앱 동작에는 영향이 없다
  }
}
