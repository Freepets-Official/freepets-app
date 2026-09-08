import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { login as kakaoLogin } from '@react-native-seoul/kakao-login';
import NaverLogin from '@react-native-seoul/naver-login';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

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

const KAKAO_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY ?? '';
const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? '';
const NAVER_CLIENT_SECRET = process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET ?? '';
const NAVER_URL_SCHEME = process.env.EXPO_PUBLIC_NAVER_URL_SCHEME ?? 'freepets';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

/**
 * 키가 없으면 버튼을 내린다. 눌러야 실패하는 것보다, 아예 없는 편이 낫다 —
 * 키 하나가 빠진 빌드에서도 나머지 제공자로 로그인할 수 있어야 한다.
 *
 * 애플은 **iOS 전용**이다. 안드로이드용 SDK가 없고, 웹 플로우로 대신하려면 서버에
 * 콜백 엔드포인트가 필요한데 지금 없다. App Store 심사 가이드라인 4.8도 iOS에만 적용된다.
 */
export function isProviderAvailable(provider: SocialProvider): boolean {
  switch (provider) {
    case 'kakao':
      return KAKAO_KEY !== '';
    case 'naver':
      return NAVER_CLIENT_ID !== '' && NAVER_CLIENT_SECRET !== '';
    case 'google':
      return GOOGLE_IOS_CLIENT_ID !== '' || GOOGLE_WEB_CLIENT_ID !== '';
    case 'apple':
      return Platform.OS === 'ios';
  }
}

/** 네이버·구글 SDK는 쓰기 전에 한 번 초기화해야 한다. 두 번 불러도 문제는 없지만 한 번만 한다. */
let naverReady = false;
function initNaver() {
  if (naverReady) return;
  NaverLogin.initialize({
    appName: '반갑꼬리',
    consumerKey: NAVER_CLIENT_ID,
    consumerSecret: NAVER_CLIENT_SECRET,
    // 콘솔에 등록한 URL Scheme과 정확히 같아야 네이버 앱에서 돌아올 수 있다
    serviceUrlSchemeIOS: NAVER_URL_SCHEME,
  });
  naverReady = true;
}

let googleReady = false;
function initGoogle() {
  if (googleReady) return;
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    // webClientId가 있어야 idToken이 발급된다. 서버가 검증하는 값이 그것이다.
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
  });
  googleReady = true;
}

/**
 * 네이티브 소셜 로그인 — 각 제공자의 공식 SDK를 쓴다.
 *
 * 서버로 보내는 토큰의 **종류가 제공자마다 다르다**. 카카오·네이버는 access token,
 * 구글·애플은 id_token이다(서버가 JWKS로 서명을 검증한다). 잘못 보내면 OAUTH4002가 온다.
 *
 * 사용자가 창을 닫으면 `null`을 돌려준다 — 오류가 아니므로 화면에 실패를 띄우지 않는다.
 */
export async function getProviderToken(provider: SocialProvider): Promise<ProviderToken | null> {
  switch (provider) {
    case 'kakao': {
      const token = await kakaoLogin();
      return token?.accessToken ? { providerToken: token.accessToken } : null;
    }

    case 'naver': {
      initNaver();
      const res = await NaverLogin.login();
      if (!res.isSuccess || !res.successResponse) {
        // 사용자가 취소한 것과 실제 실패를 나눈다
        if (res.failureResponse?.isCancel) return null;
        throw new Error(res.failureResponse?.message || '네이버 로그인에 실패했어요.');
      }
      return { providerToken: res.successResponse.accessToken };
    }

    case 'google': {
      initGoogle();
      await GoogleSignin.hasPlayServices();
      const res = await GoogleSignin.signIn();
      // 취소하면 type이 'cancelled'로 온다
      if (res.type !== 'success') return null;
      const idToken = res.data?.idToken;
      if (!idToken) {
        // webClientId가 빠지면 여기로 온다. access token을 대신 보내면 서버가 거절한다.
        throw new Error('구글 로그인 정보를 받지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
      return { providerToken: idToken, email: res.data?.user?.email ?? undefined };
    }

    case 'apple': {
      // 애플만 취소를 예외로 던진다(다른 셋은 취소를 값으로 알려준다). 그대로 두면
      // 사용자가 시트를 닫았을 뿐인데 "로그인에 실패했어요"가 뜬다 — 이 함수의 계약은
      // "창을 닫으면 null"이므로 여기서 취소만 골라내고 나머지 오류는 그대로 올린다.
      let cred: AppleAuthentication.AppleAuthenticationCredential;
      try {
        cred = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
      } catch (e) {
        if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return null;
        throw e;
      }
      if (!cred.identityToken) return null;
      // 애플은 이름을 id_token에 담지 않고 **최초 인가 응답에서 한 번만** 준다.
      // 여기서 못 받으면 서버가 나중에 물어볼 방법이 없어, 그 한 번을 반드시 실어 보낸다.
      // 한국어는 성+이름 순으로 붙여야 "홍길동"이 된다.
      const n = cred.fullName;
      const name = [n?.familyName, n?.givenName].filter(Boolean).join('') || undefined;
      return {
        providerToken: cred.identityToken,
        name,
        email: cred.email ?? undefined,
      };
    }
  }
}

/** 네이티브에는 리다이렉트 왕복이 없다. 웹 구현(.web.ts)과 시그니처만 맞춘다. */
export async function readReturnedToken(): Promise<ProviderToken | null> {
  return null;
}
