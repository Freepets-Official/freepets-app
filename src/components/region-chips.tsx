import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/chip';
import { Spacing } from '@/constants/theme';
import { type Region } from '@/data/types';
import { facilitiesApi } from '@/lib/api';

/**
 * 시도 → 시군구 2단계 지역 칩.
 *
 * 발자국 랭킹과 탐색 '전체'가 같은 것을 쓴다. 목록도 코드도 서버가 준다 —
 * 지명을 앱에 박아두면 `강원도`/`강원특별자치도` 같은 개편에 그대로 깨진다.
 *
 * 목록이 비어 있으면 연동 실패가 아니라 서버의 지역 테이블이 아직 안 찼다는 뜻이라,
 * 칩을 통째로 숨기지 않고 '전국'만 남긴다(화면이 사라지는 것보다 낫다).
 */
/**
 * 지역 목록을 앱 전체에서 **한 번만** 받는다.
 *
 * 탐색의 '전체'와 '발자국 랭킹'이 같은 목록을 쓰는데, 각자 받으면 토글을 오갈 때마다
 * 서버를 다시 부른다. 모드 전환은 자주 일어나므로 모듈 수준에 들고 있는다.
 * 실패는 빈 배열로 떨어뜨린다 — 지역 칩이 없다고 화면 전체가 막히면 안 된다.
 */
let regionCache: Region[] | null = null;
let regionInFlight: Promise<Region[]> | null = null;

function loadRegions(): Promise<Region[]> {
  if (regionCache) return Promise.resolve(regionCache);
  if (!regionInFlight) {
    regionInFlight = facilitiesApi
      .regions()
      .then((r) => {
        regionCache = r;
        return r;
      })
      .catch(() => [] as Region[])
      .finally(() => {
        regionInFlight = null;
      });
  }
  return regionInFlight;
}

/** 시도 목록. 로딩 중에는 빈 배열이라 '전국' 칩만 보인다. */
export function useRegions(): Region[] {
  const [regions, setRegions] = useState<Region[]>(regionCache ?? []);
  useEffect(() => {
    let active = true;
    loadRegions().then((r) => active && setRegions(r));
    return () => {
      active = false;
    };
  }, []);
  return regions;
}

export function RegionChips({
  sidoCode,
  sigunguCode,
  onChange,
  allLabel = '전국',
}: {
  sidoCode: string | null;
  sigunguCode: string | null;
  onChange: (next: { sidoCode: string | null; sigunguCode: string | null }) => void;
  allLabel?: string;
}) {
  const regions = useRegions();
  const selectedSido = regions.find((r) => r.sidoCode === sidoCode) ?? null;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label={allLabel}
          selected={sidoCode === null}
          onPress={() => onChange({ sidoCode: null, sigunguCode: null })}
        />
        {regions.map((r) => (
          <Chip
            key={r.sidoCode}
            label={r.sido}
            selected={sidoCode === r.sidoCode}
            // 시도를 바꾸면 시군구는 반드시 비운다 — 경기도의 시군구 코드를 강원도에 들고 가면
            // 서버가 빈 목록을 주고 사용자는 이유를 알 수 없다
            onPress={() =>
              onChange(
                sidoCode === r.sidoCode
                  ? { sidoCode: null, sigunguCode: null }
                  : { sidoCode: r.sidoCode, sigunguCode: null },
              )
            }
          />
        ))}
      </ScrollView>

      {selectedSido && selectedSido.sigungus.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip
            label="전체"
            selected={sigunguCode === null}
            onPress={() => onChange({ sidoCode, sigunguCode: null })}
          />
          {selectedSido.sigungus.map((sg) => (
            <Chip
              key={sg.sigunguCode}
              label={sg.sigungu}
              selected={sigunguCode === sg.sigunguCode}
              onPress={() =>
                onChange({
                  sidoCode,
                  sigunguCode: sigunguCode === sg.sigunguCode ? null : sg.sigunguCode,
                })
              }
            />
          ))}
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingRight: Spacing.lg, paddingBottom: 2 },
});
