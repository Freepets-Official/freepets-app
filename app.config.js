/**
 * 동적 앱 설정 — 정적 부분은 app.json에 두고, **환경변수로 채워야 하는 값만** 여기서 넣는다.
 *
 * 이렇게 나눈 이유는 네이티브 SDK 설정에 커밋하면 안 되는 값이 섞이기 때문이다.
 * 카카오 네이티브 앱 키는 config plugin이 Info.plist의 URL Scheme으로 박아야 해서
 * 설정 파일에 값이 있어야 하는데, app.json은 저장소에 그대로 올라간다.
 *
 * 값은 로컬 `.env`(개발)와 EAS 환경변수(빌드)에서 온다. 없으면 그 플러그인만 빠지고
 * 나머지는 정상 빌드된다 — 키 하나가 없다고 빌드 전체가 죽지 않게 한다.
 */
const KAKAO_NATIVE_APP_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;
const NAVER_URL_SCHEME = process.env.EXPO_PUBLIC_NAVER_URL_SCHEME ?? 'freepets';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/**
 * 구글 iOS SDK가 요구하는 URL Scheme은 클라이언트 ID를 뒤집은 형태다.
 *   356768832426-abc.apps.googleusercontent.com
 *   → com.googleusercontent.apps.356768832426-abc
 * 콘솔에서 따로 주지 않으므로 여기서 만든다.
 */
function reversedGoogleScheme(clientId) {
  if (!clientId) return undefined;
  const suffix = '.apps.googleusercontent.com';
  if (!clientId.endsWith(suffix)) return undefined;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

module.exports = ({ config }) => {
  // app.json의 plugins에서 소셜 3종을 걷어내고, 옵션을 채워 다시 넣는다.
  // (app.json에는 이름만 있어 옵션이 비어 있다)
  const SOCIAL = [
    '@react-native-seoul/kakao-login',
    '@react-native-seoul/naver-login',
    '@react-native-google-signin/google-signin',
  ];
  const nameOf = (p) => (Array.isArray(p) ? p[0] : p);
  const plugins = (config.plugins ?? []).filter((p) => !SOCIAL.includes(nameOf(p)));

  if (KAKAO_NATIVE_APP_KEY) {
    plugins.push(['@react-native-seoul/kakao-login', { kakaoAppKey: KAKAO_NATIVE_APP_KEY }]);
  }
  // 네이버는 콘솔에 등록한 URL Scheme과 정확히 같아야 한다. 키가 필요 없어 항상 넣는다.
  plugins.push(['@react-native-seoul/naver-login', { urlScheme: NAVER_URL_SCHEME }]);

  const googleScheme = reversedGoogleScheme(GOOGLE_IOS_CLIENT_ID);
  if (googleScheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }]);
  }

  return { ...config, plugins };
};
