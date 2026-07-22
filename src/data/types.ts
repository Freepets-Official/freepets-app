export type Category = 'TOUR' | 'STAY' | 'CAFE' | 'LEISURE' | 'SHOPPING';
export type BreedSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type CheckResult = 'ALLOWED' | 'CONDITIONAL' | 'DENIED';
export type Requirement =
  | 'LEASH'
  | 'CAGE'
  | 'MUZZLE'
  | 'VACCINATION'
  | 'SMALL_ONLY'
  | 'OUTDOOR_ONLY';

/**
 * 정보 신뢰도 — 판별 결과(가능/조건부/불가)와 별개의 축.
 * "가능"이어도 그 정보가 얼마나 믿을 만한지가 현장 거부를 좌우한다.
 */
export type Confidence = 'CONFIRMED' | 'LIKELY' | 'ESTIMATED' | 'UNVERIFIED';

/** 신뢰도의 근거 */
export type ConfidenceSource = 'OWNER' | 'CROWD' | 'PARSED' | 'USER_CALL' | 'NONE';

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  CONFIRMED: '확정',
  LIKELY: '유력',
  ESTIMATED: '추정',
  UNVERIFIED: '미확인',
};

export const CONFIDENCE_SOURCE_LABEL: Record<ConfidenceSource, string> = {
  OWNER: '사업자 확인',
  CROWD: '방문자 제보 다수 일치',
  PARSED: '관광공사 원문 기반',
  USER_CALL: '내가 전화로 확인',
  NONE: '정보 없음',
};

export interface Facility {
  facilityId: number;
  name: string;
  category: Category;
  address: string;
  phone: string | null;
  /** 현재 위치(데모: 강릉역) 기준 거리 */
  distanceM: number;
  petAllowed: boolean | null;
  petConditionRaw: string | null;
  maxWeight: number | null;
  requirements: Requirement[];
  /** 출입 조건 정보의 신뢰도 */
  confidence: Confidence;
  confidenceSource: ConfidenceSource;
  /** 마지막으로 확인된 시각 (ISO). 없으면 확인된 적 없음 */
  confirmedAt: string | null;
}

/** 신뢰도 배지 표시용 정보 (라벨·근거·최종확인 문구) */
export function confidenceMeta(c: Confidence): { label: string; key: Confidence } {
  return { label: CONFIDENCE_LABEL[c], key: c };
}

/** 최종 확인 시점을 상대 시간 문구로 (예: "3일 전 확인") */
export function freshnessText(confirmedAt: string | null): string | null {
  if (!confirmedAt) return null;
  const then = new Date(confirmedAt).getTime();
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return '오늘 확인';
  if (days === 1) return '어제 확인';
  if (days < 30) return `${days}일 전 확인`;
  const months = Math.floor(days / 30);
  return `${months}개월 전 확인`;
}

/** 리뷰 태그 — 시설 특징 집계용 */
export type ReviewTag =
  | 'SPACIOUS'
  | 'WATER_BOWL'
  | 'POOP_BAG'
  | 'OUTDOOR_SEAT'
  | 'LARGE_DOG_OK'
  | 'OFF_LEASH_OK'
  | 'PET_MENU'
  | 'PARKING'
  | 'QUIET'
  | 'STAFF_LOVES_PETS';

export const REVIEW_TAG_LABEL: Record<ReviewTag, string> = {
  SPACIOUS: '넓은 공간',
  WATER_BOWL: '급수대 있음',
  POOP_BAG: '배변봉투 비치',
  OUTDOOR_SEAT: '야외 좌석',
  LARGE_DOG_OK: '대형견 가능',
  OFF_LEASH_OK: '목줄 풀기 가능',
  PET_MENU: '펫 메뉴 있음',
  PARKING: '주차 편리',
  QUIET: '조용한 분위기',
  STAFF_LOVES_PETS: '직원이 반겨줌',
};

export interface Review {
  reviewId: number;
  facilityId: number;
  userId: number;
  nickname: string;
  petName: string | null;
  /** 공간 여유 / 직원 친절도 / 편의시설 — 각 1~5 */
  ratingSpace: number;
  ratingStaff: number;
  ratingAmenity: number;
  content: string | null;
  tags: ReviewTag[];
  visitedAt: string;
}

/** 친화도 점수(0~100). 발자국 등급의 입력값 — DB의 생성 컬럼과 같은 식 */
export function friendlinessOf(r: Pick<Review, 'ratingSpace' | 'ratingStaff' | 'ratingAmenity'>): number {
  return ((r.ratingSpace * 0.35 + r.ratingStaff * 0.35 + r.ratingAmenity * 0.3) / 5) * 100;
}

