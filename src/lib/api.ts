import type {
  Category,
  Facility,
  FacilityReviewData,
  CheckResult,
  CourseDistanceOption,
  CourseRegion,
  CourseStop,
  CourseCheckResult,
  CourseCheckStop,
  CourseTheme,
  LikedCourse,
  LikedStop,
  PawGrade,
  Pet,
  PetVerdictResult,
  PresetCourse,
  RankingItem,
  SimilarCourse,
  SimilarStop,
  Region,
  Requirement,
  Review,
  ReviewPetInfo,
  ReviewTag,
} from '@/data/types';
import { REVIEW_TAG_LABEL } from '@/data/types';

import { API_URL, DEV_TOKEN } from './config';

/**
 * 백엔드 API 클라이언트.
 * 서버 응답 봉투: { isSuccess, code, message, result }.
 * 성공이면 result만 돌려주고, 실패·네트워크 오류는 ApiError로 던진다.
 *
 * 계약의 단일 소스는 라이브 Swagger: https://54.116.37.26/swagger-ui/index.html
 */
export type ApiEnvelope<T> = {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T;
};

export type LoginResult = { accessToken: string; refreshToken: string };

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

// ─────────────────────────── 인증 토큰 ───────────────────────────
// 로그인 성공 시 store가 setAuthToken으로 넣어준다. api.ts는 React에 의존하지 않도록
// 모듈 변수로 들고 있다가 보호 API 호출 시 헤더에 붙인다.
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** 지금 요청에 쓸 토큰. 로그인 토큰이 없고 개발 모드면 10년 테스트 토큰으로 대체한다. */
function currentToken(): string | null {
  if (authToken) return authToken;
  if (__DEV__ && DEV_TOKEN) return DEV_TOKEN;
  return null;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * 공통 요청기. auth:true면 Authorization: Bearer 헤더를 붙인다.
 * body가 FormData면 multipart로 보낸다(Content-Type을 직접 넣지 않아 경계값이 자동 설정됨).
 */
async function request<T>(method: Method, path: string, opts: { body?: unknown; auth?: boolean } = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (opts.auth) {
    const token = currentToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    });
  } catch {
    // 네트워크 실패(연결 불가·CORS·mixed content 등)
    throw new ApiError('서버에 연결할 수 없어요. 네트워크를 확인해주세요.');
  }
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!json || typeof json.isSuccess !== 'boolean') {
    // 업로드 용량 초과는 nginx가 앱 envelope가 아닌 413(HTML)로 막는다 → 친화 메시지로 변환
    if (res.status === 413) {
      throw new ApiError('사진 용량이 너무 커요. 20MB 이하로 올려주세요.', 'PAYLOAD_TOO_LARGE', 413);
    }
    throw new ApiError(`서버 응답 오류 (${res.status})`, undefined, res.status);
  }
  if (!json.isSuccess) {
    throw new ApiError(json.message || '요청에 실패했어요.', json.code, res.status);
  }
  return json.result;
}

export const authApi = {
  /** 이메일 회원가입 — 성공 시 계정 생성(토큰은 로그인에서 발급). nickname 2~20자, password 8~64자. */
  signup: (email: string, password: string, nickname: string) =>
    request<Record<string, never>>('POST', '/api/v1/users/signup', { body: { email, password, nickname } }),
  /** 이메일 로그인 — 액세스·리프레시 토큰 반환. */
  login: (email: string, password: string) =>
    request<LoginResult>('POST', '/api/v1/users/login', { body: { email, password } }),
};

// ─────────────────────────── 반려동물(pets) ───────────────────────────
// 서버 스키마(라이브 Swagger)와 앱 Pet의 차이:
//  - kind enum 이름만 다르다: 앱 BIRD↔서버 PARROT, 앱 SMALL_MAMMAL↔서버 SMALL_ANIMAL (나머지는 동일, 1:1).
//  - create/update는 multipart/form-data. profile은 이미지 파일(선택). 조회 시 profile은 URL 문자열.
//  - 서버 isVaccinated ↔ 앱 vaccinated.
type ServerKind = 'DOG' | 'CAT' | 'PARROT' | 'RABBIT' | 'REPTILE' | 'SMALL_ANIMAL';

const KIND_TO_SERVER: Record<Pet['kind'], ServerKind> = {
  DOG: 'DOG',
  CAT: 'CAT',
  BIRD: 'PARROT',
  RABBIT: 'RABBIT',
  REPTILE: 'REPTILE',
  SMALL_MAMMAL: 'SMALL_ANIMAL',
};

const KIND_FROM_SERVER: Record<ServerKind, Pet['kind']> = {
  DOG: 'DOG',
  CAT: 'CAT',
  PARROT: 'BIRD',
  RABBIT: 'RABBIT',
  REPTILE: 'REPTILE',
  SMALL_ANIMAL: 'SMALL_MAMMAL',
};

type ServerPet = {
  petId: number;
  name: string;
  kind: ServerKind;
  species: string;
  weight: number;
  breedSize: Pet['breedSize'];
  profile?: string | null;
  vaccinationDate?: string | null;
  nextVaccinationDate?: string | null;
  isVaccinated?: boolean;
};

