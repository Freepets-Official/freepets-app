import Constants from 'expo-constants';

/**
 * 앱 설정 — 환경변수(.env)에서 읽는다.
 *
 * Expo 규약: `EXPO_PUBLIC_` 접두어가 붙은 변수만 앱 번들에 주입된다(빌드 시점에 인라인).
 * ⚠️ 이 값들은 클라이언트에 그대로 노출되므로 '비밀'(API 키·비밀번호)은 넣지 않는다.
 *    API 주소는 공개돼도 무방하므로 여기서 관리한다.
 *
 * 값은 `.env`(로컬)·Vercel 환경변수(배포)에서 온다. 없으면 아래 기본값 사용.
 */
/**
 * 서버 주소. 2026-09-13에 IP에서 nip.io 도메인으로 옮겼다.
 *
 * IP 앞으로는 Let's Encrypt 인증서가 나오지 않아 브라우저가 막았다. `3.35.195.228.nip.io`는
 * 그 IP를 가리키는 무료 와일드카드 DNS라, 도메인 이름으로 정식 인증서를 받을 수 있다.
 * **IP로 직접 부르면 인증서 이름이 안 맞아 실패하므로 이 도메인을 써야 한다.**
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://3.35.195.228.nip.io';

/**
 * 개발용 10년 테스트 토큰. 로그인 흐름이 붙기 전까지 보호 API를 이 토큰으로 호출한다.
 * ⚠️ 개발 편의 전용 — `authedFetch`에서 `__DEV__`일 때만 사용하고, 운영 빌드엔 실리지 않는다.
 */
export const DEV_TOKEN = process.env.EXPO_PUBLIC_DEV_TOKEN ?? null;

/**
 * 개발 확인용 도구(설정 › 개발자)를 보일지.
 *
 * 개발 서버(`__DEV__`)만으로는 모자라다 — 실기기 확인은 Ad Hoc(`preview`) 빌드로 하는데 그건
 * 릴리스 모드라 `__DEV__`가 거짓이다. 그래서 `eas.json`의 development·preview 프로파일에만
 * `EXPO_PUBLIC_DEBUG_TOOLS=1`을 걸었다. production에는 없으므로 스토어 빌드엔 나타나지 않는다.
 */
export const DEBUG_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_TOOLS === '1';

/**
 * 설정 화면에 보여 줄 앱 버전. `app.json`의 `version`이 빌드에 실린 값이다.
 *
 * 설정 화면에 "1.0.0"이 박혀 있어 1.1.x를 배포하는 내내 틀린 버전이 보였다. 손으로 고치면
 * 다음 출시 때 또 어긋나므로 빌드에 실린 설정에서 읽는다. 빌드 번호는 EAS가 원격으로 매겨
 * (`appVersionSource: remote`) 이 값과 어긋날 수 있어 보여 주지 않는다.
 */
export const APP_VERSION = Constants.expoConfig?.version ?? null;

/**
 * 이 빌드를 만든 커밋·EAS 프로파일. 설정 › 개발자에서 실기기에 깔린 빌드를 가리는 데 쓴다.
 * EAS 빌드에서만 채워지고 로컬 실행(`expo start`)에서는 null이다.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
// 설정 직렬화가 값을 다른 모양으로 바꿔 올 수 있다(빈 값 → {}). 문자열일 때만 믿는다
const asText = (v: unknown) => (typeof v === 'string' && v ? v : null);
export const BUILD_COMMIT = asText(extra.buildCommit)?.slice(0, 7) ?? null;
export const BUILD_PROFILE = asText(extra.buildProfile);
