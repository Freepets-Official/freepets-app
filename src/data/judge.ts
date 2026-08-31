import type { CheckResult, Facility, Pet, Requirement } from '@/data/types';

/**
 * 목 판별 로직. 백엔드 B(Claude AI) 연동 전까지 같은 입출력 계약으로 동작한다.
 * 계약: docs/03-ai-prompts.md 의 출입 판별 프롬프트 출력과 동일한 형태.
 */
export interface Verdict {
  result: CheckResult;
  reason: string;
  conditions: string[];
}

// Record<string, string>이면 서버가 새 요구사항을 추가해도 컴파일러가 못 잡고 조용히 빠진다.
// Requirement로 키를 못 박아 누락을 빌드 타임에 걸리게 한다.
// SMALL_ONLY는 여기 없다 — 조건이 아니라 위에서 DENIED로 먼저 걸러지기 때문이다.
const REQUIREMENT_CONDITION: Record<Exclude<Requirement, 'SMALL_ONLY'>, string> = {
  LEASH: '리드줄 필수 착용',
  CAGE: '케이지(이동장) 이용 필수',
  MUZZLE: '입마개 착용',
  VACCINATION: '예방접종 증명서 지참',
  OUTDOOR_ONLY: '야외 공간만 이용 가능',
  STROLLER: '반려동물 유모차 이용',
  MANNER_BELT: '매너벨트 착용',
};

export function judge(pet: Pet, facility: Facility): Verdict {
  if (facility.petAllowed === false) {
    return {
      result: 'DENIED',
      reason: `${facility.name}은(는) 반려동물 동반이 불가능한 시설이에요. 주변의 동반 가능한 대안 시설을 확인해 보세요.`,
      conditions: [],
    };
  }

  if (facility.petAllowed === null) {
    return {
      result: 'CONDITIONAL',
      reason: `${facility.name}의 반려동물 출입 조건이 아직 확인되지 않았어요. 방문 전에 시설에 전화로 확인하는 것을 권장해요.`,
      conditions: ['방문 전 시설에 전화로 동반 가능 여부 확인'],
    };
  }

  if (facility.requirements.includes('SMALL_ONLY') && pet.breedSize !== 'SMALL') {
    return {
      result: 'DENIED',
      reason: `${facility.name}은(는) 소형견만 입장할 수 있어요. ${pet.name}(${pet.species})는 아쉽지만 함께 들어갈 수 없어요.`,
      conditions: [],
    };
  }

  if (facility.maxWeight !== null && pet.weight > facility.maxWeight) {
    return {
      result: 'DENIED',
      reason: `${pet.name}(${pet.weight}kg)는 최대 허용 체중 ${facility.maxWeight}kg을 초과해서 입장이 어려워요.`,
      conditions: [],
    };
  }

  if (facility.requirements.includes('VACCINATION') && !pet.vaccinated) {
    return {
      result: 'DENIED',
      reason: `${facility.name}은(는) 예방접종 완료가 필수 조건이에요. ${pet.name}의 접종을 완료한 뒤 방문해 주세요.`,
      conditions: [],
    };
  }

  const conditions = facility.requirements
    .map((r) => (r === 'SMALL_ONLY' ? undefined : REQUIREMENT_CONDITION[r]))
    .filter((c): c is string => Boolean(c));

  // 경계값(허용 체중의 90% 이상)은 현장 계측 차이가 있을 수 있어 조건부로 안내
  const nearLimit =
    facility.maxWeight !== null && pet.weight >= facility.maxWeight * 0.9;
  if (nearLimit) {
    conditions.push(`체중 ${facility.maxWeight}kg 제한에 근접 — 현장에서 확인될 수 있음`);
  }

  if (conditions.length > 0) {
    return {
      result: 'CONDITIONAL',
      reason: `${pet.name}(${pet.species}, ${pet.weight}kg)는 입장 조건을 충족해요. 다만 아래 조건을 지켜 주세요.`,
      conditions,
    };
  }

  return {
    result: 'ALLOWED',
    reason: `${pet.name}(${pet.species}, ${pet.weight}kg)는 ${facility.name}에 자유롭게 입장할 수 있어요.`,
    conditions: [],
  };
}

