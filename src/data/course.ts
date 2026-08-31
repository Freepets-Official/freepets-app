import { judgeGroup, type GroupResult } from '@/data/judge';
import { FACILITIES, mockId, reviewsOf } from '@/data/mock';
import type { Category, CheckResult, Facility, Pet, PetSatisfaction, ReviewTag } from '@/data/types';

/**
 * 여행 코스 판별 (F3) — 백엔드 없이 목 로직으로 완결한다.
 *
 * 낱개 시설 판별은 "이 문 앞에서 거부당하지 않게"를 풀지만, 실제 여행은 여러 곳을 잇는다.
 * 코스는 그 하루 전체를 한 번에 검증한다: 어느 스톱에서 어떤 아이가 막히는지,
 * 막히면 같은 성격의 어디로 바꾸면 되는지를 출발 전에 알려준다.
 *
 * 판별 자체는 시설별 judgeGroup을 그대로 재사용한다 — 낱개와 코스가 다른 답을 내면 안 된다.
 *
 * ── 생성 3종(지역/취향/유사)은 결국 "후보 → 점수 → 다양성 → 동선"의 같은 흐름을 탄다.
 * 모드마다 바뀌는 건 `candidates`와 `scoreFn` 둘뿐이라 pickStops 하나로 합쳤다.
 * 백엔드 연동 시엔 candidates를 서버 후보로, scoreFn을 서버 점수로 갈아끼우면 화면은 그대로다.
 */

export type CourseSource = 'PRESET' | 'RECOMMENDED' | 'CUSTOM';

export interface Course {
  id: string;
  name: string;
  /** 코스 성격 한 줄 (프리셋·추천 코스에만) */
  description: string | null;
  source: CourseSource;
  /** 방문 순서대로의 시설 id */
  stopIds: number[];
}

/** 한 스톱의 판별 결과 + 막혔을 때의 대체 시설 */
export interface StopResult {
  facility: Facility;
  group: GroupResult;
  /** 시간대 라벨 (예: "10:00") */
  time: string;
  /** overall이 DENIED일 때만 채워진다 — 같은 성격의 동반 가능 시설 */
  alternative: Facility | null;
}

export interface CourseResult {
  stops: StopResult[];
  /** 코스 전체 결과 — 한 스톱이라도 불가면 DENIED, 조건부가 있으면 CONDITIONAL */
  overall: CheckResult;
  /** 그룹 전체가 막힌 스톱 수 */
  blockedCount: number;
}

/**
 * 관광공사 지역기반 관광정보로 엮은 프리셋.
 * 실제 연동 시 areaBasedList + detailPetTour 조합으로 지역별 코스를 생성한다.
 */
export const PRESET_COURSES: Course[] = [
  {
    id: 'preset-gangneung-sea',
    name: '강릉 바다 산책 1일 코스',
    description: '해변 산책으로 시작해 카페·놀이터를 거쳐 펜션에서 하루를 마무리',
    source: 'PRESET',
    stopIds: [1, 2, 5, 4].map(mockId),
  },
  {
    id: 'preset-gangneung-cafe',
    name: '강릉 애견 카페 반나절 코스',
    description: '전 견종 환영 카페 위주로 짧게 도는 반나절 코스',
    source: 'PRESET',
    stopIds: [1, 7, 10].map(mockId),
  },
];

const facilityById = (id: number): Facility | undefined =>
  FACILITIES.find((f) => f.facilityId === id);

const RANK: Record<CheckResult, number> = { ALLOWED: 0, CONDITIONAL: 1, DENIED: 2 };

// ─────────────────────────── 동선 정렬 ───────────────────────────

type LatLng = { latitude: number; longitude: number };

/** 두 좌표 사이 대략 거리(m) — 하버사인 */
function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const hasCoords = (f: Facility): f is Facility & LatLng =>
  f.latitude != null && f.longitude != null;

/**
 * 스톱 방문 순서를 정한다.
 * - 모든 시설에 좌표가 있으면 **nearest-neighbor**: 내 위치에 가장 가까운 곳에서 출발해
 *   매번 가장 가까운 다음 곳으로 이어붙인다(진짜 "동선").
 * - 좌표가 없으면(서버 검색 응답 등) `distanceM`(내 위치로부터) 오름차순으로 폴백한다.
 */
