import { LoadState } from '@/components/load-state';
import type { OwnerFacility } from '@/lib/api';

/**
 * 사업자 화면들이 `useOwnerFacilities()`의 세 상태(불러오는 중 · 실패 · 매장 없음)를 같은 모양으로 그린다.
 *
 * 모양 자체는 앱 공용 `LoadState`가 그린다 — 사업자 화면만 다른 빈 화면을 볼 이유가 없다.
 * 여기 남은 것은 `facilities === null`이 곧 "아직 못 받았다"는 이 훅만의 계약뿐이다.
 */
export function OwnerLoadState({ facilities, failed, refresh }: { facilities: OwnerFacility[] | null; failed: boolean; refresh: () => Promise<void> }) {
  if (failed) return <LoadState kind="failed" message="매장 정보를 불러오지 못했어요." onRetry={() => void refresh()} size="page" />;
  if (facilities === null) return <LoadState kind="loading" size="page" />;
  return <LoadState kind="empty" message="등록된 매장이 없어요." size="page" />;
}
