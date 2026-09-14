/** 웹 배포 주소 — 공유 링크의 바탕. 앱이 없는 사람도 이 주소로 열 수 있다 */
export const WEB_URL = 'https://freepets-app.vercel.app';

/**
 * 코스 공유 링크.
 *
 * iOS는 유니버설 링크(AASA + `associatedDomains`)로 앱이 바로 열린다 — 도메인이 바뀌면
 * `app.json`·`public/.well-known/apple-app-site-association`·여기 셋을 같이 고쳐야 한다.
 * Android는 App Links를 붙이지 않아(공모전 범위 밖) 웹으로 열린다. 웹도 같은 코드로 담을 수
 * 있고, 앱이 있는 사람은 여행 코스 화면에서 코드를 직접 넣으면 된다.
 */
export const courseShareUrl = (code: string) => `${WEB_URL}/course?share=${encodeURIComponent(code)}`;
