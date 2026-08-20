import type { Pet } from '@/data/types';

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

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

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
      throw new ApiError('사진 용량이 너무 커요. 10MB 이하로 올려주세요.', 'PAYLOAD_TOO_LARGE', 413);
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
