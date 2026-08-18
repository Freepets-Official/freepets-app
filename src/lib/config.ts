/**
 * 앱 설정 — 환경변수(.env)에서 읽는다.
 *
 * Expo 규약: `EXPO_PUBLIC_` 접두어가 붙은 변수만 앱 번들에 주입된다(빌드 시점에 인라인).
 * ⚠️ 이 값들은 클라이언트에 그대로 노출되므로 '비밀'(API 키·비밀번호)은 넣지 않는다.
 *    API 주소는 공개돼도 무방하므로 여기서 관리한다.
 *
 * 값은 `.env`(로컬)·Vercel 환경변수(배포)에서 온다. 없으면 아래 기본값 사용.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://54.116.37.26';
