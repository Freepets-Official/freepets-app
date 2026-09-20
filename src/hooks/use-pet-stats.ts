import { useEffect, useState } from 'react';

import { petStatsApi, type PetStats } from '@/lib/api';

/**
 * 아이별 기록(함께한 발자국) — 서버 값.
 *
 * 홈에 아이 카드가 여러 장이라 아이마다 한 번씩 부르게 되는데, 값이 자주 바뀌지 않아
 * **모듈 캐시에 담아 두고 한 번만 받는다.** 로그아웃하면 비운다.
 * 실패하면 `null`을 돌려주고, 화면은 기기 기록으로 센 값으로 떨어진다.
 */
const cache = new Map<number, PetStats>();
const inflight = new Map<number, Promise<PetStats>>();

export function clearPetStatsCache() {
  cache.clear();
  inflight.clear();
}

export function usePetStats(petId: number): PetStats | null {
  const [stats, setStats] = useState<PetStats | null>(cache.get(petId) ?? null);
  // 카드가 다른 아이로 바뀌면 useState 초기값은 그대로다 — 캐시에 있으면 그 값을 바로 쓴다
  const current = cache.get(petId) ?? (stats && stats === cache.get(petId) ? stats : null) ?? stats;

  useEffect(() => {
    let alive = true;
    // 캐시는 useState 초기값으로 이미 읽었다. 여기서 다시 setState하면 렌더가 연쇄된다
    if (cache.has(petId)) return;
    let req = inflight.get(petId);
    if (!req) {
      req = petStatsApi.get(petId).then((s) => {
        cache.set(petId, s);
        inflight.delete(petId);
        return s;
      });
      req.catch(() => inflight.delete(petId));
      inflight.set(petId, req);
    }
    req.then((s) => alive && setStats(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [petId]);

  return cache.get(petId) ?? current;
}