/** 서버 → 앱 Pet. profile(URL 문자열)은 photoUri로 그대로 표시된다. */
function toPet(s: ServerPet): Pet {
  return {
    petId: s.petId,
    name: s.name,
    kind: KIND_FROM_SERVER[s.kind] ?? 'SMALL_MAMMAL',
    species: s.species,
    weight: s.weight,
    breedSize: s.breedSize,
    vaccinated: s.isVaccinated ?? false,
    vaccinationDate: s.vaccinationDate ?? null,
    nextVaccinationDate: s.nextVaccinationDate ?? null,
    photoUri: s.profile || null,
  };
}

/**
 * 앱 Pet → 서버 create/update용 multipart FormData.
 * photoUri가 새로 고른 로컬 이미지(file://·blob:·data:)면 profile 파일로 첨부하고,
 * 이미 서버 URL(http)이거나 없으면 첨부하지 않는다(기존 사진 유지·미설정).
 */
async function toForm(p: Omit<Pet, 'petId'>): Promise<FormData> {
  const fd = new FormData();
  fd.append('name', p.name);
  fd.append('kind', KIND_TO_SERVER[p.kind]);
  fd.append('species', p.species);
  fd.append('weight', String(p.weight));
  fd.append('breedSize', p.breedSize);
  fd.append('isVaccinated', String(p.vaccinated));
  if (p.vaccinationDate) fd.append('vaccinationDate', p.vaccinationDate);
  if (p.nextVaccinationDate) fd.append('nextVaccinationDate', p.nextVaccinationDate);
  if (p.photoUri && !/^https?:/.test(p.photoUri)) {
    const blob = await (await fetch(p.photoUri)).blob();
    fd.append('profile', blob, 'profile.jpg');
  }
  return fd;
}

export const petsApi = {
  /** 내 반려동물 목록 — result.pets 로 한 겹 감싸져 온다. */
  list: async (): Promise<Pet[]> => {
    const r = await request<{ pets: ServerPet[] }>('GET', '/api/v1/pets', { auth: true });
    return (r.pets ?? []).map(toPet);
  },
  /** 등록(multipart) — 성공 시 새 petId 반환. */
  create: async (input: Omit<Pet, 'petId'>) =>
    request<{ petId: number }>('POST', '/api/v1/pets', { body: await toForm(input), auth: true }),
  /** 단건 조회. */
  get: async (petId: number): Promise<Pet> => toPet(await request<ServerPet>('GET', `/api/v1/pets/${petId}`, { auth: true })),
  /** 수정(전체 필드, multipart PUT). */
  update: async (petId: number, input: Omit<Pet, 'petId'>): Promise<Pet> =>
    toPet(await request<ServerPet>('PUT', `/api/v1/pets/${petId}`, { body: await toForm(input), auth: true })),
  /** 삭제. */
  remove: (petId: number) => request<{ petId: number }>('DELETE', `/api/v1/pets/${petId}`, { auth: true }),
};

// ─────────────────────────── 마이페이지(account) ───────────────────────────
// GET  /users/account → { nickname, avatarUri }
// PATCH /users/account (multipart) → nickname(필수) + avatar(선택 파일). 이메일은 응답에 없음.
type ServerAccount = { nickname: string; avatarUri: string | null };

export const accountApi = {
  /** 내 회원정보 조회. */
  get: () => request<ServerAccount>('GET', '/api/v1/users/account', { auth: true }),
  /**
   * 회원정보 수정(multipart PATCH). nickname은 매번 필수.
   * photoUri가 새로 고른 로컬 이미지면 avatar 파일로 첨부, http URL·null이면 미첨부(기존 유지).
   */
  update: async (nickname: string, photoUri: string | null): Promise<ServerAccount> => {
    const fd = new FormData();
    fd.append('nickname', nickname);
    if (photoUri && !/^https?:/.test(photoUri)) {
      const blob = await (await fetch(photoUri)).blob();
      fd.append('avatar', blob, 'avatar.jpg');
    }
    return request<ServerAccount>('PATCH', '/api/v1/users/account', { body: fd, auth: true });
  },
};

// ─────────────────────────── 시설(facilities) ───────────────────────────
// POST /facilities/search — 내 주변·키워드 검색 공용. 데이터 출처: 한국관광공사 국문 관광정보(약 4.8만건).
// 서버 category는 8종(TOUR/CULTURE/FESTIVAL/LEISURE/STAY/SHOPPING/RESTAURANT/CAFE) — 앱 6종으로 매핑.
export type FacilitySearchParams = {
  latitude: number;
  longitude: number;
  keyword?: string;
  category?: Category;
  petAllowed?: 'ALLOWED' | 'DENIED' | 'PENDING';
  radiusM?: number;
  page?: number;
  size?: number;
};

type ServerFacility = {
  facilityId: number;
  name: string;
  category: string;
  address: string | null;
  distanceM: number;
  petAllowed: 'ALLOWED' | 'DENIED' | 'PENDING';
  maxWeight: number | null;
  requirements: string[];
  petScore: number | null;
  rating: string | null;
  reviewCnt: number;
};

