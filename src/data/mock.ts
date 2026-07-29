import type { Report } from '@/store/app-store';

import type { Facility, Pet, PetCheck, PetSatisfaction, Review, ReviewTag } from '@/data/types';

/**
 * 데모용 목 데이터. 백엔드 연동 전까지 화면 검증에 사용한다.
 * 기준 위치: 강릉역 (거리값은 데모용 고정값)
 */
export const FACILITIES: Facility[] = [
  {
    facilityId: 1,
    name: '안목해변 솔숲 산책로',
    category: 'TOUR',
    address: '강원 강릉시 창해로14번길 20-1',
    phone: '033-640-4535',
    distanceM: 820,
    petAllowed: true,
    petConditionRaw: '리드줄(목줄) 착용 시 전 구간 반려동물 동반 산책 가능. 배설물은 반드시 수거해 주세요.',
    maxWeight: null,
    requirements: ['LEASH'],
    confidence: 'LIKELY',
    confidenceSource: 'PARSED',
    confirmedAt: '2026-07-10',
  },
  {
    facilityId: 2,
    name: '카페 파도살롱',
    category: 'CAFE',
    address: '강원 강릉시 창해로 17',
    phone: '033-651-2287',
    distanceM: 1200,
    petAllowed: true,
    petConditionRaw:
      '10kg 이하 소형견에 한해 실내 입장이 가능합니다. 리드줄은 필수이며, 대형견은 야외 테라스만 이용할 수 있습니다.',
    maxWeight: 10,
    requirements: ['LEASH'],
    confidence: 'LIKELY',
    confidenceSource: 'PARSED',
    confirmedAt: '2026-07-05',
  },
  {
    facilityId: 3,
    name: '오죽헌',
    category: 'TOUR',
    address: '강원 강릉시 율곡로3139번길 24',
    phone: '033-660-3301',
    distanceM: 4300,
    petAllowed: false,
    petConditionRaw: '문화재 보호구역으로 반려동물 출입이 불가능합니다.',
    maxWeight: null,
    requirements: [],
    confidence: 'CONFIRMED',
    confidenceSource: 'OWNER',
    confirmedAt: '2026-07-18',
  },
  {
    facilityId: 4,
    name: '스테이 솔바람 펜션',
    category: 'STAY',
    address: '강원 강릉시 사천면 진리해변길 111',
    phone: '033-644-8090',
    distanceM: 6100,
    petAllowed: true,
    petConditionRaw:
      '전 객실 반려동물 동반 가능합니다. 종합 예방접종 증명서 지참이 필수이며, 실내에서는 배변패드를 사용해 주세요.',
    maxWeight: null,
    requirements: ['VACCINATION'],
    confidence: 'LIKELY',
    confidenceSource: 'PARSED',
    confirmedAt: '2026-06-28',
  },
  {
    facilityId: 5,
    name: '경포호 반려견 놀이터',
    category: 'LEISURE',
    address: '강원 강릉시 운정길 125',
    phone: null,
    distanceM: 3500,
    petAllowed: true,
    petConditionRaw: '체급별 분리 운동장 운영. 종합 예방접종을 완료한 반려견만 입장할 수 있습니다.',
    maxWeight: null,
    requirements: ['VACCINATION'],
    confidence: 'CONFIRMED',
    confidenceSource: 'CROWD',
    confirmedAt: '2026-07-20',
  },
  {
    facilityId: 6,
    name: '강릉중앙시장',
    category: 'SHOPPING',
    address: '강원 강릉시 금성로 21',
    phone: '033-648-2285',
    distanceM: 2800,
    petAllowed: null,
    petConditionRaw: null,
    maxWeight: null,
    requirements: [],
    confidence: 'UNVERIFIED',
    confidenceSource: 'NONE',
    confirmedAt: null,
  },
  {
    facilityId: 7,
    name: '헤이도그 애견호텔&카페',
    category: 'CAFE',
    address: '강원 강릉시 경강로 2100',
    phone: '033-645-7712',
    distanceM: 1900,
    petAllowed: true,
    petConditionRaw: '전 견종 입장 가능합니다. 케이지 또는 리드줄을 지참해 주세요.',
    maxWeight: null,
    requirements: ['LEASH'],
    confidence: 'CONFIRMED',
    confidenceSource: 'OWNER',
    confirmedAt: '2026-07-21',
  },
  {
    facilityId: 8,
    name: '정동진 레일바이크',
    category: 'LEISURE',
    address: '강원 강릉시 강동면 정동역길 17',
    phone: '033-655-7786',
    distanceM: 15200,
    petAllowed: true,
    petConditionRaw: '케이지(이동장) 탑승 시 7kg 이하 소형견만 동반 가능합니다.',
    maxWeight: 7,
    requirements: ['CAGE', 'SMALL_ONLY'],
    confidence: 'ESTIMATED',
    confidenceSource: 'PARSED',
    confirmedAt: '2026-05-30',
  },
  {
    facilityId: 9,
    name: '씨마크 호텔',
    category: 'STAY',
    address: '강원 강릉시 해안로406번길 2',
    phone: '033-650-7000',
    distanceM: 5000,
    petAllowed: false,
    petConditionRaw: '반려동물 동반 입실이 불가능합니다.',
    maxWeight: null,
    requirements: [],
    confidence: 'CONFIRMED',
    confidenceSource: 'OWNER',
    confirmedAt: '2026-07-15',
  },
  {
    facilityId: 10,
    name: '테라로사 커피공장',
    category: 'CAFE',
    address: '강원 강릉시 구정면 현천길 25',
    phone: '033-648-2760',
    distanceM: 7800,
    petAllowed: true,
    petConditionRaw: '야외 좌석에 한해 반려동물 동반이 가능합니다. 리드줄을 꼭 착용해 주세요.',
    maxWeight: null,
    requirements: ['LEASH', 'OUTDOOR_ONLY'],
    confidence: 'ESTIMATED',
    confidenceSource: 'PARSED',
    confirmedAt: '2026-06-12',
  },
];

