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
