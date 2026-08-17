import { API_URL } from './config';

/**
 * 백엔드 API 클라이언트.
 * 서버 응답 봉투: { isSuccess, code, message, result }.
 * 성공이면 result만 돌려주고, 실패·네트워크 오류는 ApiError로 던진다.
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
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // 네트워크 실패(연결 불가·CORS·mixed content 등)
    throw new ApiError('서버에 연결할 수 없어요. 네트워크를 확인해주세요.');
  }
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!json || typeof json.isSuccess !== 'boolean') {
    throw new ApiError(`서버 응답 오류 (${res.status})`);
  }
  if (!json.isSuccess) {
    throw new ApiError(json.message || '요청에 실패했어요.', json.code);
  }
  return json.result;
}

export const authApi = {
  /** 이메일 회원가입 — 성공 시 계정 생성(토큰은 로그인에서 발급). nickname 2~20자, password 8~64자. */
  signup: (email: string, password: string, nickname: string) =>
    post<Record<string, never>>('/api/v1/users/signup', { email, password, nickname }),
  /** 이메일 로그인 — 액세스·리프레시 토큰 반환. */
  login: (email: string, password: string) =>
    post<LoginResult>('/api/v1/users/login', { email, password }),
};
