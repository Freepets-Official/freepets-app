import { useCallback, useEffect, useState } from 'react';

import { ownerApi, type OwnerFacility } from '@/lib/api';

/**
 * 사업자 대시보드의 매장 목록(`GET /owner/facilities`) — 카드·조건·지표·거부 요약·소개 초기값이 한 번에 온다.
 *
 * 화면마다 따로 부르면 대시보드 → 소개 → 혜택으로 오가며 같은 응답을 세 번 받는다. 모듈에 한 번
 * 받아두고 나눠 쓰되, 수정한 화면이 `refresh()`로 다시 받는다. 로그아웃하면 비운다(아래).
 */
let cache: OwnerFacility[] | null = null;
let inflight: Promise<OwnerFacility[]> | null = null;
const listeners = new Set<() => void>();

async function load(force: boolean): Promise<OwnerFacility[]> {
  if (cache && !force) return cache;
  if (!inflight) {
    inflight = ownerApi
      .facilities()
      .then((list) => {
        cache = list;
        listeners.forEach((l) => l());
        return list;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function clearOwnerFacilitiesCache() {
  cache = null;
  listeners.forEach((l) => l());
}

export function useOwnerFacilities() {
  const [facilities, setFacilities] = useState<OwnerFacility[] | null>(cache);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    setFailed(false);
    try {
      setFacilities(await load(true));
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFacilities(cache);
    listeners.add(onChange);
    if (!cache) {
      load(false)
        .then(setFacilities)
        .catch(() => setFailed(true));
    }
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  return { facilities, failed, refresh };
}