type Season = 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER';

function currentSeason(): Season {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'SPRING';
  if (m >= 6 && m <= 8) return 'SUMMER';
  if (m >= 9 && m <= 11) return 'FALL';
  return 'WINTER';
}

const SEASON_TIPS: Record<Season, string[]> = {
  SPRING: ['풀숲 산책 후 진드기 확인을 잊지 마세요'],
  SUMMER: ['한낮 아스팔트는 발바닥 화상 위험이 있어요. 이른 오전이나 저녁 방문을 권장해요', '휴대용 물과 물그릇으로 수분을 자주 보충해 주세요'],
  FALL: ['일교차가 크니 얇은 겉옷(펫 웨어)을 챙겨 주세요'],
  WINTER: ['제설용 염화칼슘이 발바닥에 닿지 않도록 부츠나 왁스를 준비해 주세요'],
};

export interface Checklist {
  checklist: string[];
  tips: string[];
}

export function buildChecklist(verdict: Verdict, facility: Facility): Checklist {
  if (verdict.result === 'DENIED') {
    return { checklist: [], tips: ['주변의 동반 가능한 대안 시설을 확인해 보세요'] };
  }

  const items: string[] = [];
  if (facility.requirements.includes('LEASH')) items.push('리드줄 필수 지참');
  if (facility.requirements.includes('CAGE')) items.push('케이지(이동장) 준비');
  if (facility.requirements.includes('MUZZLE')) items.push('입마개 지참');
  if (facility.requirements.includes('VACCINATION')) items.push('예방접종 증명서 지참');
  if (facility.requirements.includes('MANNER_BELT')) items.push('매너벨트 착용');
  if (facility.requirements.includes('STROLLER')) items.push('유모차(카트) 준비');

  switch (facility.category) {
    case 'STAY':
      items.push('배변패드·배변봉투 준비');
      break;
    case 'CAFE':
      items.push('휴대용 물그릇 준비');
      break;
    case 'TOUR':
    case 'LEISURE':
      items.push('배변봉투 지참');
      break;
    case 'SHOPPING':
      items.push('이동장 또는 슬링백 준비');
      break;
  }

  if (facility.petAllowed === null) items.push('방문 전 시설에 전화 확인');

  return { checklist: items.slice(0, 7), tips: SEASON_TIPS[currentSeason()] };
}

/** 여러 마리를 한 번에 판별한 결과 (한 아이라도 못 가면 다 함께는 못 간다) */
export interface PetVerdict extends Verdict {
  petId: number;
}

export interface GroupResult {
  verdicts: PetVerdict[];
  overall: CheckResult;
  checklist: string[];
  tips: string[];
}

const RANK: Record<CheckResult, number> = { ALLOWED: 0, CONDITIONAL: 1, DENIED: 2 };

/**
 * 데려갈 아이들을 한 번에 판별한다. 한 마리라도 불가면 "다 함께"는 불가지만,
 * 아이별 결과를 각각 보여줘 어떤 아이가 왜 안 되는지 알 수 있게 한다.
 */
export function judgeGroup(pets: Pet[], facility: Facility): GroupResult {
  const verdicts: PetVerdict[] = pets.map((pet) => ({ petId: pet.petId, ...judge(pet, facility) }));

  // overall = 가장 제약이 큰 결과 (아이 중 하나라도 불가면 그룹 전체는 불가)
  const overall = verdicts.reduce<CheckResult>(
    (worst, v) => (RANK[v.result] > RANK[worst] ? v.result : worst),
    'ALLOWED',
  );

  // 체크리스트는 입장 가능한 아이가 하나라도 있을 때, 가장 관대한 결과 기준으로 만든다
  const best = verdicts.reduce<PetVerdict | null>(
    (b, v) => (b === null || RANK[v.result] < RANK[b.result] ? v : b),
    null,
  );
  const { checklist, tips } = buildChecklist(best ?? { result: 'DENIED', reason: '', conditions: [] }, facility);

  return { verdicts, overall, checklist, tips };
}