const CATEGORY_FROM_SERVER: Record<string, Category> = {
  TOUR: 'TOUR',
  CULTURE: 'TOUR', // 문화시설 → 관광지로 흡수
  FESTIVAL: 'LEISURE', // 축제 → 레포츠로 흡수
  LEISURE: 'LEISURE',
  STAY: 'STAY',
  SHOPPING: 'SHOPPING',
  RESTAURANT: 'RESTAURANT',
  CAFE: 'CAFE',
};
// 서버 enum과 같은 8종. 여기 없는 값은 toFacility가 조용히 버리므로, 서버가 새 값을 추가하면
// 조건이 있는데 없는 것처럼 보인다 — 헛걸음 방지가 목적이라 이 방향의 누락이 제일 위험하다.
const KNOWN_REQS: Requirement[] = [
  'LEASH',
  'CAGE',
  'MUZZLE',
  'VACCINATION',
  'SMALL_ONLY',
  'OUTDOOR_ONLY',
  'STROLLER',
  'MANNER_BELT',
];

/** 서버 시설 → 앱 Facility. 검색 응답엔 없는 필드(원문·전화·신뢰도)는 기본값으로 채운다. */
function toFacility(s: ServerFacility): Facility {
  return {
    facilityId: s.facilityId,
    name: s.name,
    category: CATEGORY_FROM_SERVER[s.category] ?? 'TOUR',
    address: s.address ?? '',
    phone: null,
    distanceM: s.distanceM,
    petAllowed: s.petAllowed === 'ALLOWED' ? true : s.petAllowed === 'DENIED' ? false : null,
    petConditionRaw: null, // 검색 응답엔 원문이 없다(상세 API 나오면 채움)
    maxWeight: s.maxWeight,
    requirements: (s.requirements ?? []).filter((r): r is Requirement => (KNOWN_REQS as string[]).includes(r)),
    sido: '',
    sigungu: '',
    // 관광공사 원문 기반이라 아직 '확인 필요'(확정 전). 사업자·전화·제보로 갱신됨.
    confidence: 'ESTIMATED',
    confidenceSource: 'PARSED',
    confirmedAt: null,
  };
}

// GET /facilities/{id} — 상세. 검색을 안 거치고 들어와도(홈 TOP3·알림·딥링크) 화면이 채워진다.
// 검색 응답에 없는 것: 동반 조건 안내문·전화·좌표·확정 시각.
// 검색에만 있는 것: maxWeight·requirements(상세 응답엔 없음) → 스토어에서 병합한다.
type ServerFacilityDetail = {
  facilityId: number;
  name: string;
  category: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
  petAllowed: 'ALLOWED' | 'DENIED' | 'PENDING';
  petConditionRaw: string | null;
  confirmedAt: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

/**
 * 상세 API가 채울 수 있는 필드만. 나머지(maxWeight 등)는 검색 값을 유지해야 하므로 타입으로 못 박는다.
 * distanceM·address는 Facility와 다르게 nullable이다 — '서버가 안 줬다'(null)와 실제 값('거리 0m',
 * '빈 주소')을 구분해야 병합에서 검색으로 알던 값을 빈 값으로 덮어쓰지 않는다.
 */
export type FacilityDetail = Pick<
  Facility,
  | 'facilityId'
  | 'name'
  | 'category'
  | 'phone'
  | 'latitude'
  | 'longitude'
  | 'petAllowed'
  | 'petConditionRaw'
  | 'confidence'
  | 'confidenceSource'
  | 'confirmedAt'
> & { distanceM: number | null; address: string | null };

function toFacilityDetail(s: ServerFacilityDetail): FacilityDetail {
  // confirmedAt이 있으면 서버가 동반 조건을 확정한 것이다. 다만 확정 주체(사업자/사용자)는
  // 응답에 없어 SERVER로 둔다 — 없는 근거를 지어내면 사용자가 잘못 신뢰한다.
  const confirmed = s.confirmedAt !== null;
  return {
    facilityId: s.facilityId,
    name: s.name,
    category: CATEGORY_FROM_SERVER[s.category] ?? 'TOUR',
    // 주소를 ''로 뭉개지 않는다 — 그대로 넘겨야 호출부가 검색에서 알던 주소를 남길 수 있다.
    address: s.address,
    phone: s.phone,
    // 좌표를 안 보냈거나 시설에 좌표가 없으면 null. 0으로 뭉개지 않고 그대로 넘겨 호출부가 병합한다.
    distanceM: s.distanceM,
    latitude: s.latitude ?? undefined,
    longitude: s.longitude ?? undefined,
    petAllowed: s.petAllowed === 'ALLOWED' ? true : s.petAllowed === 'DENIED' ? false : null,
    petConditionRaw: s.petConditionRaw,
    confidence: confirmed ? 'CONFIRMED' : 'ESTIMATED',
    confidenceSource: confirmed ? 'SERVER' : 'PARSED',
    confirmedAt: s.confirmedAt,
  };
}

export const facilitiesApi = {
  /** 시설 목록 검색(거리순). result.items → Facility[], result.total과 함께 반환. */
  search: async (params: FacilitySearchParams): Promise<{ items: Facility[]; total: number }> => {
    const r = await request<{ items: ServerFacility[]; total: number }>('POST', '/api/v1/facilities/search', {
      body: params,
      auth: true,
    });
    return { items: (r.items ?? []).map(toFacility), total: r.total ?? 0 };
  },

  /**
   * 시설 상세. 좌표는 선택이지만 **둘 중 하나만 보내면 400**이라 쌍으로만 싣는다.
   * facilityId에 숫자가 아닌 값이 가면 서버가 400이 아니라 500을 낸다(알려진 이슈) → 호출 전 검증.
   */
  detail: async (facilityId: number, coords?: { latitude: number; longitude: number }): Promise<FacilityDetail> => {
    const q =
      coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)
        ? `?latitude=${coords.latitude}&longitude=${coords.longitude}`
        : '';
    const r = await request<ServerFacilityDetail>('GET', `/api/v1/facilities/${facilityId}${q}`, { auth: true });
    return toFacilityDetail(r);
  },

  /**
   * 발자국 랭킹. 등급 받은 시설만 내려온다.
   *
   * 400을 부르는 조합이 셋 있어 여기서 막는다(서버가 400을 내면 화면이 통째로 실패한다):
   *   ① 위도·경도 중 하나만  ② 좌표 없이 radiusM만  ③ sidoCode 없이 sigunguCode만
   */
  ranking: async (params: RankingParams): Promise<{ items: RankingItem[]; total: number }> => {
    const q = new URLSearchParams();
    const hasCoords = Number.isFinite(params.latitude) && Number.isFinite(params.longitude);
    if (hasCoords) {
      q.set('latitude', String(params.latitude));
      q.set('longitude', String(params.longitude));
      // radiusM은 좌표가 있을 때만 유효하다
      if (params.radiusM != null) q.set('radiusM', String(params.radiusM));
    }
    if (params.sidoCode) {
      q.set('sidoCode', params.sidoCode);
      // sigunguCode는 sidoCode와 함께일 때만 유효하다
      if (params.sigunguCode) q.set('sigunguCode', params.sigunguCode);
    }
    if (params.category) q.set('category', params.category);
    if (params.petAllowed) q.set('petAllowed', params.petAllowed);
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 20));

    const r = await request<{ items: ServerRankingItem[]; total: number }>(
      'GET',
      `/api/v1/facilities/ranking?${q.toString()}`,
      { auth: true },
    );
    return { items: (r.items ?? []).map(toRankingItem), total: r.total ?? 0 };
  },

  /**
   * 지역 칩 목록. 결과가 비어 있으면 연동 실패가 아니라 **서버의 지역 테이블 적재 전**이다
   * (랭킹의 리뷰 집계 백필과는 별개 조건이다).
   */
  regions: async (): Promise<Region[]> => {
    const r = await request<Region[]>('GET', '/api/v1/facilities/regions', { auth: true });
    return r ?? [];
  },
};