function orderByRoute(facs: Facility[]): Facility[] {
  if (facs.length <= 2 || !facs.every(hasCoords)) {
    return [...facs].sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  }
  const remaining = [...facs];
  // 첫 스톱 = 내 위치에 가장 가까운 곳(distanceM 최소)
  const startIdx = remaining.reduce(
    (best, f, i, arr) => ((f.distanceM ?? Infinity) < (arr[best].distanceM ?? Infinity) ? i : best),
    0,
  );
  const route: Facility[] = [remaining.splice(startIdx, 1)[0]];
  while (remaining.length) {
    const cur = route[route.length - 1] as Facility & LatLng;
    let bestI = 0;
    let bestD = Infinity;
    remaining.forEach((f, i) => {
      const d = haversine(cur, f as Facility & LatLng);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    route.push(remaining.splice(bestI, 1)[0]);
  }
  return route;
}

// ─────────────────────────── 공통 생성 파이프 ───────────────────────────

interface GenerateInput {
  /** 후보 시설 */
  candidates: Facility[];
  /** 모드별 점수. 0 이하면 후보에서 제외 */
  scoreFn: (f: Facility) => number;
  /** 있으면 judgeGroup으로 그룹 전체가 못 가는 곳(DENIED)을 뺀다 */
  pets?: Pet[];
  /** 최대 스톱 수 */
  limit?: number;
}

/** 후보 → 점수 → (judge 필터) → 카테고리 다양성 → 동선 정렬 → 스톱 id 배열 */
function pickStops({ candidates, scoreFn, pets, limit = 4 }: GenerateInput): number[] {
  const scored = candidates
    .filter((f) => !pets || pets.length === 0 || judgeGroup(pets, f).overall !== 'DENIED')
    .map((f) => ({ f, score: scoreFn(f) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // 카테고리 다양성 — 같은 카테고리는 최고점 한 곳만 남긴다
  const seen = new Set<Category>();
  const picked: Facility[] = [];
  for (const { f } of scored) {
    if (seen.has(f.category)) continue;
    seen.add(f.category);
    picked.push(f);
    if (picked.length >= limit) break;
  }
  return orderByRoute(picked).map((f) => f.facilityId);
}

/** 아이별 만족도를 시설 단위로 합산 → 시설별 평균 (liked/similar 공용) */
function avgSatisfactionByFacility(
  petIds: number[],
  satisfactions: PetSatisfaction[],
): Map<number, number> {
  const acc = new Map<number, { sum: number; count: number }>();
  satisfactions
    .filter((s) => petIds.includes(s.petId))
    .forEach((s) => {
      const cur = acc.get(s.facilityId) ?? { sum: 0, count: 0 };
      cur.sum += s.score;
      cur.count += 1;
      acc.set(s.facilityId, cur);
    });
  return new Map([...acc].map(([id, { sum, count }]) => [id, sum / count]));
}

/** 시큰둥했던 곳(평균 6.5 미만)은 취향으로 치지 않는다 */
const LIKED_THRESHOLD = 6.5;

/**
 * 개인 만족도 기반 추천 코스 — 데려갈 아이들이 실제로 좋아했던 곳을 엮는다.
 * "가능한 곳"이 아니라 "우리 아이가 좋아한 곳"으로 코스를 짜는 것이 낱개 판별과의 차이다.
 */
export function recommendCourse(
  petIds: number[],
  satisfactions: PetSatisfaction[],
): Course | null {
  if (petIds.length === 0) return null;
  const avgById = avgSatisfactionByFacility(petIds, satisfactions);

  const stopIds = pickStops({
    candidates: FACILITIES.filter((f) => avgById.has(f.facilityId)),
    scoreFn: (f) => {
      const avg = avgById.get(f.facilityId) ?? 0;
      return avg >= LIKED_THRESHOLD ? avg : 0;
    },
  });
  if (stopIds.length < 2) return null;

  return {
    id: 'recommended',
    name: '우리 아이 취향 코스',
    description: '데려갈 아이들이 좋아했던 곳들로 엮었어요',
    source: 'RECOMMENDED',
    stopIds,
  };
}

/** 한 시설의 리뷰 태그 집합 — 그 시설의 "성격"을 나타낸다 */
function facilityTagSet(facilityId: number): Set<ReviewTag> {
  const tags = new Set<ReviewTag>();
  reviewsOf(facilityId).forEach((r) => r.tags.forEach((t) => tags.add(t)));
  return tags;
}

/** 데려갈 아이들이 좋아한 곳들에서 뽑은 취향 프로필 (카테고리 + 태그) */
interface TasteProfile {
  categories: Set<Category>;
  tags: Set<ReviewTag>;
  likedIds: Set<number>;
}

function tasteProfile(petIds: number[], satisfactions: PetSatisfaction[]): TasteProfile {
  const avgById = avgSatisfactionByFacility(petIds, satisfactions);
  const categories = new Set<Category>();
  const tags = new Set<ReviewTag>();
  const likedIds = new Set<number>();
  avgById.forEach((avg, facilityId) => {
    if (avg < LIKED_THRESHOLD) return; // 시큰둥했던 곳은 프로필에서 제외
    likedIds.add(facilityId);
    const f = facilityById(facilityId);
    if (f) categories.add(f.category);
    facilityTagSet(facilityId).forEach((t) => tags.add(t));
  });
  return { categories, tags, likedIds };
}

/**
 * 취향 유사도 추천 — "좋아한 곳 그 자체"가 아니라 "취향이 비슷한 아직 안 가본 곳"으로 코스를 짠다.
 *
 * 아이가 좋아한 곳들의 카테고리·리뷰 태그로 취향 프로필을 만들고, 다른 시설을 그 프로필과의
 * 유사도로 점수 매긴다. 데려갈 아이들이 못 가는 곳(불가)은 제외한다.
 * 실제 서비스에선 서버가 전체 시설·리뷰로 계산한다(계약: docs/02 `courses/recommended`).
 */
export function recommendSimilarCourse(pets: Pet[], satisfactions: PetSatisfaction[]): Course | null {
  if (pets.length === 0) return null;
  const profile = tasteProfile(
    pets.map((p) => p.petId),
    satisfactions,
  );
  if (profile.categories.size === 0) return null;

  const stopIds = pickStops({
    candidates: FACILITIES.filter((f) => !profile.likedIds.has(f.facilityId)), // 안 가본 곳만
    scoreFn: (f) => {
      const catMatch = profile.categories.has(f.category) ? 3 : 0;
      const tagOverlap = [...facilityTagSet(f.facilityId)].filter((t) => profile.tags.has(t)).length;
      return catMatch + tagOverlap;
    },
    pets, // 데려갈 아이가 못 가는 곳은 제외
  });
  if (stopIds.length < 2) return null;

  return {
    id: 'recommended-similar',
    name: '취향 비슷한 새 곳 탐험',
    description: '가본 곳은 빼고, 우리 아이 취향과 비슷한 새 장소로 엮었어요',
    source: 'RECOMMENDED',
    stopIds,
  };
}

// ─────────────────────────── 코스 판별(검증) ───────────────────────────

/** 첫 스톱 도착 시각과 스톱당 소요(이동 포함, 데모 고정값) */
const START_HOUR = 10;
const SLOT_MINUTES = 90;

function slotTime(index: number): string {
  const total = START_HOUR * 60 + index * SLOT_MINUTES;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 막힌 스톱의 대체 시설을 고른다.
 * 같은 카테고리 · 그룹 전체가 갈 수 있는 곳(불가 아님) · 코스에 아직 없는 곳 중 가장 가까운 곳.
 */
function findAlternative(blocked: Facility, pets: Pet[], usedIds: Set<number>): Facility | null {
  return (
    FACILITIES.filter((f) => f.category === blocked.category && !usedIds.has(f.facilityId))
      .map((f) => ({ f, overall: judgeGroup(pets, f).overall }))
      .filter((x) => x.overall !== 'DENIED')
      // 조건부보다 완전 가능을 우선, 그다음 거리순
      .sort(
        (a, b) =>
          RANK[a.overall] - RANK[b.overall] ||
          (a.f.distanceM ?? Infinity) - (b.f.distanceM ?? Infinity),
      )[0]?.f ?? null
  );
}

/** 코스 전체를 데려갈 아이들 기준으로 판별한다 */
export function validateCourse(stopIds: number[], pets: Pet[]): CourseResult {
  // 대체 시설이 이미 코스에 있는 시설과 겹치지 않도록, 원본 스톱 전체를 사용 목록에 먼저 넣는다
  const usedIds = new Set<number>(stopIds);

  const stops: StopResult[] = [];
  stopIds.forEach((id, index) => {
    const facility = facilityById(id);
    if (!facility) return;
    const group = judgeGroup(pets, facility);
    const alternative =
      group.overall === 'DENIED' ? findAlternative(facility, pets, usedIds) : null;
    if (alternative) usedIds.add(alternative.facilityId);
    stops.push({ facility, group, time: slotTime(index), alternative });
  });

  const overall = stops.reduce<CheckResult>(
    (worst, s) => (RANK[s.group.overall] > RANK[worst] ? s.group.overall : worst),
    'ALLOWED',
  );
  const blockedCount = stops.filter((s) => s.group.overall === 'DENIED').length;

  return { stops, overall, blockedCount };
}
