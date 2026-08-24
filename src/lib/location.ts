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
