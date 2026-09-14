import { Platform } from 'react-native';

/** App Store Connect의 앱 ID — 스토어 페이지·리뷰 쓰기 링크에 쓴다 */
export const APP_STORE_ID = '6810158091';

/** 스토어의 "리뷰 쓰기" 화면으로 바로 가는 주소 */
export const APP_STORE_REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
/** Android는 아직 미출시 — 출시하면 Play 링크가 된다. 지금은 애플 스토어로 보내지 않게만 막는다 */
export const PLAY_STORE_REVIEW_URL = 'https://play.google.com/store/apps/details?id=com.freepets.app';

/** 지금 플랫폼의 리뷰 쓰기 주소. 웹은 방문자 기기를 모르므로 iOS 주소를 쓴다 */
export const storeReviewUrl = () => (Platform.OS === 'android' ? PLAY_STORE_REVIEW_URL : APP_STORE_REVIEW_URL);
