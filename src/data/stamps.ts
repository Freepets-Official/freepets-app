import type { CourseRegion } from './types';

/**
 * 여권 도장 (게임 요소 1단계) — 아이와 다녀온 곳을 지역 단위로 모은다.
 *
 * 도장의 단위는 **시군구**다. 관광공사 TourAPI가 `areaCode`(시도)·`sigunguCode`(시군구)까지만
 * 주기 때문에 그보다 잘게 나눌 수 없다. 같은 이유로 이 단위는 공모전 배점 요건(관광 데이터
 * 활용)과 그대로 겹친다 — 게임 요소를 만들면서 데이터 활용을 함께 채우는 구조다.
 *
 * ⚠️ **1단계는 인증이 목(mock)이다.** 사진을 받긴 하지만 실제로 검사하지 않고 통과시킨다.
 * 진짜 비전 판별과 GPS 대조는 2단계다. 지금 구조는 "허들"이지 부정 방지가 아니다 —
 * 남의 펫 사진도, 사진을 다시 찍은 것도 막지 못한다. 데모·공모전에는 충분하다고 보고 간다.
 */
export interface Stamp {
  /** 도장을 찍은 시설 */
  facilityId: number;
  /** 시설명은 함께 저장한다. 나중에 시설을 다시 조회하지 않아도 도장첩을 그릴 수 있어야 한다 */
  facilityName: string;
  sido: string;
  sigungu: string;
  /** 함께 간 아이들 */
  petIds: number[];
  /** 인증샷. 1단계에서는 검사하지 않고 도장첩에만 쓴다 */
  photoUri: string | null;
  /** ISO 8601 */
  createdAt: string;
}

/** 같은 시군구를 한 칸으로 세기 위한 키. 시도명이 겹치는 시군구가 있어 시도까지 붙인다(예: 남구). */
export function regionKey(sido: string, sigungu: string): string {
  return `${sido}|${sigungu}`;
}

/**
 * 시설 주소에서 시도·시군구를 찾는다.
 *
 * 토큰을 순서대로 자르지 **않는다.** 경기도에는 `"고양시 덕양구"`처럼 시군구 자체가 두
 * 토큰인 항목이 있어서, 둘째 토큰만 떼면 `"고양시"`라는 없는 지역이 만들어진다. 그래서
 * 서버가 준 지역 트리에 실제로 있는 이름 중 **주소에 들어 있는 가장 긴 것**을 고른다.
 *
 * 세종특별자치시는 시도와 시군구가 같은 이름이다(트리에서도 시군구가 자기 자신 하나뿐).
 *
 * **시도든 시군구든 못 찾으면 `null`이다.** 억지로 추측해 엉뚱한 지역에 찍는 것보다 못 찍는
 * 편이 낫다 — 잘못 찍힌 도장은 사용자가 지울 방법이 없고, 뱃지 수까지 부풀린다.
 * 예외는 시군구 목록이 비어 있는 시도 하나뿐이다(그 시도가 곧 하나의 지역인 경우).
 */
export function matchRegion(
  address: string,
  regions: CourseRegion[],
): { sido: string; sigungu: string } | null {
  if (!address) return null;

  // 시도도 이름이 긴 쪽을 먼저 본다. "전남광주통합특별시"가 "전남"보다 앞서야 한다.
  const sido = [...regions]
    .sort((a, b) => b.sido.length - a.sido.length)
    .find((r) => address.includes(r.sido));
  if (!sido) return null;

  const sigungu = [...sido.sigungus]
    .sort((a, b) => b.length - a.length)
    .find((s) => address.includes(s));
  if (sigungu) return { sido: sido.sido, sigungu };

  // 시군구 목록이 아예 비어 있는 시도는 그 시도가 곧 하나의 지역이다. 그때만 시도로 대신한다.
  if (sido.sigungus.length === 0) return { sido: sido.sido, sigungu: sido.sido };

  // 목록이 있는데 못 찾았다면 모르는 것이다. 시도 이름을 시군구 자리에 넣으면
  // "경기도 안의 경기도"라는 없는 지역이 생기고, 그 가짜 지역이 뱃지 수를 부풀린다.
  return null;
}

