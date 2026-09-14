import { useEffect, useState } from 'react';

import type { Category, Facility } from '@/data/types';
import { facilitiesApi } from '@/lib/api';
import { getCurrentLocation, type Coords } from '@/lib/location';
import { useAppStore } from '@/store/app-store';

/** 위치를 안 주면 여기서 찾는다(서울시청). 키워드로 좁히면 전국 어디든 나온다 */
const FALLBACK_CENTER: Coords = { latitude: 37.5665, longitude: 126.978 };
/**
 * 키워드 없이 둘러볼 때만 반경을 건다(주변 30km). 키워드가 있으면 **반경을 보내지 않는다** —
 * 명세(`api-specs/facility.md`)대로 생략하면 전국이다. 사장님이 매장 앞에서 등록한다는 보장이
 * 없다(집에서, 여행지에서). 한때 상한 100km를 보내 스스로 막고 있었다.
 */
const NEARBY_M = 30_000;
const PAGE_SIZE = 30;

/**
 * 내 매장 찾기 — 서버 검색(`POST /facilities/search`)을 키워드·내 위치로.
 *
 * 예전에는 사업자 화면 둘 다 목 `FACILITIES`에서 골랐다. 목은 데모 12곳뿐이라 실제
 * 사장님은 자기 매장을 **찾을 수가 없었다.** 코스 빌더가 쓰는 검색을 그대로 가져온다.
 *
 * 기준점은 한 번만 잡는다. 탐색 탭이 잡아둔 좌표가 있으면 권한을 다시 묻지 않고, 없으면
 * GPS를 요청하고, 그것도 거부되면 기본 중심으로 둔다 — 위치를 안 준다고 등록을 못 하게 할
 * 이유는 없다. 검색 결과는 상세 캐시에 넣어 뒤 화면이 이름·주소를 바로 그릴 수 있게 한다.
 */
export function useFacilityPicker(enabled: boolean, category?: Category) {
  const { lastCoords, setLastCoords, registerFacilities } = useAppStore();
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState<Coords | null>(null);
  /** 위치를 못 받아 기본 중심(서울시청)으로 검색했는가 — 그때의 거리는 사용자의 거리가 아니다 */
  const [centerIsFallback, setCenterIsFallback] = useState(false);
  const [items, setItems] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!enabled || center) return;
    let active = true;
    void (async () => {
      const c = lastCoords ?? (await getCurrentLocation());
      if (!active) return;
      if (c && !lastCoords) setLastCoords(c);
      setCenterIsFallback(!c);
      setCenter(c ?? FALLBACK_CENTER);
    })();
    return () => {
      active = false;
    };
  }, [enabled, center, lastCoords, setLastCoords]);

  useEffect(() => {
    if (!enabled || !center) return;
    let active = true;
    // 타이핑 중에는 잠깐 기다린다. 첫 목록(키워드 없음)은 바로 받는다
    const t = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await facilitiesApi.search({
          latitude: center.latitude,
          longitude: center.longitude,
          keyword: query.trim() || undefined,
          category,
          ...(query.trim() ? {} : { radiusM: NEARBY_M }),
          size: PAGE_SIZE,
        });
        if (!active) return;
        // 서울시청 기준 거리를 "내 거리"처럼 보여주거나 캐시에 남기지 않는다
        const items = centerIsFallback ? res.items.map((f) => ({ ...f, distanceM: null })) : res.items;
        registerFacilities(items);
        setItems(items);
      } catch {
        if (active) {
          setItems([]);
          setFailed(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, query ? 400 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [enabled, center, centerIsFallback, query, category, retry, registerFacilities]);

  return { query, setQuery, items, loading, failed, retry: () => setRetry((n) => n + 1) };
}
