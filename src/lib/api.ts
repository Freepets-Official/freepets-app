import type {
  Category,
  Facility,
  FacilityReviewData,
  PawGrade,
  Pet,
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
const KNOWN_REQS: Requirement[] = ['LEASH', 'CAGE', 'MUZZLE', 'VACCINATION', 'SMALL_ONLY', 'OUTDOOR_ONLY'];

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

/** 상세 API가 채울 수 있는 필드만. 나머지(maxWeight 등)는 검색 값을 유지해야 하므로 타입으로 못 박는다. */
export type FacilityDetail = Pick<
  Facility,
  | 'facilityId'
  | 'name'
  | 'category'
  | 'address'
  | 'phone'
  | 'distanceM'
  | 'latitude'
  | 'longitude'
  | 'petAllowed'
  | 'petConditionRaw'
  | 'confidence'
  | 'confidenceSource'
  | 'confirmedAt'
>;

function toFacilityDetail(s: ServerFacilityDetail): FacilityDetail {
  // confirmedAt이 있으면 서버가 동반 조건을 확정한 것이다. 다만 확정 주체(사업자/사용자)는
  // 응답에 없어 SERVER로 둔다 — 없는 근거를 지어내면 사용자가 잘못 신뢰한다.
  const confirmed = s.confirmedAt !== null;
  return {
    facilityId: s.facilityId,
    name: s.name,
    category: CATEGORY_FROM_SERVER[s.category] ?? 'TOUR',
    address: s.address ?? '',
    phone: s.phone,
    // 좌표를 안 보냈거나 시설에 좌표가 없으면 null. 거리 표시가 0km로 보이지 않게 호출부에서 병합한다.
    distanceM: s.distanceM ?? 0,
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
};

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
