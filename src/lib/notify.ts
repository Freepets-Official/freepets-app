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

/**
 * 되돌릴 수 없는 일 앞의 확인 — 삭제 보험. 취소가 기본이고, 확인 버튼만 빨갛다.
 * 웹은 `window.confirm`(Alert 버튼이 웹에선 안 뜬다).
 */
export function confirmDialog(title: string, message: string, confirmLabel = '삭제'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
