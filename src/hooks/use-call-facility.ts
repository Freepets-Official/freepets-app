import { useCallback } from 'react';
import { Linking, Platform } from 'react-native';

import type { Facility } from '@/data/types';
import { primaryPhoneNumber } from '@/lib/phone';
import { useAppStore } from '@/store/app-store';

/**
 * 시설에 전화를 건다. **전화 버튼은 화면마다 있지만 규칙은 하나여야 한다** —
 * 어느 버튼으로 걸었느냐에 따라 신뢰도가 오르거나 안 오르면 사용자는 그 차이를 알 수 없다.
 *
 * ⚠️ 웹에서는 신뢰도를 올리지 않는다. react-native-web의 `Linking.open`은 tel: 핸들러가 없어도
 * 항상 resolve하고 `canOpenURL`도 무조건 true라, 전화가 열렸는지 판정할 방법이 없다.
 * 확인되지 않은 것을 확인됐다고 기록하는 쪽이, 확정 경로가 한 곳 없는 것보다 나쁘다.
 */
export function useCallFacility() {
  const { confirmFacility } = useAppStore();

  return useCallback(
    (facility: Facility) => {
      const tel = primaryPhoneNumber(facility.phone);
      if (!tel) return;
      Linking.openURL(`tel:${tel}`)
        .then(() => {
          if (Platform.OS !== 'web') confirmFacility(facility.facilityId);
        })
        .catch(() => {
          // 전화 앱을 못 열었으면 확인된 게 아니다. 신뢰도는 그대로 둔다.
        });
    },
    [confirmFacility],
  );
}