/** 발자국 등급 임계값 — 뒤로 갈수록 좁혀 4·5발자국의 희소성을 유지한다 */
const PAW_TIERS = [
  { level: 5, minScore: 94, minCount: 150, label: '최고 등급' },
  { level: 4, minScore: 88, minCount: 90, label: '동반 우수' },
  { level: 3, minScore: 80, minCount: 50, label: '동반 추천' },
  { level: 2, minScore: 70, minCount: 25, label: '동반 편안' },
  { level: 1, minScore: 60, minCount: 10, label: '동반 가능' },
] as const;

/** 1발자국을 받기 위한 최소 리뷰 수 — "리뷰 수집 중 n/10" 표시에 쓴다 */
export const PAW_MIN_REVIEWS = PAW_TIERS[4].minCount;

export interface PawGrade {
  level: number | null;
  label: string | null;
  score: number | null;
  count: number;
  /** 다음 등급까지 필요한 리뷰 수 (등급 미달일 때만) */
  needMore: number;
}

export function pawGradeOf(reviews: Review[]): PawGrade {
  if (reviews.length === 0) {
    return { level: null, label: null, score: null, count: 0, needMore: PAW_MIN_REVIEWS };
  }
  const score = reviews.reduce((sum, r) => sum + friendlinessOf(r), 0) / reviews.length;
  const tier = PAW_TIERS.find((t) => score >= t.minScore && reviews.length >= t.minCount);
  return {
    level: tier?.level ?? null,
    label: tier?.label ?? null,
    score,
    count: reviews.length,
    needMore: tier ? 0 : Math.max(0, PAW_MIN_REVIEWS - reviews.length),
  };
}

export interface Pet {
  petId: number;
  name: string;
  species: string;
  weight: number;
  breedSize: BreedSize;
  vaccinated: boolean;
  vaccinationDate: string | null;
  /** 프로필 사진 (선택). 없으면 이름 첫 글자로 아바타를 만든다 */
  photoUri: string | null;
}

/**
 * 반려동물 개인 만족도 — 0.0~10.0 (소수점 1자리).
 * 사업자 리뷰(친화도)와 완전히 분리된, 사용자 본인에게만 보이는 기록.
 * 같은 장소라도 강아지는 9.5, 고양이는 4.0처럼 아이마다 다르게 남길 수 있다.
 */
export interface PetSatisfaction {
  petId: number;
  facilityId: number;
  score: number;
}

export function satisfactionMood(score: number): { emoji: string; label: string; key: string } {
  if (score >= 8.5) return { emoji: '😻', label: '아주 좋아했어요', key: 'love' };
  if (score >= 6.5) return { emoji: '😸', label: '좋아했어요', key: 'like' };
  if (score >= 4) return { emoji: '😐', label: '그냥 그랬어요', key: 'meh' };
  return { emoji: '🙀', label: '별로였어요', key: 'nope' };
}

/** 한 마리에 대한 판별 결과 (그룹 판별의 구성 요소) */
export interface PetVerdictResult {
  petId: number;
  result: CheckResult;
  reason: string;
  conditions: string[];
}

/** 여러 마리를 한 번에 판별한 기록 */
export interface PetCheck {
  checkId: number;
  facilityId: number;
  petIds: number[];
  verdicts: PetVerdictResult[];
  /** 그룹 전체 결과 — 한 마리라도 불가면 DENIED */
  overall: CheckResult;
  checklist: string[];
  tips: string[];
  createdAt: string;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  TOUR: '관광지',
  STAY: '숙소',
  CAFE: '카페',
  LEISURE: '레포츠',
  SHOPPING: '쇼핑',
};

export const BREED_SIZE_LABEL: Record<BreedSize, string> = {
  SMALL: '소형',
  MEDIUM: '중형',
  LARGE: '대형',
};

export const RESULT_LABEL: Record<CheckResult, string> = {
  ALLOWED: '가능',
  CONDITIONAL: '조건부',
  DENIED: '불가',
};

export const REQUIREMENT_LABEL: Record<Requirement, string> = {
  LEASH: '리드줄',
  CAGE: '케이지',
  MUZZLE: '입마개',
  VACCINATION: '접종증명',
  SMALL_ONLY: '소형견만',
  OUTDOOR_ONLY: '야외만',
};