export type RankingParams = {
  latitude?: number;
  longitude?: number;
  sidoCode?: string;
  sigunguCode?: string;
  category?: Category;
  petAllowed?: 'ALLOWED' | 'DENIED' | 'PENDING';
  radiusM?: number;
  page?: number;
  size?: number;
};

/**
 * 명세상 `pawGrade`·`petScore`·`reviewCnt`는 non-null이지만(등급 받은 시설만 내려오므로),
 * 리뷰 집계 백필 전이라 **실제 응답을 아직 한 번도 못 봤다**. 없는 값을 그대로 읽으면 목록이
 * 통째로 죽으므로 nullable로 받아 변환에서 기본값을 확정한다 — `toFacility`가 `category`·
 * `requirements`를 방어하는 것과 같은 자세다. 앱 쪽 `RankingItem`은 non-null이라 화면은
 * 방어를 신경 쓰지 않아도 된다.
 *
 * 참고: 같은 `petScore`라도 검색 응답은 `number | null`이고 명세에 "현재는 항상 null"로 적혀
 * 있다. 랭킹과 계약이 다르므로 두 타입을 공유하지 않는다.
 */
type ServerRankingItem = {
  rank: number;
  facilityId: number;
  name: string;
  category: string;
  sido: string | null;
  sigungu: string | null;
  distanceM: number | null;
  petAllowed: 'ALLOWED' | 'DENIED' | 'PENDING';
  pawGrade: { level: number; label: string } | null;
  petScore: number | null;
  reviewCnt: number | null;
};

function toRankingItem(s: ServerRankingItem): RankingItem {
  return {
    rank: s.rank,
    facilityId: s.facilityId,
    name: s.name,
    category: CATEGORY_FROM_SERVER[s.category] ?? 'TOUR',
    sido: s.sido,
    sigungu: s.sigungu,
    distanceM: s.distanceM,
    petAllowed: s.petAllowed === 'ALLOWED' ? true : s.petAllowed === 'DENIED' ? false : null,
    pawLevel: s.pawGrade?.level ?? 0,
    pawLabel: s.pawGrade?.label ?? '',
    petScore: s.petScore ?? 0,
    reviewCnt: s.reviewCnt ?? 0,
  };
}

