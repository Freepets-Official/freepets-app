import * as StoreReview from 'expo-store-review';
import { Linking } from 'react-native';

import { storeReviewUrl } from '@/constants/app-store';

/**
 * 설정의 「앱 평가하기」 — **스토어의 리뷰 쓰기 페이지로 보낸다.**
 *
 * 인앱 리뷰 창(`requestReview`)을 버튼에서 부르면 안 된다. 애플 문서가 명시한다: "this method
 * may not present an alert, don't call requestReview() in response to a button tap". OS가
 * 1년에 3번까지만, 그것도 띄울지를 자기가 정하므로 사용자 눈엔 죽은 버튼이 된다.
 * 예전 구현은 `isAvailableAsync() && hasAction()`으로 "못 띄우는 상황"을 가린다고 했지만
 * `hasAction()`은 스토어 URL 유무일 뿐이라 그런 판별이 되지 않았다.
 */
export async function openStoreReview(): Promise<void> {
  await Linking.openURL(storeReviewUrl());
}

/**
 * 인앱 리뷰 창. **버튼이 아니라** 좋은 순간 뒤에 자동으로 부른다 — 예: 여권 도장을 찍고
 * 완료 화면을 본 직후. OS가 띄울지 말지를 정하므로 아무 일도 안 일어날 수 있고, 그래도 된다.
 * 아직 부르는 곳은 없다. 1.1에서 자리를 정한다.
 */
export async function promptInAppReview(): Promise<void> {
  try {
    if (await StoreReview.isAvailableAsync()) await StoreReview.requestReview();
  } catch {
    // 못 띄우는 기기·OS — 조용히 넘어간다
  }
}
