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
 * 한 줄 입력 — 코스 이름 바꾸기 같은 가벼운 편집. iOS는 `Alert.prompt`, 웹은 `window.prompt`.
 * Android는 RN에 prompt가 없어 null을 돌려준다(공모전 범위 밖).
 */
export function promptText(title: string, message: string, initial = ''): Promise<string | null> {
  if (Platform.OS === 'web') return Promise.resolve(window.prompt(`${title}\n\n${message}`, initial));
  if (Platform.OS !== 'ios') return Promise.resolve(null);
  return new Promise((resolve) => {
    Alert.prompt(
      title,
      message,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(null) },
        { text: '저장', onPress: (v?: string) => resolve(v ?? null) },
      ],
      'plain-text',
      initial,
    );
  });
}