/** 도장첩의 한 줄 — 시도 하나와 그 안에서 모은 시군구. */
export interface RegionProgress {
  sido: string;
  /** 도장을 찍은 시군구 (이름순) */
  collected: string[];
  /**
   * 분모로 쓰는 시군구 수. **전체 행정구역이 아니라 서버 지역 트리에 있는 수**다.
   * 시설 데이터가 늘면 분모도 늘어 진도가 뒤로 갈 수 있다. 트리를 못 받았으면 0.
   */
  total: number;
  /** 0~1. total이 0이면 0 */
  ratio: number;
}

/** 도장을 시도별로 묶는다. 도장이 하나도 없는 시도는 넣지 않는다 — 빈 줄이 화면을 채우면 진도가 안 보인다. */
export function groupBySido(stamps: Stamp[], regions: CourseRegion[]): RegionProgress[] {
  const bySido = new Map<string, Set<string>>();
  for (const s of stamps) {
    const set = bySido.get(s.sido) ?? new Set<string>();
    set.add(s.sigungu);
    bySido.set(s.sido, set);
  }

  return [...bySido.entries()]
    .map(([sido, set]) => {
      const total = regions.find((r) => r.sido === sido)?.sigungus.length ?? 0;
      const collected = [...set].sort((a, b) => a.localeCompare(b, 'ko'));
      return { sido, collected, total, ratio: total > 0 ? collected.length / total : 0 };
    })
    .sort((a, b) => b.collected.length - a.collected.length || a.sido.localeCompare(b.sido, 'ko'));
}

/** 서로 다른 시군구를 몇 곳 모았는지. 뱃지 판정의 기준값이다. */
export function uniqueRegionCount(stamps: Stamp[]): number {
  return new Set(stamps.map((s) => regionKey(s.sido, s.sigungu))).size;
}

/**
 * 뱃지 — 1단계는 **정복자**만 넣는다.
 *
 * 계획에 있는 **구원자**(리뷰·제보가 '도움됐어요'를 받은 수)는 서버에 그 카운트가 아직 없어
 * 2단계로 미룬다. 지금 로컬로 흉내 내면 서버가 붙는 순간 숫자가 어긋나고, 사용자에게는
 * 뱃지가 사라진 것처럼 보인다.
 */
export interface Badge {
  key: string;
  label: string;
  /** 달성에 필요한 서로 다른 시군구 수 */
  need: number;
  emoji: string;
}

export const CONQUEROR_BADGES: Badge[] = [
  { key: 'conqueror-3', label: '동네 정복자', need: 3, emoji: '🥉' },
  { key: 'conqueror-5', label: '지역 정복자', need: 5, emoji: '🥈' },
  { key: 'conqueror-10', label: '전국 정복자', need: 10, emoji: '🥇' },
];

/** 획득 여부와 다음 목표까지의 진도를 함께 준다 — "몇 곳 남았는지"가 보여야 다음 도장을 찍는다. */
export function badgeState(stamps: Stamp[]): {
  count: number;
  earned: Badge[];
  next: { badge: Badge; remaining: number } | null;
} {
  const count = uniqueRegionCount(stamps);
  const earned = CONQUEROR_BADGES.filter((b) => count >= b.need);
  const nextBadge = CONQUEROR_BADGES.find((b) => count < b.need);
  return {
    count,
    earned,
    next: nextBadge ? { badge: nextBadge, remaining: nextBadge.need - count } : null,
  };
}

/**
 * 이번 달에 찍은 도장. 계획의 "이번 달 함께 간 곳 N"이다.
 * `now`를 인자로 받는 이유는 호출부가 렌더 시점을 고정하기 때문이다 — 앱을 켜둔 채
 * 월이 바뀌면 값이 갱신되지 않는다. 그 정도는 다음 렌더에 맞춰지므로 감수한다.
 */
export function stampsThisMonth(stamps: Stamp[], now = new Date()): Stamp[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  return stamps.filter((s) => {
    const d = new Date(s.createdAt);
    // 저장된 값이 깨졌으면 이번 달에서 빼되 목록 자체는 살린다
    return !Number.isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === m;
  });
}

/** 같은 시설에 이미 도장이 있는지. 한 시설당 한 번만 찍는다 — 같은 곳을 반복해 세면 정복이 아니다. */
export function hasStamp(stamps: Stamp[], facilityId: number): boolean {
  return stamps.some((s) => s.facilityId === facilityId);
}
