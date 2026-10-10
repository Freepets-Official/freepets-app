import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { inquiryApi } from '@/lib/api';

/**
 * 매장별 조건 확인 요청 수(`GET /facilities/{id}/condition-inquiries/count`).
 *
 * 손님이 시설 상세에서 「조건 확인 요청」을 눌러 쌓은 **건수**다(같은 손님도 하루 한 번씩 다시 쌓을 수
 * 있어 사람 수가 아니다). 대시보드 응답에 없어 매장마다 따로 부른다 — 소유 매장은 한두 곳이라 부담이 작다.
 *
 * 화면에 **돌아올 때마다** 다시 받는다. 대시보드는 스택에 남아 있어 마운트 기준으로 받으면 띄워 둔 사이
 * 들어온 요청이 안 보이고, 일시 장애로 한 번 실패하면 앱을 다시 켤 때까지 줄이 숨는다.
 *
 * 실패한 매장은 결과에서 빠진다. 보조 지표라 실패를 화면에 알릴 만한 일이 아니고, 0으로 채우면
 * "아무도 안 물어봤다"는 틀린 말이 된다.
 */
export function useInquiryCounts(facilityIds: number[]): Record<number, number> {
  const [counts, setCounts] = useState<Record<number, number>>({});
  // 배열은 렌더마다 새로 만들어지므로 내용으로 의존성을 건다
  const key = facilityIds.join(',');

  useFocusEffect(
    useCallback(() => {
      if (!key) {
        setCounts({});
        return;
      }
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
    }, [key]),
  );

  return counts;
}
