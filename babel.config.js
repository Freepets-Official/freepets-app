/**
 * Reanimated 4는 워클릿을 바벨 플러그인이 변환해줘야 동작한다. 이 설정이 없으면
 * 네이티브에서 앱이 스플래시 직후 죽는다 — 스플래시 애니메이션이 워클릿을 쓴다.
 *
 * 웹에서는 드러나지 않아 여기까지 왔다. Reanimated가 웹에서는 다른 경로로 돌기 때문에
 * `expo export -p web`도, Vercel 배포도 멀쩡히 통과했다.
 *
 * ⚠️ worklets 플러그인은 **반드시 마지막**에 와야 한다. 다른 플러그인이 코드를 바꾼 뒤에
 *    워클릿을 찾아야 하기 때문이다.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