export const INITIAL_PETS: Pet[] = [
  {
    petId: 1,
    name: '몽이',
    species: '말티즈',
    weight: 3.2,
    breedSize: 'SMALL',
    vaccinated: true,
    vaccinationDate: '2026-03-15',
    photoUri: null,
  },
  {
    petId: 2,
    name: '보리',
    species: '골든리트리버',
    weight: 27.5,
    breedSize: 'LARGE',
    vaccinated: false,
    vaccinationDate: null,
    photoUri: null,
  },
];

/**
 * 데모용 개인 만족도 — 아이마다 같은 장소를 다르게 평가한 예시.
 * 홈 화면의 "이 아이가 좋아한 곳 TOP 3"가 채워지도록 시드한다.
 */
export const INITIAL_SATISFACTIONS: PetSatisfaction[] = [
  // 몽이(말티즈): 아늑한 실내·산책로를 좋아함
  { petId: 1, facilityId: 7, score: 9.4 }, // 헤이도그 애견카페
  { petId: 1, facilityId: 1, score: 8.7 }, // 안목해변 솔숲
  { petId: 1, facilityId: 2, score: 8.1 }, // 카페 파도살롱
  { petId: 1, facilityId: 5, score: 6.5 }, // 경포호 놀이터
  // 보리(골든리트리버): 뛰어놀 넓은 공간을 좋아함
  { petId: 2, facilityId: 5, score: 9.8 }, // 경포호 반려견 놀이터
  { petId: 2, facilityId: 7, score: 8.9 }, // 헤이도그
  { petId: 2, facilityId: 4, score: 8.3 }, // 스테이 솔바람 펜션
  { petId: 2, facilityId: 2, score: 4.2 }, // 카페 파도살롱 (실내가 좁아 시큰둥)
];