// ─────────────────────────── 리뷰(reviews) ───────────────────────────
// GET    /facilities/{id}/reviews  — 등급 집계(전체) + 페이지 목록
// POST   /facilities/{id}/reviews  — 작성/수정(upsert, 시설당 1인 1리뷰)
// DELETE /reviews/{id}             — 소프트 삭제(본인만)
// POST   /reviews/{id}/report      — 신고(1인 1회)
//
// 서버 tags·kind는 앱 enum과 이름이 같거나(태그) 매핑(kind: PARROT↔BIRD 등)된다.
// 등급 grade.level은 미달 시 0으로 오지만, 앱 PawBadge는 null을 "리뷰 수집 중"으로 그리므로 0→null로 맞춘다.
type ServerReviewPet = { petId: number; kind: ServerKind; species: string; weight: number };
type ServerReview = {
  reviewId: number;
  facilityId: number;
  userId: number;
  nickname: string;
  showPetInfo: boolean;
  pets: ServerReviewPet[];
  ratingSpace: number;
  ratingStaff: number;
  ratingAmenity: number;
  score100: number;
  content: string | null;
  tags: string[];
  visitedAt: string;
  reportedByMe: boolean;
};
type ServerReviewList = {
  grade: { level: number; label: string; score: number; count: number; needMore: number };
  categoryAverages: { space: number; staff: number; amenity: number };
  topTags: { tag: string; count: number }[];
  reviews: ServerReview[];
  pageInfo: { page: number; size: number; totalElements: number; hasNext: boolean };
};

const KNOWN_TAGS = Object.keys(REVIEW_TAG_LABEL) as ReviewTag[];
const isReviewTag = (t: string): t is ReviewTag => (KNOWN_TAGS as string[]).includes(t);

function toReview(s: ServerReview): Review {
  const pets: ReviewPetInfo[] = (s.pets ?? []).map((pt) => ({
    kind: KIND_FROM_SERVER[pt.kind] ?? 'SMALL_MAMMAL',
    species: pt.species,
    weight: pt.weight,
  }));
  return {
    reviewId: s.reviewId,
    facilityId: s.facilityId,
    userId: s.userId,
    nickname: s.nickname,
    petName: pets[0]?.species ?? null,
    pets,
    ratingSpace: s.ratingSpace,
    ratingStaff: s.ratingStaff,
    ratingAmenity: s.ratingAmenity,
    content: s.content ?? null,
    tags: (s.tags ?? []).filter(isReviewTag),
    visitedAt: s.visitedAt,
    reportedByMe: s.reportedByMe ?? false,
  };
}

/** 서버 등급 → 앱 PawGrade. level 0(미달)은 null로 바꿔 "리뷰 수집 중"으로 표시되게 한다. */
function toGrade(g: ServerReviewList['grade']): PawGrade {
  const graded = g.level > 0;
  return {
    level: graded ? g.level : null,
    label: graded ? g.label : null,
    score: g.score,
    count: g.count,
    needMore: g.needMore,
  };
}

export type NewReviewBody = {
  petIds: number[];
  showPetInfo: boolean;
  ratingSpace: number;
  ratingStaff: number;
  ratingAmenity: number;
  content: string;
  tags: ReviewTag[];
  visitedAt?: string;
};

// ─────────────────────────── AI 판별(ai) ───────────────────────────
// POST /ai/check — 규칙 엔진 판별. Claude 호출이 없는 순수 규칙 엔진이라 응답이 빠르다.
//
// ⚠️ 응답에 checklist·tips가 없다. 명세에 "별도 조회 API 자체가 없고 PetCheck.checklist/tips
// 컬럼도 채워주는 코드 경로가 없어 항상 NULL"로 적혀 있다. 그래서 준비물·팁은 앱이 만든다
// — 다만 서버가 준 conditions를 입력으로 써야 판별과 안내가 어긋나지 않는다(buildChecklist).

/** 서버 판별 응답. `verdicts[]`는 앱 `PetVerdictResult`와 같은 모양이다. */
export type AiCheckResult = {
  checkId: number;
  facilityId: number;
  overall: CheckResult;
  verdicts: PetVerdictResult[];
};

type ServerAiCheck = {
  checkId: number;
  facilityId: number;
  overall: CheckResult;
  verdicts: { petId: number; result: CheckResult; reason: string; conditions: string[] | null }[] | null;
};

