/** 웹 배포 주소 — 공유 링크의 바탕. 앱이 없는 사람도 이 주소로 열 수 있다 */
export const WEB_URL = 'https://freepets-app.vercel.app';

/**
 * 코스 공유 링크.
 *
 * 유니버설 링크(도메인 ↔ 앱 연결)는 아직 없어서 카톡에서 누르면 웹으로 열린다. 웹도 같은
 * 코드로 담을 수 있고, 앱이 있는 사람은 여행 코스 화면에서 코드를 직접 넣으면 된다.
 * `freepets://course?share=…` 스킴은 텍스트에서 눌러지지 않아 링크로 쓰지 않는다.
 */
export const courseShareUrl = (code: string) => `${WEB_URL}/course?share=${encodeURIComponent(code)}`;
