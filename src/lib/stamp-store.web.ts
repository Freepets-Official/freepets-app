import type { Stamp } from '@/data/stamps';

/**
 * 웹은 SecureStore가 없다(네이티브 키체인이 없으므로). localStorage를 쓴다.
 *
 * 도장은 비밀이 아니라 저장 위치에 따른 절충이 없다. 이 도메인의 브라우저에만 남고
 * 다른 사용자에게 가지 않는다. 네이티브 구현과 같은 키를 쓰지만 저장소가 달라 서로
 * 공유되지는 않는다 — 2단계에서 서버로 옮기면 그때 하나로 합쳐진다.
 */
const KEY = 'freepets.stamps';

export async function saveStamps(stamps: Stamp[]): Promise<void> {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stamps));
  } catch {
    // 사생활 보호 모드·저장 용량 초과 등. 이번 세션은 메모리로 계속 쓴다.
  }
}

export async function loadStamps(): Promise<Stamp[]> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
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
    window.localStorage.removeItem(KEY);
  } catch {
    // 이미 없거나 접근 불가. 지우려던 목적은 달성된 것으로 본다.
  }
}