export const aiApi = {
  /**
   * 코스 일괄 판별. 스톱마다 낱개 판별(`/ai/check`)과 **동일한 규칙**을 쓴다 —
   * 낱개와 코스가 다른 답을 내면 안 된다는 게 설계 의도다.
   *
   * `facilityIds`의 **배열 순서가 곧 방문 순서**이고 1~10개만 받는다(11개 이상 400).
   */
  courseCheck: async (petIds: number[], facilityIds: number[]): Promise<CourseCheckResult> => {
    const r = await request<{
      overall: CheckResult;
      blockedCount: number | null;
      stops: (Omit<CourseCheckStop, 'verdicts' | 'alternative' | 'facility'> & {
        facility: { facilityId: number; name: string; category: string };
        verdicts: (PetVerdictResult & { petName?: string; conditions: string[] | null })[] | null;
        alternative: { facilityId: number; name: string; distanceKm: number } | null;
      })[] | null;
    }>('POST', '/api/v1/ai/course-check', { body: { petIds, facilityIds }, auth: true });

    return {
      overall: r.overall,
      blockedCount: r.blockedCount ?? 0,
      stops: (r.stops ?? []).map((st) => ({
        facility: {
          facilityId: st.facility.facilityId,
          name: st.facility.name,
          category: CATEGORY_FROM_SERVER[st.facility.category] ?? 'TOUR',
        },
        time: st.time,
        verdicts: (st.verdicts ?? []).map((v) => ({ ...v, conditions: v.conditions ?? [] })),
        overall: st.overall,
        alternative: st.alternative,
      })),
    };
  },

  /**
   * 그룹 판별. 중복 petId는 서버가 알아서 무시한다.
   * `overall`은 verdicts 중 가장 심각한 값이라 앱이 다시 계산하지 않는다.
   */
  check: async (facilityId: number, petIds: number[]): Promise<AiCheckResult> => {
    const r = await request<ServerAiCheck>('POST', '/api/v1/ai/check', {
      body: { facilityId, petIds },
      auth: true,
    });
    const verdicts: PetVerdictResult[] = (r.verdicts ?? []).map((v) => ({
      petId: v.petId,
      result: v.result,
      reason: v.reason,
      // 조건이 없으면 서버가 [] 를 주지만, null로 와도 화면이 깨지지 않게 받는다
      conditions: v.conditions ?? [],
    }));

    // 아이별 판별이 요청한 만큼 오지 않으면 이 응답은 신뢰할 수 없다. 그대로 저장하면
    // **판별 근거 없이 overall만 보고 '입장 가능'이 뜨고**, 자동 여행 기록까지 남는다.
    // 헛걸음 방지가 목적인 서비스에서 근거 없는 '가능'은 가장 위험한 답이라, 조용히 넘기지
    // 않고 실패로 돌려 화면이 다시 시도하게 한다.
    const requested = new Set(petIds);
    const returned = new Set(verdicts.map((v) => v.petId));
    const covered = requested.size === returned.size && [...requested].every((id) => returned.has(id));
    if (!covered) {
      throw new ApiError('판별 결과를 받지 못했어요. 잠시 후 다시 시도해 주세요.');
    }

    return { checkId: r.checkId, facilityId: r.facilityId, overall: r.overall, verdicts };
  },
};

// ─────────────────────────── 여행 코스(courses) ───────────────────────────
// 코스는 만들어지는 방식에 따라 셋이다:
//   PRESET      지역×테마로 서버가 미리 계산해 캐시해둔 코스 (로그인 불필요)
//   RECOMMENDED 만족도 기록 기반 개인화 추천. 매 요청 즉시 계산하고 DB에 저장되지 않는다
//   CUSTOM      사용자가 직접 담아 저장한 코스
//
// ⚠️ 지역은 **이름 문자열**을 쓴다(`facilities/regions`의 코드와 다르다). 자유 텍스트라
// "강원" 같은 축약 표기를 보내면 실제 값("강원특별자치도")과 안 맞아 후보가 0건이 된다 —
// 반드시 `courses/regions` 응답의 값을 그대로 보낸다.

type ServerCourseStop = {
  facilityId: number;
  name: string;
  category: string;
  isMealStop: boolean | null;
  score: number | null;
  distanceM: number | null;
};

function toCourseStop(s: ServerCourseStop): CourseStop {
  return {
    facilityId: s.facilityId,
    name: s.name,
    category: CATEGORY_FROM_SERVER[s.category] ?? 'TOUR',
    isMealStop: s.isMealStop ?? false,
    score: s.score ?? 0,
    // null을 0으로 바꾸지 않는다 — formatDistance가 '거리 미상'으로 그리게 둔다
    distanceM: s.distanceM,
  };
}

/** liked·similar가 공유하는 파라미터. sigungu는 sido가 있을 때만 유효하다. */
export type CoursePersonalParams = {
  petIds: number[];
  maxDistanceM?: string;
  sido?: string;
  sigungu?: string;
  themes?: string[];
};

function personalQuery(params: CoursePersonalParams): string {
  const q = new URLSearchParams();
  params.petIds.forEach((id) => q.append('petIds', String(id)));
  if (params.maxDistanceM) q.set('maxDistanceM', params.maxDistanceM);
  if (params.sido) {
    q.set('sido', params.sido);
    // sido 없이 sigungu만 보내면 서버가 그 필터를 무시한다("고성군"이 여러 시/도에 있다)
    if (params.sigungu) q.set('sigungu', params.sigungu);
  }
  (params.themes ?? []).forEach((t) => q.append('themes', t));
  return q.toString();
}

