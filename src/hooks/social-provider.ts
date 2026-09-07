import type { SocialProvider } from '@/lib/api';

/**
 * 제공자에게서 받아 서버로 넘길 값.
 * `email`은 화면 표시용이고 계정 식별에는 쓰이지 않는다 — 서버는 (provider, providerId)로만
 * 사용자를 찾는다. 이메일은 사용자가 바꿀 수 있고 아예 없을 수도 있기 때문이다.
 */
export type ProviderToken = {
  providerToken: string;
  /** 애플 최초 로그인에서만 값이 있다. 그 한 번을 놓치면 서버가 다시 물어볼 방법이 없다 */
  name?: string;
  email?: string;
};

/**
 * 네이티브(iOS·Android) 경로 — 각 제공자의 SDK를 쓴다.
 *
 * 아직 SDK를 붙이지 않았다. 네 SDK 모두 네이티브 모듈이라 development build가 필요한데,
 * 네이버 검수에 필요한 캡처는 웹으로 먼저 만들기로 했다(EAS 빌드를 기다리지 않는 최단 경로).
 * 2단계에서 이 파일만 채우면 화면과 서버 교환 로직은 그대로 쓸 수 있다.
 */
export function isProviderAvailable(_provider: SocialProvider): boolean {
  return false;
}

export async function getProviderToken(_provider: SocialProvider): Promise<ProviderToken | null> {
  throw new Error('앱에서는 아직 소셜 로그인을 준비 중이에요. 웹에서 이용해 주세요.');
}

/** 네이티브에는 리다이렉트 왕복이 없다. 웹 구현(.web.ts)과 시그니처만 맞춘다. */
export function readReturnedToken(): ProviderToken | null {
  return null;
}
