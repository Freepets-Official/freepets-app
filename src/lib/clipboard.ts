import { Platform } from 'react-native';

/**
 * 클립보드 복사. 네이티브 클립보드 모듈은 아직 안 넣었다 — 지금은 웹 공유 시트 폴백에만 쓰인다.
 * 못 복사하면 false를 돌려주고, 호출한 쪽이 화면에 값을 그대로 보여준다.
 */
export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
