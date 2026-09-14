import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';

import { APP_STORE_REVIEW_URL } from '@/constants/app-store';

/**
 * 앱 평가하기.
 *
 * 되도록 **인앱 리뷰 창**(SKStoreReviewController)을 띄운다 — 앱을 떠나지 않고 별점을 남길 수
 * 있다. 다만 애플이 이 창을 1년에 3번까지만 보여주고, 그마저도 띄울지 말지를 OS가 정한다.
 * 그래서 사용자가 버튼을 눌렀는데 아무 일도 없을 수 있다. 못 띄우는 상황이 확인되면
 * 스토어의 리뷰 쓰기 페이지로 보낸다. 웹은 인앱 창이 없으니 바로 스토어로.
 *
 * ⚠️ 출시 전에는 스토어 페이지가 404라 심사자가 누르면 깨진 링크를 본다 — 설정 화면의
 * 플래그로 가려 두고 출시 확인 뒤에 켠다.
 */
export async function requestAppReview(): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      if ((await StoreReview.isAvailableAsync()) && (await StoreReview.hasAction())) {
        await StoreReview.requestReview();
        return;
      }
    } catch {
      // 인앱 창을 못 띄우는 기기·OS — 아래 폴백으로
    }
  }
  await Linking.openURL(APP_STORE_REVIEW_URL);
}
