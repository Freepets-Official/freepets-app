import * as SecureStore from 'expo-secure-store';

import type { Stamp } from '@/data/stamps';

/**
 * 여권 도장을 기기에 남긴다.
 *
 * 1단계는 서버에 도장 API가 없어 **로컬 저장이 유일한 보관처**다. 앱을 지우면 사라진다.
 * 2단계에서 서버로 옮길 때는 이 파일이 마이그레이션의 읽기 쪽이 된다.
 *
 * 세션과 같은 방식(네이티브 SecureStore, 웹은 `.web.ts`)을 쓴다. 저장소를 하나 더 들이면
 * 네이티브 모듈이 늘고 빌드를 다시 만들어야 해서, 이미 쓰는 것으로 해결한다.
 *
 * SecureStore의 2KB 권장치는 **키 하나의 값 전체**에 걸린다. 도장 한 건이 250~300바이트라
 * 한 키에 다 넣으면 7~8건에서 저장이 실패하고, 화면은 성공이라고 말한 채 앱을 다시 켜면
 * 그 뒤 도장이 사라져 있었다. 그래서 **4건씩 나눠 여러 키에** 둔다 — 키 하나가 ~1.2KB.
 * 도장 100개면 키 25개다. 옛 단일 키에 있던 도장은 처음 읽을 때 옮긴다.
 */
const LEGACY_KEY = 'freepets.stamps';
const COUNT_KEY = 'freepets.stamps.count';
const chunkKey = (i: number) => `freepets.stamps.${i}`;
const CHUNK = 4;

function sanitize(parsed: unknown): Stamp[] {
  if (!Array.isArray(parsed)) return [];
  // 저장 형식이 바뀌었거나 값이 깨졌을 때 화면이 터지지 않게 최소 조건만 확인하고 거른다.
  // `petIds`가 없으면 홈의 `s.petIds.includes(...)`가 TypeError를 내고 홈 탭 전체가 죽는다.
  return parsed
    .filter(
      (s): s is Stamp =>
        typeof s?.facilityId === 'number' &&
        typeof s?.sido === 'string' &&
        typeof s?.sigungu === 'string' &&
        Array.isArray(s?.petIds) &&
        typeof s?.createdAt === 'string',
    )
    // `verifiedOnSite`는 나중에 생긴 값이다. 없는 옛 도장은 확인 안 된 것으로 본다
    .map((s) => ({ ...s, verifiedOnSite: s.verifiedOnSite === true }));
}

/**
 * 저장 결과를 **돌려준다.** 실패를 삼키기만 하면 화면은 계속 성공이라고 말하고, 사용자는
 * 앱을 다시 켠 뒤에야 도장이 사라진 걸 안다. 도장 찍기 자체는 막지 않되 알리기는 한다.
 */
export async function saveStamps(stamps: Stamp[]): Promise<boolean> {
  try {
    const prevCount = Number((await SecureStore.getItemAsync(COUNT_KEY)) ?? 0) || 0;
    const chunks: Stamp[][] = [];
    for (let i = 0; i < stamps.length; i += CHUNK) chunks.push(stamps.slice(i, i + CHUNK));
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(chunkKey(i), JSON.stringify(chunks[i]));
    }
    // 개수는 조각을 다 쓴 뒤에 적는다 — 중간에 실패하면 옛 개수가 남아 옛 조각을 그대로 읽는다
    await SecureStore.setItemAsync(COUNT_KEY, String(chunks.length));
    for (let i = chunks.length; i < prevCount; i++) await SecureStore.deleteItemAsync(chunkKey(i)).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export async function loadStamps(): Promise<Stamp[]> {
  try {
    const countRaw = await SecureStore.getItemAsync(COUNT_KEY);
    if (countRaw === null) {
      // 옛 단일 키 → 나눠 저장으로 옮긴다. 옮긴 뒤에만 옛 키를 지운다
      const legacy = await SecureStore.getItemAsync(LEGACY_KEY);
      if (!legacy) return [];
      const stamps = sanitize(JSON.parse(legacy));
      if (await saveStamps(stamps)) await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => {});
      return stamps;
    }
    const count = Number(countRaw) || 0;
    const all: Stamp[] = [];
    for (let i = 0; i < count; i++) {
      const raw = await SecureStore.getItemAsync(chunkKey(i));
      if (raw) all.push(...sanitize(JSON.parse(raw)));
    }
    return all;
  } catch {
    return [];
  }
}

export async function clearStamps(): Promise<void> {
  try {
    const count = Number((await SecureStore.getItemAsync(COUNT_KEY)) ?? 0) || 0;
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(chunkKey(i)).catch(() => {});
    await SecureStore.deleteItemAsync(COUNT_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => {});
  } catch {
    // 이미 없거나 접근 불가. 지우려던 목적은 달성된 것으로 본다.
  }
}