export const coursesApi = {
  /** 동반 가능 시설이 실제로 있는 (시/도, 시/군/구) 조합만 내려온다. 인증 불필요. */
  regions: async (): Promise<CourseRegion[]> => {
    const r = await request<{ sidos: CourseRegion[] | null }>('GET', '/api/v1/courses/regions');
    return (r.sidos ?? []).map((x) => ({ sido: x.sido, sigungus: x.sigungus ?? [] }));
  },

  /** 테마 목록. 서버 코드에 고정된 값이라 프론트가 라벨을 하드코딩하지 않는다. 인증 불필요. */
  themes: async (): Promise<CourseTheme[]> => {
    const r = await request<{ themes: CourseTheme[] | null }>('GET', '/api/v1/courses/themes');
    return r.themes ?? [];
  },

  /**
   * 스톱 간 최대 거리 선택지. 연속값이 아니라 고정 구간만 받는다(캐시 적중률 때문).
   *
   * ⚠️ 명세(`api-specs/course.md`)는 "인증 불필요"라고 적었지만 **실제로는 401이 온다**
   * (2026-09-07 라이브 확인). 셋 중 이것만 다르다 — regions·themes·preset은 토큰 없이 된다.
   * 서버가 나중에 명세대로 열어도 토큰을 함께 보내는 건 무해하므로 auth를 붙여둔다.
   */
  distanceOptions: async (): Promise<CourseDistanceOption[]> => {
    const r = await request<{ options: CourseDistanceOption[] | null }>(
      'GET',
      '/api/v1/courses/distance-options',
      { auth: true },
    );
    return r.options ?? [];
  },

  /**
   * 지역×테마 추천. 인증 불필요라 로그인 없이도 "둘러보기"가 된다.
   *
   * 같은 조합을 다시 조회하면 **구성이 조금 달라질 수 있다** — 서버가 표시 개수(4곳)보다 넉넉한
   * 후보 풀(8곳)을 캐시해두고 매번 무작위로 뽑기 때문이다. 버그가 아니다.
   *
   * `sigungu`는 `sido`가 있을 때만 유효하다. "고성군"처럼 여러 시/도에 같은 이름이 실제로 있어서,
   * sido 없이 보내면 엉뚱한 지역이 섞인다 — 서버가 그 필터를 무시한다.
   */
  /**
   * 우리 아이가 좋아한 곳. **실제 방문(만족도 기록)하고 평균 6.5점 이상 받은 곳**만 후보다.
   * 추측이 아니라 경험 기반이라, 방문 기록이 없는 신규 유저는 아무것도 못 받는다(COURSE4002).
   *
   * COURSE4002는 네 상황을 한 코드로 준다(기록 없음 / 6.5점 이상이 2곳 미만 / 필터 후 2곳 미만 /
   * 거리 제약으로 2곳 미만). message로 구분할 수 없으므로 화면은 공통 빈 상태로 처리한다.
   */
  liked: async (params: CoursePersonalParams): Promise<LikedCourse> => {
    const r = await request<{ title: string; stops: (ServerCourseStop & {
      avgSatisfaction: number | null;
      reasonPets: { petId: number; petName: string; score: number }[] | null;
    })[] | null }>('GET', `/api/v1/courses/liked?${personalQuery(params)}`, { auth: true });
    return {
      title: r.title,
      stops: (r.stops ?? []).map<LikedStop>((st) => ({
        ...toCourseStop(st),
        // 식사 스톱이면 서버가 더미값(0, [])을 준다 — 화면에서 만족도 문구를 붙이면 거짓이 된다
        avgSatisfaction: st.avgSatisfaction ?? 0,
        reasonPets: st.reasonPets ?? [],
      })),
    };
  },

  /**
   * 취향 비슷한 새곳 탐험. liked와 달리 **안 가본 곳**에서 고른다.
   *
   * ⚠️ 만족도 기록이 없으면 서버가 조용히 "인기 코스"로 갈아탄다(콜드스타트). 그때
   * `isPersonalized: false`가 오므로 **취향 기반인 척 안내하면 안 된다.**
   */
  similar: async (params: CoursePersonalParams): Promise<SimilarCourse> => {
    const r = await request<{ title: string; isPersonalized: boolean | null; stops: (ServerCourseStop & {
      matchedTags: string[] | null;
      matchedByKind: boolean | null;
      matchedByBreedSize: boolean | null;
      reason: string | null;
    })[] | null }>('GET', `/api/v1/courses/similar?${personalQuery(params)}`, { auth: true });
    return {
      title: r.title,
      // null이면 개인화가 아니라고 본다 — 근거 없이 "취향 기반"이라 말하는 쪽이 더 나쁘다
      isPersonalized: r.isPersonalized ?? false,
      stops: (r.stops ?? []).map<SimilarStop>((st) => ({
        ...toCourseStop(st),
        matchedTags: (st.matchedTags ?? []).filter(isReviewTag),
        matchedByKind: st.matchedByKind ?? false,
        matchedByBreedSize: st.matchedByBreedSize ?? false,
        // 문구 패턴은 서버가 관리한다. 프론트에서 재조합하지 말고 그대로 쓴다(명세 요구)
        reason: st.reason ?? '',
      })),
    };
  },

  /**
   * 스톱 순서만 최근접 이웃으로 다듬는다. **아무것도 저장하지 않는다** — 결과를 저장하려면
   * 반환된 순서를 코스 저장/수정 API에 다시 넣어야 한다.
   *
   * ⚠️ 명세는 "인증 불필요(순수 계산)"라고 적었지만 **실제로는 401이 온다**(2026-09-07 확인).
   * distance-options와 같은 불일치다. 토큰을 함께 보내는 건 무해하므로 auth를 붙인다.
   */
  optimizeOrder: async (stopIds: number[]): Promise<number[]> => {
    const r = await request<{ stopIds: number[] | null }>('POST', '/api/v1/courses/optimize-order', {
      body: { stopIds },
      auth: true,
    });
    // 서버가 순서를 못 주면 원래 순서를 그대로 쓴다 — 동선이 덜 다듬어질 뿐 코스는 유효하다
    return r.stopIds ?? stopIds;
  },

  preset: async (params: {
    sido: string;
    sigungu?: string;
    themes: string[];
    maxDistanceM?: string;
  }): Promise<PresetCourse> => {
    const q = new URLSearchParams();
    q.set('sido', params.sido);
    if (params.sigungu) q.set('sigungu', params.sigungu);
    params.themes.forEach((t) => q.append('themes', t));
    if (params.maxDistanceM) q.set('maxDistanceM', params.maxDistanceM);

    const r = await request<{ courseId: number | null; title: string; stops: ServerCourseStop[] | null }>(
      'GET',
      `/api/v1/courses/preset?${q.toString()}`,
    );
    return {
      courseId: r.courseId ?? null,
      title: r.title,
      stops: (r.stops ?? []).map(toCourseStop),
    };
  },
};

