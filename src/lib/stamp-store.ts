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
 * ⚠️ **한계가 생각보다 빠듯하다.** SecureStore의 2KB 권장치는 항목당이 아니라 **키 하나의
 * 값 전체**에 걸린다. 도장 한 건이 시설명·지역·사진 경로를 합쳐 250~300바이트라
 * (iOS 피커 경로만 150바이트를 넘는다) **7~8건이면 한계에 닿는다.**
 * 넘으면 `setItemAsync`가 실패하는데 아래 catch가 삼켜서, 화면은 계속 성공이라고 말한 채
 * 앱을 다시 켜면 그 이후 도장이 사라져 있다. 웹(localStorage 5MB)에서는 안 나타나는
 * 네이티브 전용 증상이다. **2단계 서버 이전이 늦어지면 저장소부터 바꿔야 한다.**
 */
const KEY = 'freepets.stamps';

/**
 * 저장 결과를 **돌려준다.** 실패를 삼키기만 하면 화면은 계속 성공이라고 말하고, 사용자는
 * 앱을 다시 켠 뒤에야 도장이 사라진 걸 안다. 도장 찍기 자체는 막지 않되 알리기는 한다.
 */
export async function saveStamps(stamps: Stamp[]): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(stamps));
    return true;
  } catch {
    return false;
  }
}

export async function loadStamps(): Promise<Stamp[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 저장 형식이 바뀌었거나 값이 깨졌을 때 화면이 터지지 않게 최소 조건만 확인하고 거른다
    // 화면이 실제로 역참조하는 필드까지 본다. `petIds`가 없으면 홈의 `s.petIds.includes(...)`가
    // TypeError를 내고 **홈 탭 전체가 죽는다** — 웹 localStorage는 사용자가 직접 고칠 수 있고,
    // 저장 포맷이 바뀌면 구버전 레코드도 남는다.
    return parsed.filter(
      (s): s is Stamp =>
        typeof s?.facilityId === 'number' &&
        typeof s?.sido === 'string' &&
        typeof s?.sigungu === 'string' &&
        Array.isArray(s?.petIds) &&
        typeof s?.createdAt === 'string',
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