export function formatDistance(m: number): string {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

/**
 * 데모용 리뷰. 실제로는 GET /api/v1/facilities/{id}/reviews 로 받아온다.
 * 발자국 등급이 눈에 보이도록 시설별 리뷰 수·점수 분포를 다르게 구성했다.
 * 등급 임계값(최소 리뷰 10/25/50/90/150)에 맞춰 1~5발자국과 '수집 중' 상태가 모두 나오게 잡았다.
 */
function makeReviews(
  facilityId: number,
  count: number,
  base: [number, number, number],
  samples: { nick: string; pet: string; text: string; tags: ReviewTag[] }[],
): Review[] {
  const out: Review[] = [];
  for (let i = 0; i < count; i++) {
    const s = samples[i % samples.length];
    // 앞쪽 몇 건만 본문을 노출하고, 나머지는 점수만 있는 리뷰로 둔다
    const jitter = i % 3 === 0 ? 0 : i % 3 === 1 ? -1 : 0;
    const clamp = (n: number) => Math.max(1, Math.min(5, n));
    out.push({
      reviewId: facilityId * 1000 + i,
      facilityId,
      userId: 100 + i,
      nickname: i < samples.length ? s.nick : `방문자${i + 1}`,
      petName: i < samples.length ? s.pet : null,
      ratingSpace: clamp(base[0] + (i % 4 === 0 ? jitter : 0)),
      ratingStaff: clamp(base[1] + (i % 5 === 0 ? jitter : 0)),
      ratingAmenity: clamp(base[2] + (i % 3 === 0 ? jitter : 0)),
      content: i < samples.length ? s.text : null,
      tags: i < samples.length ? s.tags : [],
      visitedAt: `2026-0${(i % 6) + 2}-${String((i % 27) + 1).padStart(2, '0')}`,
    });
  }
  return out;
}

export const REVIEWS: Review[] = [
  ...makeReviews(7, 160, [5, 5, 5], [
    { nick: '몽이아빠', pet: '몽이', text: '실내 놀이터가 따로 있어서 몽이가 마음껏 뛰었어요. 직원분들이 간식까지 챙겨 주셨습니다.', tags: ['SPACIOUS', 'STAFF_LOVES_PETS', 'OFF_LEASH_OK'] },
    { nick: '보리집사', pet: '보리', text: '대형견도 눈치 안 보고 있을 수 있는 곳이에요. 급수대랑 배변봉투도 잘 갖춰져 있습니다.', tags: ['LARGE_DOG_OK', 'WATER_BOWL', 'POOP_BAG'] },
    { nick: '초코맘', pet: '초코', text: '펫 메뉴가 있어서 같이 먹었어요. 주차도 편하고 재방문 의사 100%.', tags: ['PET_MENU', 'PARKING'] },
  ]),
  ...makeReviews(5, 95, [5, 4, 5], [
    { nick: '해피가족', pet: '해피', text: '체급별로 운동장이 나뉘어 있어서 소형견도 안전했어요.', tags: ['SPACIOUS', 'OFF_LEASH_OK'] },
    { nick: '두부아빠', pet: '두부', text: '급수대가 곳곳에 있고 그늘도 충분합니다. 여름에도 괜찮았어요.', tags: ['WATER_BOWL', 'SPACIOUS'] },
  ]),
  ...makeReviews(1, 55, [5, 4, 4], [
    { nick: '산책러', pet: '콩이', text: '솔숲 그늘이 좋아서 한여름에도 산책하기 좋아요. 배변봉투함이 입구에 있습니다.', tags: ['SPACIOUS', 'POOP_BAG', 'QUIET'] },
    { nick: '바다보리', pet: '보리', text: '바다 바로 옆이라 뷰가 좋습니다. 주말엔 사람이 많아 목줄 필수예요.', tags: ['OUTDOOR_SEAT'] },
  ]),
  ...makeReviews(2, 30, [4, 5, 4], [
    { nick: '라떼언니', pet: '라떼', text: '소형견 기준이라 몽이는 실내 OK. 직원분이 물그릇 먼저 챙겨 주셨어요.', tags: ['WATER_BOWL', 'STAFF_LOVES_PETS'] },
    { nick: '커피중독', pet: '별이', text: '테라스가 넓어 대형견도 앉을 수 있어요. 다만 실내는 10kg 제한 있습니다.', tags: ['OUTDOOR_SEAT'] },
  ]),
  ...makeReviews(4, 18, [5, 4, 4], [
    { nick: '펜션러버', pet: '뭉치', text: '전 객실 동반 가능이라 편했어요. 마당이 넓어 뛰어놀기 좋습니다.', tags: ['SPACIOUS', 'PARKING'] },
    { nick: '주말여행', pet: '까미', text: '배변패드를 미리 준비해 두셔서 좋았어요. 접종증명서는 꼭 챙기세요.', tags: ['POOP_BAG'] },
  ]),
  ...makeReviews(10, 12, [4, 4, 3], [
    { nick: '원두킬러', pet: '모카', text: '야외석만 가능하지만 공간이 넓고 조용해서 좋았습니다.', tags: ['OUTDOOR_SEAT', 'QUIET'] },
    { nick: '드라이브', pet: '단추', text: '주차장이 넓어요. 실내는 못 들어가니 날씨 확인하고 가세요.', tags: ['PARKING'] },
  ]),
  ...makeReviews(8, 8, [3, 4, 3], [
    { nick: '레일바이크', pet: '땅콩', text: '케이지에 넣어야 해서 소형견만 가능해요. 직원분은 친절하셨습니다.', tags: ['STAFF_LOVES_PETS'] },
  ]),
  ...makeReviews(6, 4, [3, 3, 2], [
    { nick: '시장구경', pet: '메주', text: '동반 가능 여부가 점포마다 달라요. 입구에서 확인하는 게 좋습니다.', tags: [] },
  ]),
];

/**
 * 다른 방문자가 방금 보낸 현장 거부 제보.
 * 내가 아직 아무 제보도 하지 않은 상태에서도 "누군가의 거부가 나를 구한다"는
 * 플라이휠이 화면에 보여야 해서 하나를 씨드로 둔다. 실제로는 서버가 내려준다.
 */
export const INITIAL_REPORTS: Report[] = [
  {
    reportId: 1,
    facilityId: 10, // 테라로사 커피공장 — 원문이 모호해 '추정'이던 곳이 실제로 틀렸던 사례
    type: 'DENIED',
    content: '현장 거부 · 실내 불가',
    weight: 2,
    hasEvidence: false,
    reason: 'INDOOR',
    mine: false,
    realtime: true,
    status: 'APPLIED',
    createdAt: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
  },
];

/**
 * 데모용 판별 이력 씨드 — "AI 판별받고 가려던 곳".
 * 테라로사(시설 10)를 이미 판별해 둔 상태로 두면, 그 시설에 들어온 거부 제보(INITIAL_REPORTS)와
 * 맞물려 홈에서 "가려던 곳에 거부가 떴어요" 알림이 바로 보인다. 실제로는 사용자의 실제 판별 이력.
 */
export const INITIAL_CHECKS: PetCheck[] = [
  {
    checkId: 1,
    facilityId: 10, // 테라로사 커피공장 — 판별받고 가려던 곳
    petIds: [1, 2],
    verdicts: [
      { petId: 1, result: 'CONDITIONAL', reason: '몽이(말티즈, 3.2kg)는 입장 조건을 충족해요. 다만 아래 조건을 지켜 주세요.', conditions: ['리드줄 필수 착용', '야외 공간만 이용 가능'] },
      { petId: 2, result: 'CONDITIONAL', reason: '보리(골든리트리버, 27.5kg)는 입장 조건을 충족해요. 다만 아래 조건을 지켜 주세요.', conditions: ['리드줄 필수 착용', '야외 공간만 이용 가능'] },
    ],
    overall: 'CONDITIONAL',
    checklist: ['리드줄 필수 지참', '휴대용 물그릇 준비'],
    tips: [],
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), // 40분 전 판별
  },
];

export function reviewsOf(facilityId: number): Review[] {
  return REVIEWS.filter((r) => r.facilityId === facilityId);
}
