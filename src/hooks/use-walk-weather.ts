import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import type { WeatherState } from '@/data/companion';
import type { Coords } from '@/lib/location';
import { fetchWalkWeather } from '@/lib/weather';
import { useAppStore } from '@/store/app-store';

/**
 * 홈 말풍선의 오늘 날씨.
 *
 * **홈에서는 위치 권한을 먼저 묻지 않는다.** 앱을 열자마자 권한 창이 뜨면 왜 필요한지 모른 채
 * 거절하기 쉽고, 한 번 거절하면 다시 묻기 어렵다. 이미 허락했으면 조용히 쓰고, 아니면
 * 말풍선이 "위치를 켜면 알려 줄게"라고 말하고 사용자가 눌렀을 때만 묻는다(`enable`).
 *
 * 탐색 탭이 잡아 둔 좌표(`lastCoords`)가 있으면 GPS를 다시 켜지 않는다.
 */
export function useWalkWeather(enabled: boolean): { state: WeatherState; enable: () => Promise<void> } {
  const { lastCoords, setLastCoords } = useAppStore();
  const [state, setState] = useState<WeatherState>({ status: 'loading' });

  const load = useCallback(
    async (ask: boolean) => {
      try {
        let coords: Coords | null = lastCoords;
        if (!coords) {
          const perm = ask
            ? await Location.requestForegroundPermissionsAsync()
            : await Location.getForegroundPermissionsAsync();
          if (!perm.granted) {
            // 예전에 거절해서 더 묻지 못하면 버튼이 아무 일도 안 하는 것처럼 보인다 — 설정을 연다
            if (ask && !perm.canAskAgain) void Linking.openSettings();
            setState({ status: 'no-permission' });
            return;
          }
          // 마지막으로 알던 위치면 충분하다 — 날씨는 동네 단위라 새로 잡느라 기다릴 필요가 없다
          const pos =
            (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 })) ??
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          // 스토어에 남기면 이 훅이 한 번 더 돌지만, 같은 동네라 날씨 캐시에서 바로 나온다
          setLastCoords(coords);
        }
        const data = await fetchWalkWeather(coords);
        setState(data ? { status: 'ready', data } : { status: 'error' });
      } catch {
        setState({ status: 'error' });
      }
    },
    [lastCoords, setLastCoords],
  );

  useEffect(() => {
    if (!enabled) return;
    // load는 비동기라 상태는 응답을 받은 뒤에야 바뀐다(동기 연쇄 렌더가 아니다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
    // 다른 앱에서 오래 있다 돌아오면 날씨가 바뀌었을 수 있다. 캐시가 30분이라 자주 불러도 괜찮다
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void load(false);
    });
    return () => sub.remove();
  }, [enabled, load]);

  const enable = useCallback(() => load(true), [load]);
  return { state, enable };
}
