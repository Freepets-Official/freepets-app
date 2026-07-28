import { judgeGroup, type GroupResult } from '@/data/judge';
import { FACILITIES } from '@/data/mock';
import type { CheckResult, Category, Facility, Pet, PetSatisfaction } from '@/data/types';

/**
 * 여행 코스 판별 (F3) — 백엔드 없이 목 로직으로 완결한다.
 *
 * 낱개 시설 판별은 "이 문 앞에서 거부당하지 않게"를 풀지만, 실제 여행은 여러 곳을 잇는다.
 * 코스는 그 하루 전체를 한 번에 검증한다: 어느 스톱에서 어떤 아이가 막히는지,
 * 막히면 같은 성격의 어디로 바꾸면 되는지를 출발 전에 알려준다.
 *
 * 판별 자체는 시설별 judgeGroup을 그대로 재사용한다 — 낱개와 코스가 다른 답을 내면 안 된다.
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
    stopIds: [1, 2, 5, 4],
  },
  {
    id: 'preset-gangneung-cafe',
    name: '강릉 애견 카페 반나절 코스',
    description: '전 견종 환영 카페 위주로 짧게 도는 반나절 코스',
    source: 'PRESET',
    stopIds: [1, 7, 10],
  },
];

const facilityById = (id: number): Facility | undefined =>
  FACILITIES.find((f) => f.facilityId === id);

const RANK: Record<CheckResult, number> = { ALLOWED: 0, CONDITIONAL: 1, DENIED: 2 };

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
function findAlternative(
  blocked: Facility,
  pets: Pet[],
  usedIds: Set<number>,
): Facility | null {
  return (
    FACILITIES.filter((f) => f.category === blocked.category && !usedIds.has(f.facilityId))
      .map((f) => ({ f, overall: judgeGroup(pets, f).overall }))
      .filter((x) => x.overall !== 'DENIED')
      // 조건부보다 완전 가능을 우선, 그다음 거리순
      .sort((a, b) => RANK[a.overall] - RANK[b.overall] || a.f.distanceM - b.f.distanceM)[0]?.f ?? null
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

/**
 * 개인 만족도 기반 추천 코스 — 데려갈 아이들이 실제로 좋아했던 곳을 엮는다.
 * "가능한 곳"이 아니라 "우리 아이가 좋아한 곳"으로 코스를 짜는 것이 낱개 판별과의 차이다.
 */
export function recommendCourse(
  petIds: number[],
  satisfactions: PetSatisfaction[],
): Course | null {
  if (petIds.length === 0) return null;

  // 아이별 만족도를 시설 단위로 합산 — 여러 아이가 함께 좋아한 곳이 위로 온다
  const scoreByFacility = new Map<number, { sum: number; count: number }>();
  satisfactions
    .filter((s) => petIds.includes(s.petId))
    .forEach((s) => {
      const cur = scoreByFacility.get(s.facilityId) ?? { sum: 0, count: 0 };
      cur.sum += s.score;
      cur.count += 1;
      scoreByFacility.set(s.facilityId, cur);
    });

  const ranked = [...scoreByFacility.entries()]
    .map(([facilityId, { sum, count }]) => ({ facilityId, avg: sum / count }))
    // 평균 6.5 미만(시큰둥했던 곳)은 코스에 넣지 않는다
    .filter((x) => x.avg >= 6.5)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 4);

  if (ranked.length < 2) return null;

  // 카테고리가 다양하도록 같은 카테고리는 최고점 한 곳만 남긴 뒤, 방문 동선은 거리순으로 정렬
  const seen = new Set<Category>();
  const picked: number[] = [];
  for (const { facilityId } of ranked) {
    const f = facilityById(facilityId);
    if (!f || seen.has(f.category)) continue;
    seen.add(f.category);
    picked.push(facilityId);
  }
  picked.sort((a, b) => (facilityById(a)?.distanceM ?? 0) - (facilityById(b)?.distanceM ?? 0));

  if (picked.length < 2) return null;

  return {
    id: 'recommended',
    name: '우리 아이 취향 코스',
    description: '데려갈 아이들이 좋아했던 곳들로 엮었어요',
    source: 'RECOMMENDED',
    stopIds: picked,
  };
}
