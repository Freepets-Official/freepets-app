import {
  getMessaging,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * 푸시 알림 — 거부 제보가 들어오면 그 시설을 판별해봤던 사람들에게 서버가 보낸다.
 *
 * **서버가 받는 건 FCM 등록 토큰이다.** `expo-notifications`의 `getDevicePushTokenAsync()`는
 * iOS에서 APNs 토큰을 주는데, 서버는 Firebase Admin SDK로 발송하므로 그 토큰으로는
 * 알림이 가지 않는다 — 게다가 **등록 API는 200으로 성공한다.** 조용히 안 오는 형태라
 * 디버깅이 어렵다. 그래서 Firebase SDK에서 직접 FCM 토큰을 받는다.
 *
 * 웹에는 붙이지 않는다. 웹 푸시는 서비스 워커와 VAPID 키가 따로 필요하고 서버에도 그
 * 설정이 없다. 웹에서는 홈 상단의 거부 경고(`GET /me/denial-alerts`)가 그 자리를 대신한다.
 */

/** 알림을 앱이 떠 있을 때도 배너로 띄운다. 거부 경고는 지금 보여야 의미가 있다. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** 시뮬레이터·웹에서는 푸시 토큰이 발급되지 않는다. 부르기 전에 걸러 헛된 실패를 만들지 않는다. */
export function isPushSupported(): boolean {
  return Platform.OS !== 'web' && Device.isDevice;
}

/**
 * 권한을 확인하고 FCM 등록 토큰을 받는다. 거부했거나 못 받으면 `null`.
 *
 * 권한을 이미 정했으면 다시 묻지 않는다 — 시스템 대화상자는 한 번만 뜨고, 두 번째부터는
 * 거부 상태가 그대로 돌아온다. 다시 켜려면 설정 앱으로 가야 한다.
 */
export async function getFcmToken(): Promise<string | null> {
  if (!isPushSupported()) return null;

  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted && settings.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    }
    if (!granted) return null;

    // v22부터 modular API만 있다(`messaging()` 기본 export 없음).
    const app = getMessaging();

    // iOS는 APNs 등록이 끝나야 FCM 토큰이 나온다. 순서를 지키지 않으면 빈 값이 온다.
    if (Platform.OS === 'ios' && !isDeviceRegisteredForRemoteMessages(app)) {
      await registerDeviceForRemoteMessages(app);
    }
    const token = await getToken(app);
    return token || null;
  } catch {
    // 권한·네트워크·Firebase 설정 어느 쪽이 막혀도 앱은 그대로 쓸 수 있어야 한다.
    return null;
  }
}

/** 서버가 보내는 data payload. 탭했을 때 어디로 갈지는 이 값으로 정한다. */
export type PushData = { facilityId?: string };

/**
 * 알림을 탭했을 때를 받는다. 앱이 떠 있을 때와 꺼져 있을 때가 경로가 달라 둘 다 다룬다.
 *
 * 반환한 함수를 부르면 구독을 끊는다.
 */
export function onNotificationTap(handler: (data: PushData) => void): () => void {
  if (!isPushSupported()) return () => {};

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handler((response.notification.request.content.data ?? {}) as PushData);
  });

  // 앱이 완전히 꺼진 상태에서 알림으로 열렸다면 위 리스너에는 안 걸린다. 마지막 응답을 한 번 본다.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handler((response.notification.request.content.data ?? {}) as PushData);
  });

  return () => sub.remove();
}
