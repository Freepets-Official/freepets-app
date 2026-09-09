import * as Device from 'expo-device';
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
 *
 * ⚠️ **네이티브 모듈을 파일 최상단에서 import하지 않는다.**
 *
 * `expo-notifications`와 `@react-native-firebase/messaging`은 import되는 순간 네이티브
 * 모듈을 찾는다. 그게 없는 빌드에서는 거기서 예외가 나는데, 이 파일은
 * 스토어 → 테마 → 탭 레이아웃으로 이어지는 **최상위 의존**이라 화면 하나가 아니라
 * **앱이 통째로 뜨지 않는다.**
 *
 * 실제로 두 번 겪었다. 푸시를 넣기 전에 만든 개발 빌드에 새 JS를 물리자
 * `Native module NativeRNFBTurboApp is not registered`로, 그걸 고치자 이번엔
 * `Cannot find native module 'ExpoPushTokenManager'`로 시작조차 못 했다.
 *
 * 그래서 **실제로 쓸 때만** 안에서 require하고, 실패하면 푸시 기능만 꺼진 채로 앱은 돈다.
 * 새 빌드를 만들면 당장은 풀리지만, 팀원이 옛 빌드를 쓰거나 프로덕션에서 모듈 초기화가
 * 실패할 때 같은 일이 반복된다 — 구조로 막는 게 맞다.
 */

type NotificationsModule = typeof import('expo-notifications');

/** `undefined` = 아직 안 불러봄, `null` = 이 빌드에 없음. 한 번 실패하면 다시 시도하지 않는다. */
let notifications: NotificationsModule | null | undefined;

function loadNotifications(): NotificationsModule | null {
  if (notifications !== undefined) return notifications;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as NotificationsModule;
    // 앱이 떠 있을 때도 배너로 띄운다. 거부 경고는 지금 보여야 의미가 있다.
    // 모듈을 처음 여는 이 자리에서 한 번만 건다.
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    notifications = mod;
  } catch {
    notifications = null;
  }
  return notifications;
}

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

  const Notifications = loadNotifications();
  if (!Notifications) return null;

  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted =
      settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted && settings.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted =
        asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    }
    if (!granted) return null;

    // v22부터 modular API만 있다(`messaging()` 기본 export 없음).
    const {
      getMessaging,
      getToken,
      isDeviceRegisteredForRemoteMessages,
      registerDeviceForRemoteMessages,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
    } = require('@react-native-firebase/messaging') as typeof import('@react-native-firebase/messaging');

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

  const Notifications = loadNotifications();
  if (!Notifications) return () => {};

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handler((response.notification.request.content.data ?? {}) as PushData);
  });

  // 앱이 완전히 꺼진 상태에서 알림으로 열렸다면 위 리스너에는 안 걸린다. 마지막 응답을 한 번 본다.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handler((response.notification.request.content.data ?? {}) as PushData);
  });

  return () => sub.remove();
}
