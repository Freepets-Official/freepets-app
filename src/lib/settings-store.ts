import * as SecureStore from 'expo-secure-store';

/**
 * 앱 설정을 기기에 남긴다.
 *
 * 남기지 않으면 앱을 다시 열 때마다 전부 기본값으로 돌아간다 — 다크모드로 바꿔도 라이트로,
 * 글씨를 키워도 보통으로, **앱 잠금을 켜도 꺼진 채로** 시작한다. 마지막 것은 특히 나쁘다.
 * 잠가둔 줄 알고 있는데 앱을 다시 열면 인증 없이 저장된 세션이 그대로 열린다.
 *
 * 계정이 아니라 기기에 속한 값이라 로그아웃해도 지우지 않는다. 화면 모드나 글씨 크기는
 * 다음 사람에게도 그대로가 자연스럽다.
 *
 * 네이티브는 SecureStore, 웹은 별도 구현(.web.ts)이 받는다.
 */
const KEY = 'freepets.settings';

/** 저장된 값은 옛 버전이 남긴 것일 수 있다. 모르는 키는 버리고 아는 키만 돌려준다. */
export async function loadSettings<T extends object>(defaults: T): Promise<T> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return defaults;
    const merged = { ...defaults } as Record<string, unknown>;
    for (const k of Object.keys(defaults)) {
      const v = parsed[k];
      // 타입이 어긋나면 기본값을 쓴다. 저장 포맷이 바뀌어도 화면이 깨지지 않는다.
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
    await SecureStore.setItemAsync(KEY, JSON.stringify(settings));
  } catch {
    // 저장에 실패해도 이번 세션에는 적용된다. 설정 변경 자체를 막지 않는다.
  }
}
