import { Linking, Platform } from 'react-native';

/**
 * 시설을 지도에서 연다. **네이버 지도**를 쓴다.
 *
 * 구글맵을 쓰면 안 된다 — 한국은 지도 데이터 반출 규제로 구글의 국내 POI·길찾기가
 * 부실하다. 「폴햄키즈 세이브존 화정점」 같은 상호는 안 나오거나 엉뚱한 곳을 찍는다.
 * 이 앱은 관광공사 데이터로 국내 시설만 다루므로 국내 지도가 맞다.
 *
 * 지도를 **여는** 데는 API 키가 필요 없다. 키가 필요한 건 앱 안에 지도를 그리는
 * 경우(네이버 클라우드 플랫폼 Maps SDK)다.
 */

/** `nmap://`이 요구하는 호출 앱 식별자. app.json의 ios.bundleIdentifier와 같아야 한다. */
const APP_NAME = 'com.freepets.app';

const NAVER_WEB = 'https://map.naver.com/p/search/';

export type MapTarget = {
  name: string;
  address?: string | null;
  latitude?: number;
  longitude?: number;
};

function query(t: MapTarget): string {
  return encodeURIComponent(`${t.name} ${t.address ?? ''}`.trim());
}

function appUrl(t: MapTarget): string {
  const name = encodeURIComponent(t.name);
  // 좌표가 있으면 핀을 정확히 찍는다. 상호 검색은 동명 매장이 많아 빗나가기 쉽다.
  return Number.isFinite(t.latitude) && Number.isFinite(t.longitude)
    ? `nmap://place?lat=${t.latitude}&lng=${t.longitude}&name=${name}&appname=${APP_NAME}`
    : `nmap://search?query=${query(t)}&appname=${APP_NAME}`;
}

/**
 * 네이버 지도 앱이 있으면 앱으로, 없으면 웹으로 연다.
 *
 * `canOpenURL`은 Info.plist의 `LSApplicationQueriesSchemes`에 `nmap`이 있어야 true를
 * 돌려준다(app.json에 넣어뒀다). 목록에 없으면 앱이 깔려 있어도 false가 나와
 * 항상 웹으로 새는데, 그래도 화면은 뜨므로 치명적이진 않다.
 */
export async function openInMap(t: MapTarget): Promise<void> {
  const web = `${NAVER_WEB}${query(t)}`;
  if (Platform.OS !== 'web') {
    try {
      const scheme = appUrl(t);
      if (await Linking.canOpenURL(scheme)) {
        await Linking.openURL(scheme);
        return;
      }
    } catch {
      // 스킴 조회·실행 실패는 웹으로 이어서 처리한다
    }
  }
  await Linking.openURL(web).catch(() => {
    // 브라우저조차 못 여는 경우. 여기서 할 수 있는 게 없어 조용히 둔다.
  });
}
