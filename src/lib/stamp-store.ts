import * as SecureStore from 'expo-secure-store';

import type { Stamp } from '@/data/stamps';

/**
 * 여권 도장을 기기에 남긴다.
 *
 * 1단계는 서버에 도장 API가 없어 **로컬 저장이 유일한 보관처**다. 앱을 지우면 사라진다.
 * 2단계에서 서버로 옮길 때는 이 파일이 마이그레이션의 읽기 쪽이 된다.
 *
 * 세션과 같은 방식(네이티브 SecureStore, 웹은 `.web.ts`)을 쓴다. 도장은 비밀이 아니지만
 * 저장소를 하나 더 들이면 네이티브 모듈이 늘고, 그러면 개발 빌드를 다시 만들어야 한다.
 * 이미 쓰고 있는 것으로 해결되는 일에 빌드를 한 번 더 태울 이유가 없다.
 *
 * ⚠️ SecureStore는 값 하나가 커지면 안드로이드에서 경고가 난다(2KB 권장). 도장 한 건이
 * 150바이트 안팎이라 수십 개까지는 여유가 있지만, 서버로 옮기기 전에 수백 개가 쌓이는
 * 상황이 오면 그때는 저장소를 바꿔야 한다.
 */
const KEY = 'freepets.stamps';

export async function saveStamps(stamps: Stamp[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(stamps));
  } catch {
    // 저장에 실패해도 이번 세션의 도장첩은 메모리로 계속 보인다. 도장 찍기를 막지 않는다.
  }
}

export async function loadStamps(): Promise<Stamp[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 저장 형식이 바뀌었거나 값이 깨졌을 때 화면이 터지지 않게 최소 조건만 확인하고 거른다
    return parsed.filter(
      (s): s is Stamp =>
        typeof s?.facilityId === 'number' &&
        typeof s?.sido === 'string' &&
        typeof s?.sigungu === 'string',
    );
  } catch {
    return [];
  }
}

export async function clearStamps(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // 이미 없거나 접근 불가. 지우려던 목적은 달성된 것으로 본다.
  }
}
