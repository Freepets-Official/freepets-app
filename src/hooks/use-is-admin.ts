import { useEffect, useState } from 'react';

import { adminApi } from '@/lib/api';

/**
 * 이 계정이 운영자인가.
 *
 * **물어볼 곳이 없어서 직접 해본다.** 계정 응답(`GET /users/me`)의 `profiles`는
 * `CONSUMER`·`OWNER` 둘뿐이고 운영자 값이 없다(라이브 Swagger 2026-09-22 확인).
 * 권한은 서버만 알고, 일반 계정이 운영자 API를 부르면 403이 온다.
 *
 * 그래서 목록을 **한 건만** 받아보고 통하면 운영자로 본다. 통하지 않으면 설정에 메뉴가
 * 아예 나타나지 않는다 — 일반 사용자에게 눌러도 안 되는 메뉴를 보여줄 이유가 없다.
 *
 * 결과는 **앱이 사는 동안 한 번만** 구한다. 설정 화면을 드나들 때마다 부르면 운영자가
 * 아닌 사람에게도 403이 계속 쌓인다.
 */
type Probe = 'unknown' | 'checking' | 'yes' | 'no';

let cached: Probe = 'unknown';
let inFlight: Promise<Probe> | null = null;

function probe(): Promise<Probe> {
  if (cached === 'yes' || cached === 'no') return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = adminApi
      .claims({ size: 1 })
      .then<Probe>(() => 'yes')
      .catch<Probe>(() => 'no')
      .then((r) => {
        cached = r;
        return r;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** 계정이 바뀌면 다시 물어야 한다 — 로그아웃 뒤 다른 계정으로 들어올 수 있다 */
export function resetAdminProbe() {
  cached = 'unknown';
  inFlight = null;
}

export function useIsAdmin(enabled: boolean): boolean {
  const [state, setState] = useState<Probe>(cached);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void probe().then((r) => alive && setState(r));
    return () => {
      alive = false;
    };
  }, [enabled]);

  return state === 'yes';
}
