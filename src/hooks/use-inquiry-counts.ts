import { useEffect, useState } from 'react';

import { inquiryApi } from '@/lib/api';

/**
 * 매장별 조건 확인 요청 수(`GET /facilities/{id}/condition-inquiries/count`).
 *
 * 손님이 시설 상세에서 「조건 확인 요청」을 눌러 쌓은 수다. 대시보드 응답에 없어 매장마다 따로
 * 부른다 — 소유 매장은 한두 곳이라 요청이 늘어나는 부담은 작다.
 *
 * 실패한 매장은 결과에서 빠진다. 보조 지표라 실패를 화면에 알릴 만한 일이 아니고, 0으로 채우면
 * "아무도 안 물어봤다"는 틀린 말이 된다.
 */
export function useInquiryCounts(facilityIds: number[]): Record<number, number> {
  const [counts, setCounts] = useState<Record<number, number>>({});
  // 배열은 렌더마다 새로 만들어지므로 내용으로 의존성을 건다
  const key = facilityIds.join(',');

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const ids = key.split(',').map(Number);
    void Promise.all(
      ids.map((id) =>
        inquiryApi
          .count(id)
          .then((n) => [id, n] as const)
          .catch(() => null),
      ),
    ).then((rows) => {
      if (!alive) return;
      const next: Record<number, number> = {};
      for (const row of rows) if (row) next[row[0]] = row[1];
      setCounts(next);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return counts;
}
