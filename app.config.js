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
const fs = require('fs');
const path = require('path');

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

  /**
   * 푸시(FCM)는 `GoogleService-Info.plist`가 있어야 붙는다. 파일이 없으면 Firebase 플러그인을
   * 넣지 않는다 — 넣으면 **빌드가 그 자리에서 실패**하고, 푸시를 안 쓰는 사람까지 막힌다.
   *
   * 이 파일은 Firebase 콘솔 > 프로젝트 설정 > iOS 앱(`com.freepets.app`)에서 받는다.
   * 클라이언트에 배포되는 값이라 비밀은 아니지만 저장소에 올리지 않는다(`.env`와 같은 취급).
   *
   * ⚠️ **그래서 EAS 클라우드 빌드에는 이 파일이 올라가지 않는다** — EAS는 gitignore된 파일을
   * 빼고 업로드한다. 로컬만 보고 판단하면 **빌드는 성공하는데 푸시만 조용히 빠진다.**
   * EAS에서는 파일 타입 환경변수(`GOOGLE_SERVICES_INFO_PLIST`)로 받아 그 경로를 쓴다:
   *
   *   eas env:create --name GOOGLE_SERVICES_INFO_PLIST --type file \
   *     --value ./GoogleService-Info.plist --visibility sensitive --environment production
   */
  const iosFirebaseFile =
    process.env.GOOGLE_SERVICES_INFO_PLIST ?? path.join(__dirname, 'GoogleService-Info.plist');
  const hasFirebaseFile = fs.existsSync(iosFirebaseFile);
  const ios = { ...(config.ios ?? {}) };

  /**
   * `disableSPM`은 **plist가 없어도 항상 넣는다.**
   *
   * `@react-native-firebase/app`은 package.json의 의존성이라 **plist와 무관하게 autolink로
   * pod이 깔린다.** 그런데 이 설정을 plist가 있을 때만 붙이면, plist 없는 빌드에서는
   * pod이 SPM 경로로 풀려 **`Install pods` 단계에서 그대로 깨진다.**
   *
   * 실제로 2026-09-22에 걸렸다 — `preview` 프로파일로 처음 빌드했는데 `GOOGLE_SERVICES_INFO_PLIST`가
   * `production` 환경에만 등록돼 있어 pod 설치가 실패했다. 그때까지 여섯 번의 빌드가 전부
   * `production`이라 아무도 못 만난 함정이었다.
   *
   * ── `disableSPM`이 왜 필요한가 ──
   * RN 0.75부터 Firebase iOS SDK를 **Swift Package Manager**로 푸는 게 기본인데, SPM은
   * `use_frameworks! :linkage => :dynamic`을 요구한다. 그 설정은 Podfile 전체에 걸려서
   * **모든 네이티브 모듈의 링크 방식이 바뀐다** — 이미 실기기에서 검증을 끝낸 소셜 로그인
   * 4종(카카오·네이버·구글·애플)을 전부 다시 확인해야 한다. 그래서 Firebase만 CocoaPods로
   * 되돌린다. CocoaPods 모드는 static·dynamic 둘 다 지원해 나머지를 건드리지 않는다.
   */
  plugins.push(['@react-native-firebase/app', { ios: { disableSPM: true } }]);

  /**
   * 푸시 수신(messaging)과 설정 파일은 **plist가 있을 때만** 붙인다.
   *
   * plist 없이 messaging을 넣으면 Firebase 초기화가 실패한다. 푸시가 빠진 빌드는 나오지만
   * 앱은 정상으로 돌아간다 — UI 확인용 빌드에는 그쪽이 맞다.
   */
  if (hasFirebaseFile) {
    ios.googleServicesFile = iosFirebaseFile;
    plugins.push('@react-native-firebase/messaging');
  }

  return { ...config, ios, plugins };
};
