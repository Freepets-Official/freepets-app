import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * 햅틱 피드백 래퍼 — 웹에서는 no-op(진동 API 없음), 네이티브에서만 동작.
 * 실패해도 조용히 무시(권한·미지원 기기 대비).
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptic = {
  /** 가벼운 탭 — 칩 선택·토글 등 */
  light: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** 중간 — 버튼·카드 진입 등 */
  medium: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  /** 성공 — 리뷰 등록·판별 완료·사업자 확정 등 */
  success: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** 경고 — 거부 판정·오류 */
  warning: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
