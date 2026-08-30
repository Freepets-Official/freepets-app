export type Category = 'TOUR' | 'STAY' | 'CAFE' | 'LEISURE' | 'SHOPPING' | 'RESTAURANT';
export type BreedSize = 'SMALL' | 'MEDIUM' | 'LARGE';

/** 동물 종류 — 개·고양이 외에도 키우므로 등록 시 선택한다. 서버 kind enum과 1:1(BIRD↔PARROT, SMALL_MAMMAL↔SMALL_ANIMAL). */
export type PetKind = 'DOG' | 'CAT' | 'BIRD' | 'RABBIT' | 'REPTILE' | 'SMALL_MAMMAL';

export const PET_KIND_LABEL: Record<PetKind, string> = {
  DOG: '강아지',
  CAT: '고양이',
  BIRD: '새',
  RABBIT: '토끼',
  REPTILE: '파충류',
  // 소동물 포함 그 밖의 종을 아우르는 catch-all. 서버 enum은 SMALL_ANIMAL로 매핑.
  SMALL_MAMMAL: '기타',
};

/**
 * AI 출입 판별이 가능한 종 — 관광공사 원문(acmpyPsblCpam)이 실제로 다루는 개·고양이만.
 * 그 외 종은 원본 데이터가 비어 있어 판별 대신 '직접 확인'(사업자 소개·전화)으로 안내한다.
 */
export const AI_JUDGEABLE_KINDS: PetKind[] = ['DOG', 'CAT'];

/** 종별 준비 팁 — 원본에 없는 정보를 우리가 채운다(직접 확인 안내에 함께 노출) */
export const KIND_TIPS: Record<PetKind, string[]> = {
  DOG: [],
  CAT: ['하네스 또는 이동장 준비', '낯선 환경 스트레스 주의'],
  BIRD: ['이동장(새장) 필수', '소음·깃털에 민감한 곳이 있어요'],
  RABBIT: ['이동장 필수', '온도·스트레스 관리'],
  REPTILE: ['이동장·보온 준비', '탈출 방지', '종에 따라 사전 문의 권장'],
  SMALL_MAMMAL: ['이동장 필수', '온도·스트레스 관리'],
};
export type CheckResult = 'ALLOWED' | 'CONDITIONAL' | 'DENIED';
export type Requirement =
  | 'LEASH'
  | 'CAGE'
  | 'MUZZLE'
  | 'VACCINATION'
  | 'SMALL_ONLY'
  | 'OUTDOOR_ONLY'
  | 'STROLLER'
  | 'MANNER_BELT';

/**
 * 정보 신뢰도 — 판별 결과(가능/조건부/불가)와 별개의 축.
 * "가능"이어도 그 정보가 얼마나 믿을 만한지가 현장 거부를 좌우한다.
 */
export type Confidence = 'CONFIRMED' | 'LIKELY' | 'ESTIMATED' | 'UNVERIFIED';

/** 신뢰도의 근거 */
export type ConfidenceSource =
  | 'OWNER'
  | 'CROWD'
  | 'PARSED'
  | 'USER_CALL'
  | 'DENIAL_REPORT'
  /** 서버가 조건을 확정(confirmedAt)했지만 확정 주체는 응답에 없다. 근거를 지어내지 않기 위한 값 */
  | 'SERVER'
  | 'NONE';

// 사용자에겐 두 가지만 보여준다: 확정 / 확인 필요.
// '유력·추정' 같은 애매한 중간 단계는 직관적인 '확인 필요'로 합친다(내부 ENUM은 유지).
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  CONFIRMED: '확정',
  LIKELY: '확인 필요',
  ESTIMATED: '확인 필요',
  UNVERIFIED: '확인 필요',
};

