/**
 * 웹에는 푸시를 붙이지 않는다.
 *
 * 웹 푸시는 서비스 워커와 VAPID 키가 따로 필요하고 서버에도 그 설정이 없다. 게다가
 * `@react-native-firebase/*`는 네이티브 모듈이라 웹 번들에 들어가면 빌드가 깨진다 —
 * 그래서 시그니처만 맞춘 이 파일이 웹에서 대신 실린다.
 *
 * 웹에서는 홈 상단의 거부 경고(`GET /me/denial-alerts`)가 푸시 자리를 대신한다.
 * 앱을 열어야 보이는 풀 방식이지만, 웹 사용자는 어차피 브라우저를 열고 들어온다.
 */

export type PushData = { facilityId?: string };

export function isPushSupported(): boolean {
  return false;
}

export async function getFcmToken(): Promise<string | null> {
  return null;
}

export function onNotificationTap(_handler: (data: PushData) => void): () => void {
  return () => {};
}
