import type { SocialProvider } from '@/lib/api';

import type { ProviderToken } from './social-provider';

export type { ProviderToken };

const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? '';
const NAVER_SDK_SRC = 'https://static.nid.naver.com/js/naveridlogin_js_sdk_2.0.2.js';

/**
 * 웹에서 지금 쓸 수 있는 제공자.
 * 네이버만 먼저 붙였다 — 검수 신청에 동작 화면 캡처가 필요하고, 그게 마감 대비 가장 오래
 * 걸리는 길이라 먼저 뚫는다. 카카오·구글은 같은 자리에 이어 붙이면 된다.
 */
export function isProviderAvailable(provider: SocialProvider): boolean {
  return provider === 'naver' && NAVER_CLIENT_ID !== '';
}

type NaverSdk = {
  LoginWithNaverId: new (opts: Record<string, unknown>) => {
    init: () => void;
    getLoginStatus: (cb: (status: boolean) => void) => void;
    accessToken?: { accessToken?: string };
    user?: { getEmail?: () => string; getNickName?: () => string };
  };
};

declare global {
  interface Window {
    naver?: NaverSdk;
  }
}

let sdkPromise: Promise<NaverSdk> | null = null;

/** SDK를 한 번만 로드한다. 두 화면(로그인·가입)에서 같이 쓰므로 중복 로드를 막는다. */
function loadNaverSdk(): Promise<NaverSdk> {
  if (window.naver?.LoginWithNaverId) return Promise.resolve(window.naver);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<NaverSdk>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = NAVER_SDK_SRC;
    el.async = true;
    el.onload = () =>
      window.naver?.LoginWithNaverId
        ? resolve(window.naver)
        : reject(new Error('네이버 로그인을 불러오지 못했어요.'));
    el.onerror = () => {
      sdkPromise = null;
      reject(new Error('네이버 로그인을 불러오지 못했어요. 네트워크를 확인해 주세요.'));
    };
    document.head.appendChild(el);
  });
  return sdkPromise;
}

/** SDK가 요구하는 숨은 컨테이너. 우리는 자체 버튼을 쓰므로 화면에 보이지 않게 둔다. */
function ensureButtonSlot(id: string) {
  if (document.getElementById(id)) return;
  const el = document.createElement('div');
  el.id = id;
  el.style.display = 'none';
  document.body.appendChild(el);
}

function createNaverLogin(sdk: NaverSdk) {
  ensureButtonSlot('naverIdLogin');
  const login = new sdk.LoginWithNaverId({
    clientId: NAVER_CLIENT_ID,
    // SDK가 돌아올 주소. 콘솔의 Callback URL과 정확히 같아야 한다.
    callbackUrl: `${window.location.origin}/login`,
    isPopup: false,
    // 로그인 창에서 돌아온 뒤 이 페이지에서 토큰을 파싱하게 한다
    callbackHandle: true,
    loginButton: { color: 'green', type: 3, height: 48 },
  });
  login.init();
  return login;
}

/**
 * 네이버 웹 로그인 — **공식 JavaScript SDK**를 쓴다.
 *
 * 직접 만든 리다이렉트 대신 SDK를 쓰는 이유: SDK는 access token을 그대로 돌려주는데,
 * 우리 백엔드 계약(`providerToken` = 네이버 access token)이 정확히 그 값을 요구한다.
 * authorization code 흐름으로 가면 code를 토큰으로 바꿔줄 서버 엔드포인트가 따로 필요하고,
 * 그 교환에는 client secret이 든다 — 웹 번들에 절대 실을 수 없는 값이다.
 * SDK는 state 생성·검증도 내부에서 처리한다.
 *
 * 반환이 `null`이면 "아직 로그인되지 않았다"는 뜻이고 오류가 아니다.
 */
export async function getProviderToken(provider: SocialProvider): Promise<ProviderToken | null> {
  if (provider !== 'naver') {
    throw new Error('웹에서는 아직 네이버 로그인만 지원해요.');
  }
  if (!NAVER_CLIENT_ID) {
    throw new Error('네이버 로그인 설정이 없어요.');
  }

  const sdk = await loadNaverSdk();
  const login = createNaverLogin(sdk);

  // 이미 돌아온 상태면 여기서 토큰이 잡힌다
  const already = await readStatus(login);
  if (already) return already;

  // 아직이면 네이버 로그인 창으로 보낸다. 페이지가 떠나므로 이 프로미스는 끝나지 않고,
  // 돌아온 뒤 readReturnedToken이 이어받는다.
  document.getElementById('naverIdLogin')?.querySelector('a')?.click();
  return new Promise<null>(() => {});
}

function readStatus(login: ReturnType<typeof createNaverLogin>): Promise<ProviderToken | null> {
  return new Promise((resolve) => {
    try {
      login.getLoginStatus((status) => {
        const token = login.accessToken?.accessToken;
        if (!status || !token) return resolve(null);
        resolve({
          providerToken: token,
          email: login.user?.getEmail?.(),
        });
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * 네이버 로그인 창에서 돌아온 직후를 이어받는다.
 * SDK가 URL 조각(#)에 담아 온 토큰을 파싱하므로, 조각이 있을 때만 SDK를 깨운다.
 */
export async function readReturnedToken(): Promise<ProviderToken | null> {
  if (typeof window === 'undefined') return null;
  if (!window.location.hash.includes('access_token')) return null;
  if (!NAVER_CLIENT_ID) return null;

  try {
    const sdk = await loadNaverSdk();
    const login = createNaverLogin(sdk);
    const got = await readStatus(login);
    // 조각은 한 번만 쓴다 — 새로고침으로 같은 토큰을 다시 보내지 않도록
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return got;
  } catch {
    return null;
  }
}