export const reviewsApi = {
  /** 시설 리뷰 목록 + 등급 집계. 등급/평균/태그는 페이지와 무관하게 시설 전체 기준. */
  list: async (facilityId: number, page = 0, size = 10): Promise<FacilityReviewData> => {
    const r = await request<ServerReviewList>(
      'GET',
      `/api/v1/facilities/${facilityId}/reviews?page=${page}&size=${size}`,
      { auth: true },
    );
    return {
      grade: toGrade(r.grade),
      categoryAverages: r.categoryAverages ?? { space: 0, staff: 0, amenity: 0 },
      topTags: (r.topTags ?? [])
        .filter((t) => isReviewTag(t.tag))
        .map((t) => ({ tag: t.tag as ReviewTag, count: t.count })),
      reviews: (r.reviews ?? []).map(toReview),
      pageInfo: r.pageInfo ?? { page, size, totalElements: 0, hasNext: false },
    };
  },
  /** 작성/수정(upsert). 자격 없으면 REVIEW4001, 남의 펫이면 PET4002 등으로 던진다. */
  create: (facilityId: number, body: NewReviewBody) =>
    request<ServerReview>('POST', `/api/v1/facilities/${facilityId}/reviews`, { body, auth: true }),
  /** 삭제(본인만, 소프트). */
  remove: (reviewId: number) =>
    request<{ reviewId: number }>('DELETE', `/api/v1/reviews/${reviewId}`, { auth: true }),
  /** 신고 — reason: FALSE_INFO|SPAM|ABUSE|PRIVACY|IRRELEVANT. */
  report: (reviewId: number, reason: string) =>
    request<{ reviewId: number }>('POST', `/api/v1/reviews/${reviewId}/report`, {
      body: { reason },
      auth: true,
    }),
};

// ─────────────────────────── 개인 만족도(satisfaction) ───────────────────────────
// 사업자 리뷰와 분리된 본인 전용 값(0.0~10.0). 반려동물+시설 조합당 1건(upsert).
// GET  /facilities/{fid}/pets/satisfactions  — 이 시설에 대한 내 반려동물 전체(기록 전 포함)
// GET  /pets/satisfactions                   — 반려동물별 좋아한 곳 TOP3 (홈)
// POST /facilities/{fid}/pets/{petId}/satisfaction  — 기록/수정(upsert)
export type FacilitySatisfaction = { petId: number; petName: string; score: number | null; recorded: boolean };
export type PetTopPlaces = {
  petId: number;
  topFacilities: { facilityId: number; name: string; category: Category; score: number }[];
};

type ServerTopPet = {
  petId: number;
  petName: string;
  topFacilities: { facilityId: number; facilityName: string; category: string; score: number }[];
};

export const satisfactionApi = {
  /** 이 시설에 대한 내 반려동물 전체 만족도(기록 전이면 score:null, recorded:false). */
  ofFacility: async (facilityId: number): Promise<FacilitySatisfaction[]> => {
    const r = await request<{ items: FacilitySatisfaction[] }>(
      'GET',
      `/api/v1/facilities/${facilityId}/pets/satisfactions`,
      { auth: true },
    );
    return r.items ?? [];
  },
  /** 반려동물별 좋아한 곳 TOP3 (홈). category는 앱 6종으로 매핑해 돌려준다. */
  topPlaces: async (): Promise<PetTopPlaces[]> => {
    const r = await request<{ pets: ServerTopPet[] }>('GET', '/api/v1/pets/satisfactions', { auth: true });
    return (r.pets ?? []).map((pet) => ({
      petId: pet.petId,
      topFacilities: (pet.topFacilities ?? []).map((f) => ({
        facilityId: f.facilityId,
        name: f.facilityName,
        category: CATEGORY_FROM_SERVER[f.category] ?? 'TOUR',
        score: f.score,
      })),
    }));
  },
  /** 기록/수정(upsert). score 0.0~10.0. */
  set: (facilityId: number, petId: number, score: number) =>
    request<{ petId: number; facilityId: number; score: number }>(
      'POST',
      `/api/v1/facilities/${facilityId}/pets/${petId}/satisfaction`,
      { body: { score }, auth: true },
    ),
};
