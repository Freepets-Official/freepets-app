import type { Stamp } from '@/data/stamps';

/**
 * 웹은 SecureStore가 없다(네이티브 키체인이 없으므로). localStorage를 쓴다.
 *
 * 도장은 비밀이 아니라 저장 위치에 따른 절충이 없다. 이 도메인의 브라우저에만 남고
 * 다른 사용자에게 가지 않는다. 네이티브 구현과 같은 키를 쓰지만 저장소가 달라 서로
 * 공유되지는 않는다 — 2단계에서 서버로 옮기면 그때 하나로 합쳐진다.
 */
const KEY = 'freepets.stamps';

/** 저장 결과를 돌려준다(네이티브 구현과 같은 계약). 사생활 보호 모드·용량 초과에서 실패한다. */
export async function saveStamps(stamps: Stamp[]): Promise<boolean> {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stamps));
    return true;
  } catch {
    return false;
  }
}

export async function loadStamps(): Promise<Stamp[]> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
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
    ).map((s) => ({
      // `verifiedOnSite`는 나중에 생긴 값이다. 없는 옛 도장은 확인 안 된 것으로 본다 —
      // 화면이 `undefined`를 참으로 읽어 현장 배지를 잘못 다는 걸 막는다.
      ...s,
      verifiedOnSite: s.verifiedOnSite === true,
    }));
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