export const CONFIDENCE_SOURCE_LABEL: Record<ConfidenceSource, string> = {
  OWNER: '사업자 확인',
  CROWD: '방문자 제보 다수 일치',
  PARSED: '관광공사 원문 기반',
  USER_CALL: '내가 전화로 확인',
  DENIAL_REPORT: '현장 거부 제보 접수',
  SERVER: '확인 완료',
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
  /** 위경도(선택) — 있으면 코스 동선을 nearest-neighbor로 최적화. 서버 검색 응답엔 아직 없다 */
  latitude?: number;
  longitude?: number;
  petAllowed: boolean | null;
  petConditionRaw: string | null;
  maxWeight: number | null;
  requirements: Requirement[];
  /** 행정구역 — 실제로는 관광공사 areaCode/sigunguCode. 목은 이름으로 둔다 */
  sido: string;
  sigungu: string;
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

/** 방금 일어난 일을 분 단위로 (예: "23분 전"). 현장 거부 경고처럼 신선도가 곧 신뢰도인 곳에 쓴다 */
export function sinceText(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
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

/** 리뷰에 공개된 반려동물 스냅샷 — 펫을 나중에 지워도 남도록 값 복사 (opt-in 공개) */
export interface ReviewPetInfo {
  kind: PetKind;
  species: string;
  /** kg. 0이면 미기재 */
  weight: number;
}

export interface Review {
  reviewId: number;
  facilityId: number;
  userId: number;
  nickname: string;
  petName: string | null;
  /** 공개한 반려동물들(품종·몸무게). 빈 배열이면 비공개 */
  pets: ReviewPetInfo[];
  /** 공간 여유 / 직원 친절도 / 편의시설 — 각 1~5 */
  ratingSpace: number;
  ratingStaff: number;
  ratingAmenity: number;
  content: string | null;
  tags: ReviewTag[];
  visitedAt: string;
  /** 내가 이 리뷰를 신고했는지 (서버 제공). 목 폴백에선 undefined */
  reportedByMe?: boolean;
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

/** 시설 상세 친화도 탭에 필요한 전체 묶음 (집계 + 페이지 목록) — 서버 응답과 같은 모양 */
export interface FacilityReviewData {
  grade: PawGrade;
  categoryAverages: { space: number; staff: number; amenity: number };
  topTags: { tag: ReviewTag; count: number }[];
  reviews: Review[];
  pageInfo: { page: number; size: number; totalElements: number; hasNext: boolean };
}

export interface Pet {
  petId: number;
  name: string;
  /** 동물 종류 (강아지·고양이·새·토끼·파충류·소동물·기타) */
  kind: PetKind;
  /** 품종 (예: 말티즈, 앵무새). '견종'이 아니라 종류 불문 품종 */
  species: string;
  weight: number;
  breedSize: BreedSize;
  vaccinated: boolean;
  vaccinationDate: string | null;
  /** 다음 접종 예정일(사용자 지정). null이면 개·고양이는 마지막 접종+1년으로 자동 제안 */
  nextVaccinationDate: string | null;
  /** 프로필 사진 (선택). 없으면 이름 첫 글자로 아바타를 만든다 */
  photoUri: string | null;
}

/**
 * 다음 접종 예정일 — 사용자가 지정했으면 그 값, 없으면 개·고양이는 마지막 접종 + 1년으로 제안.
 * (부스터 1년 주기 가정. 정확한 일정은 동물병원 안내 기준 — 앱은 참고·리마인더용)
 */
export function nextVaccinationOf(pet: Pet): string | null {
  if (pet.nextVaccinationDate) return pet.nextVaccinationDate;
  if ((pet.kind === 'DOG' || pet.kind === 'CAT') && pet.vaccinationDate) {
    const d = new Date(`${pet.vaccinationDate}T00:00:00`);
    d.setFullYear(d.getFullYear() + 1);
    return ymd(d);
  }
  return null;
}

/** 다음 접종까지 남은 일수 (음수면 기한 지남). 예정일이 없으면 null */
export function vaccinationDday(pet: Pet): number | null {
  const next = nextVaccinationOf(pet);
  if (!next) return null;
  const today = new Date(`${ymd(new Date())}T00:00:00`).getTime();
  const due = new Date(`${next}T00:00:00`).getTime();
  return Math.round((due - today) / 86400000);
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

/** 홈 "좋아한 곳 TOP3" 항목 — 서버가 시설명·카테고리까지 계산해 내려준다 */
export interface TopPlace {
  facility: { facilityId: number; name: string; category: Category };
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
  RESTAURANT: '음식점',
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
  STROLLER: '유모차',
  MANNER_BELT: '매너벨트',
};

/* ── 반려동물 캘린더 ─────────────────────────────────────────
 * 예방접종·약 복용·건강검진·여행 일정을 한 곳에서 관리한다. */
export type CalEventType = 'VACCINE' | 'MED' | 'CHECKUP' | 'TRAVEL' | 'OTHER';
export type CalRepeat = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface CalendarEvent {
  eventId: number;
  /** 어느 아이의 일정인지. null이면 전체(여행 등) */
  petId: number | null;
  type: CalEventType;
  title: string;
  /** YYYY-MM-DD (시작일) */
  date: string;
  /** HH:MM, 없으면 종일 */
  time: string | null;
  repeat: CalRepeat;
  /** 알림 켜짐 여부 (실제 푸시는 백엔드/expo-notifications 연동 시) */
  reminder: boolean;
  notes: string | null;
}

/** 이벤트 종류별 표시 메타 — 앱 파스텔 팔레트에 맞춘 귀여운 색 */
export const CAL_EVENT_META: Record<
  CalEventType,
  { label: string; icon: string; color: string; soft: string }
> = {
  VACCINE: { label: '예방접종', icon: 'medkit', color: '#E86397', soft: '#FDEAF2' },
  MED: { label: '약 복용', icon: 'medical', color: '#E0952B', soft: '#FBEFD6' },
  CHECKUP: { label: '건강검진', icon: 'pulse', color: '#2BB3A3', soft: '#DBF4F0' },
  TRAVEL: { label: '여행', icon: 'airplane', color: '#4C8DF5', soft: '#E6EEFD' },
  OTHER: { label: '기타', icon: 'ellipsis-horizontal', color: '#8A8F9C', soft: '#EEF0F3' },
};

export const CAL_REPEAT_LABEL: Record<CalRepeat, string> = {
  NONE: '반복 안 함',
  DAILY: '매일',
  WEEKLY: '매주',
  MONTHLY: '매월',
};

/** 로컬 날짜를 YYYY-MM-DD로 (UTC 밀림 방지) */
export function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 반복을 고려해 이벤트가 특정 날짜(YYYY-MM-DD)에 발생하는지 */
export function eventOccursOn(e: CalendarEvent, target: string): boolean {
  if (e.date === target) return true;
  if (e.repeat === 'NONE' || target < e.date) return false;
  const d = new Date(`${target}T00:00:00`);
  const s = new Date(`${e.date}T00:00:00`);
  if (e.repeat === 'DAILY') return true;
  if (e.repeat === 'WEEKLY') return d.getDay() === s.getDay();
  if (e.repeat === 'MONTHLY') return d.getDate() === s.getDate();
  return false;
}
