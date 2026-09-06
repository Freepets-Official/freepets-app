import { useCallback } from 'react';
import { Linking } from 'react-native';

import type { Facility } from '@/data/types';
import { primaryPhoneNumber } from '@/lib/phone';
import { useAppStore } from '@/store/app-store';

/**
 * 시설에 전화를 건다. **전화 버튼은 화면마다 있지만 규칙은 하나여야 한다** —
 * 어느 버튼으로 걸었느냐에 따라 신뢰도가 오르거나 안 오르면 사용자는 그 차이를 알 수 없다.
 *
 * ⚠️ **여기서 신뢰도를 올리지 않는다.** `Linking.openURL`의 성공은 다이얼러가 열렸다는 뜻이지
 * 통화가 됐다는 뜻이 아니다 — 열고 바로 취소해도 성공으로 온다. 웹은 더 심해서, tel: 핸들러가
 * 없어도 `react-native-web`이 항상 resolve한다. 확인하지 않은 것을 '내가 전화로 확인'으로
 * 기록하면 헛걸음 방지라는 목적 자체가 무너지므로, **전화 앱에서 돌아왔을 때 한 번 묻고**
 * 사용자가 답해야 올린다(`CallConfirmSheet`).
 */
export function useCallFacility() {
  const { setPendingCallConfirm } = useAppStore();

  return useCallback(
    (facility: Facility) => {
      const tel = primaryPhoneNumber(facility.phone);
      if (!tel) return;
      Linking.openURL(`tel:${tel}`)
        .then(() => setPendingCallConfirm({ facilityId: facility.facilityId, name: facility.name }))
        .catch(() => {
          // 전화 앱을 못 열었으면 물어볼 것도 없다.
        });
    },
    [setPendingCallConfirm],
  );
}
