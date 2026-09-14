import { Alert, Platform } from 'react-native';

/**
 * 짧은 알림 창.
 *
 * react-native-web의 `Alert.alert`는 **빈 함수**다. 웹(Vercel 배포)에서 그대로 부르면 저장·삭제
 * 실패가 무음이 된다 — 행이 사라졌다 되돌아오는데 아무 설명이 없다. 웹은 브라우저 알림으로 대신한다.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
