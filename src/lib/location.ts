import * as Location from 'expo-location';

export type Coords = { latitude: number; longitude: number };

/**
 * 현재 위치(GPS). 웹은 브라우저 geolocation, 네이티브는 OS 위치를 쓴다(expo-location이 양쪽 처리).
 * 권한 거부·실패 시 null을 돌려주므로 호출부에서 폴백(안내/기본 위치)을 정한다.
 */
export async function getCurrentLocation(): Promise<Coords | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * 두 좌표 사이 거리(m) — 하버사인.
 *
 * 지구를 완전한 구로 보는 근사라 수 km 안에서는 오차가 무시할 만하다. 우리가 쓰는
 * 용도(주변 시설 정렬, 도장 현장 확인)에는 충분하고, 정밀 측지 계산은 과하다.
 */
export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * 도장을 "현장에서 찍었다"고 볼 반경(m).
 *
 * 1km는 GPS 오차를 감안한 값이다. 실내나 건물 사이에서 위치가 수백 m씩 튀기 때문에
 * 좁게 잡으면 정말 그 자리에 있는 사람이 실패한다. 부정 방지가 아니라 **집에서 찍은
 * 것과 구분하는 정도**가 목적이라 이 정도면 된다.
 */
export const ON_SITE_RADIUS_M = 1000;
