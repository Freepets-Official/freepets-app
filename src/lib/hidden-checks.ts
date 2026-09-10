import * as SecureStore from 'expo-secure-store';

/**
 * 목록에서 지운 판별 이력.
 *
 * **서버에는 삭제 API가 없다**(라이브에 `GET /pet-checks`만 있다). 그래서 로컬 상태에서만
 * 빼면 앱을 다시 켤 때 서버에서 그대로 다시 불러와 되살아난다 — 지웠는데 돌아오는 목록만큼
 * 나쁜 것도 없다. 지운 id를 기기에 남겨 불러온 뒤 걸러낸다.
 *
 * 백엔드에 `DELETE /pet-checks/{checkId}`가 생기면 이 파일은 지우고 서버 삭제로 바꾼다.
 * 그 전까지는 기기 단위라, 다른 기기에서는 그 이력이 그대로 보인다.
 */
const KEY = 'freepets.hiddenChecks';

export async function loadHiddenChecks(): Promise<number[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export async function saveHiddenChecks(ids: number[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(ids));
  } catch {
    // 저장에 실패하면 이번 세션에만 숨겨진다. 지우는 동작 자체를 막지는 않는다.
  }
}
