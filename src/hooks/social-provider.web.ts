import type { SocialProvider } from '@/lib/api';

import type { ProviderToken } from './social-provider';

export type { ProviderToken };

const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? '';

/** 리다이렉트 왕복 사이에 CSRF 방지용 state를 보관한다. 창을 새로 그리므로 메모리로는 못 넘긴다 */
const STATE_KEY = 'freepets.oauth.state';
const PENDING_KEY = 'freepets.oauth.provider';

/**
 * 웹에서 지금 쓸 수 있는 제공자.
 * 네이버만 먼저 붙였다 — 검수 신청에 동작 화면 캡처가 필요하고, 그게 마감(9/21) 대비
 * 가장 오래 걸리는 길이라 먼저 뚫는다. 카카오·구글은 같은 자리에 이어 붙이면 된다.
 */
export function isProviderAvailable(provider: SocialProvider): boolean {
  return provider === 'naver' && NAVER_CLIENT_ID !== '';
}

/**
 * 네이버 웹 로그인 — **암시적(implicit) 방식**이라 access token이 리다이렉트 URL 조각(#)으로 온다.
 *
 * ⚠️ **client secret을 쓰지 않는다.** 웹은 브라우저 개발자 도구로 번들이 그대로 보여서,
 * 시크릿이 필요한 authorization code 교환을 클라이언트에서 하면 그 값이 공개된다.
 * 서버가 access token만 있으면 `/v1/nid/me`로 검증할 수 있으므로 시크릿이 필요 없다.
 *
 * 반환값이 `null`이면 "사용자가 취소했다"는 뜻이고 오류가 아니다.
 */
export async function getProviderToken(provider: SocialProvider): Promise<ProviderToken | null> {
  if (provider !== 'naver') {
    throw new Error('웹에서는 아직 네이버 로그인만 지원해요.');
  }
  if (!NAVER_CLIENT_ID) {
    throw new Error('네이버 로그인 설정이 없어요.');
  }

  // 리다이렉트로 돌아온 직후라면 조각에 토큰이 들어 있다
  const returned = readReturnedToken();
  if (returned) return returned;

  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(PENDING_KEY, provider);

  const redirectUri = `${window.location.origin}/login`;
  const url =
    'https://nid.naver.com/oauth2.0/authorize' +
    `?response_type=token&client_id=${encodeURIComponent(NAVER_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  window.location.assign(url);
  // 페이지가 떠나므로 이 프로미스는 끝나지 않는다. 돌아온 뒤 위 readReturnedToken이 받는다.
  return new Promise<null>(() => {});
}

/**
 * 리다이렉트로 돌아왔는지 확인하고 토큰을 꺼낸다. 앱 시작 시 한 번 호출하면
 * "로그인 창에서 돌아온 직후"를 이어받을 수 있다.
 */
export function readReturnedToken(): ProviderToken | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash?.slice(1);
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  const state = params.get('state');
  if (!token) return null;

  const expected = sessionStorage.getItem(STATE_KEY);
  // 조각은 한 번만 쓰고 지운다 — 새로고침 때 같은 토큰으로 재시도하지 않도록
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(PENDING_KEY);

  // state가 다르면 우리가 시작한 로그인이 아니다(CSRF). 조용히 버린다.
  if (!expected || expected !== state) return null;
  return { providerToken: token };
}

/** 돌아온 직후인지 — 화면이 "로그인 처리 중"을 보여줄지 판단하는 데 쓴다 */
export function hasPendingRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(sessionStorage.getItem(PENDING_KEY)) || window.location.hash.includes('access_token');
}
