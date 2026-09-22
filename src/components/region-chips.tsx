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

/**
 * 「수원시」와 「수원시 장안구」가 **같은 목록에 나란히** 들어 있다.
 *
 * 서버 지역 목록은 평평하다. 그래서 이름이 `"{상위} "`로 시작하는 항목을 하위 구로 본다 —
 * 코드로는(110 vs 111) 부모 자식을 알 수 없고, 앱에 지명을 박으면 행정구역 개편에 깨진다.
 */
function childrenOf(all: Region['sigungus'], parent: string) {
  return all.filter((s) => s.sigungu.startsWith(`${parent} `));
}

/** 다른 항목의 하위가 아닌 것 — 칩 두 번째 줄에 놓을 것들 */
function topLevel(all: Region['sigungus']) {
  return all.filter((s) => !all.some((o) => o !== s && s.sigungu.startsWith(`${o.sigungu} `)));
}

/**
 * 고른 시군구가 구를 가진 「시」인지 알려준다.
 *
 * 탐색 화면이 "결과 0건"을 만났을 때 쓴다 — 수원시·성남시·고양시 등 일곱 곳은 상위 시 코드로
 * 물으면 0건인데 구로 물으면 수백 곳이 나온다(2026-09-22 실측: 수원 704, 고양 704, 용인 656).
 * 그냥 "시설이 없어요"로 끝내면 사용자는 그 도시에 정말 없는 줄 안다.
 *
 * 규칙으로 못 박지 않고 화면이 실제 결과를 보고 판단하게 두는 이유는 **화성시가 반대**이기
 * 때문이다 — 구가 2026년에 신설돼 데이터 대부분(304건)이 아직 시 단위에 남아 있고 구는 78건뿐이다.
 */
export function sigunguHasDistricts(regions: Region[], sidoCode: string | null, sigunguCode: string | null) {
  if (!sidoCode || !sigunguCode) return false;
  const sido = regions.find((r) => r.sidoCode === sidoCode);
  const picked = sido?.sigungus.find((s) => s.sigunguCode === sigunguCode);
  return !!sido && !!picked && childrenOf(sido.sigungus, picked.sigungu).length > 0;
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
  const tops = selectedSido ? topLevel(selectedSido.sigungus) : [];
  // 고른 것이 구면 그 부모 시를, 시면 자기 자신을 두 번째 줄의 선택으로 본다
  const selectedTop =
    selectedSido && sigunguCode
      ? tops.find(
          (t) =>
            t.sigunguCode === sigunguCode ||
            childrenOf(selectedSido.sigungus, t.sigungu).some((c) => c.sigunguCode === sigunguCode),
        ) ?? null
      : null;
  const districts = selectedSido && selectedTop ? childrenOf(selectedSido.sigungus, selectedTop.sigungu) : [];

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

      {selectedSido && tops.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip
            label="전체"
            selected={sigunguCode === null}
            onPress={() => onChange({ sidoCode, sigunguCode: null })}
          />
          {tops.map((sg) => (
            <Chip
              key={sg.sigunguCode}
              label={sg.sigungu}
              // 구를 고른 상태여도 부모 시가 눌린 것으로 보인다 — 그래야 지금 어디를 보고 있는지 읽힌다
              selected={selectedTop?.sigunguCode === sg.sigunguCode}
              onPress={() =>
                onChange({
                  sidoCode,
                  sigunguCode: selectedTop?.sigunguCode === sg.sigunguCode ? null : sg.sigunguCode,
                })
              }
            />
          ))}
        </ScrollView>
      )}

      {/*
        구가 있는 시를 고르면 세 번째 줄이 열린다.

        「수원시」 칩만 있고 구 칩이 없으면, 사용자는 수원시를 누르고 "시설이 없어요"를 본 뒤
        그대로 떠난다 — 실제로는 구 단위에 704곳이 있다. 구를 바로 보여줘 그 벽을 없앤다.
        「시 전체」를 남겨 두는 이유는 화성시처럼 시 단위에 데이터가 몰린 곳이 있어서다.
      */}
      {districts.length > 0 && selectedTop && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip
            label={`${selectedTop.sigungu} 전체`}
            selected={sigunguCode === selectedTop.sigunguCode}
            onPress={() => onChange({ sidoCode, sigunguCode: selectedTop.sigunguCode })}
          />
          {districts.map((d) => (
            <Chip
              key={d.sigunguCode}
              // 「수원시 장안구」에서 앞의 시 이름은 위 줄이 이미 말하고 있다. 「장안구」만 적는다
              label={d.sigungu.slice(selectedTop.sigungu.length + 1)}
              selected={sigunguCode === d.sigunguCode}
              onPress={() =>
                onChange({
                  sidoCode,
                  sigunguCode: sigunguCode === d.sigunguCode ? selectedTop.sigunguCode : d.sigunguCode,
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
