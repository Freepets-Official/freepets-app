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
  PublicCourse,
  SavedCourse,
  SimilarCourse,
  SimilarStop,
  Region,
  CalendarEvent,
  CalEventType,
  CalRepeat,
  Confidence,
  ConfidenceSource,
  Requirement,
  Review,
  ReviewPetInfo,
  ReviewTag,
  OwnerIntroductionView,
  OwnerAmenity,
  VisitBenefit,
} from '@/data/types';
import { OWNER_AMENITY_LABEL, REVIEW_TAG_LABEL } from '@/data/types';
import type { Gamification, TierAnimal, TierColor } from '@/data/level';
import { MAX_LEVEL, TIER_ANIMAL_LABEL, TIER_COLOR_LABEL } from '@/data/level';

import { API_URL, DEV_TOKEN } from './config';

export type { OwnerAmenity } from '@/data/types';

/**
 * 백엔드 API 클라이언트.
 * 서버 응답 봉투: { isSuccess, code, message, result }.
 * 성공이면 result만 돌려주고, 실패·네트워크 오류는 ApiError로 던진다.
 *
 * 계약의 단일 소스는 라이브 Swagger: https://3.35.195.228.nip.io/swagger-ui/index.html
 */
export type ApiEnvelope<T> = {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T;
};

export type LoginResult = { accessToken: string; refreshToken: string; userId?: number | string };

export class ApiError extends Error {
  code?: string;
  status?: number;
  /**
   * 실패 응답의 `result`. 대부분 비어 있지만 일부 오류가 후속 화면에 필요한 데이터를 싣는다 —
   * `BUSINESS4010`(근처에 비슷한 이름의 시설)이 중복 후보 목록을 여기로 준다.
   */
  result?: unknown;
  constructor(message: string, code?: string, status?: number, result?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.result = result;
  }
}

// ─────────────────────────── 인증 토큰 ───────────────────────────
// 로그인 성공 시 store가 setAuthToken으로 넣어준다. api.ts는 React에 의존하지 않도록
// 모듈 변수로 들고 있다가 보호 API 호출 시 헤더에 붙인다.
let authToken: string | null = null;
/**
 * 인증이 필요한 요청이 401을 받았을 때 불린다. store가 세션을 정리하도록 등록한다.
 *
 * 서버에 **토큰 재발급 엔드포인트가 없다**(2026-09-12 라이브 Swagger 46개 확인).
 * 그래서 액세스 토큰이 만료되면 되살릴 방법이 없는데, 앱은 401을 그냥 오류로만
 * 흘려보내 로그인 상태를 유지했다. 화면은 들어가지는데 무엇을 눌러도 서버가 준
 * "만료된 토큰입니다"가 뜨고, 사용자는 빠져나갈 길이 없었다.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

/**
 * 리프레시 토큰. 액세스 토큰이 만료되면 이걸로 재발급받는다.
 * store가 로그인·세션 복원 때 넣어준다.
 */
let refreshToken: string | null = null;
export function setRefreshToken(token: string | null) {
  refreshToken = token;
}

/**
 * 세션 세대. 로그인·로그아웃·만료 때마다 store가 올린다.
 *
 * 재발급은 비동기라, 응답이 돌아왔을 때는 이미 다른 세션일 수 있다. A로 쓰다 로그아웃한
 * 뒤 A의 재발급 응답이 도착하면 지워둔 세션이 되살아나고, B로 로그인한 뒤 도착하면
 * B 화면에서 A 토큰으로 요청하게 된다. 시작할 때의 세대와 끝났을 때의 세대가 다르면
 * 그 응답은 버린다.
 */
let sessionEpoch = 0;
export function bumpSessionEpoch(): number {
  sessionEpoch += 1;
  return sessionEpoch;
}
/**
 * 지금 세대. `request()` 밖에서 시간이 걸리는 준비(사진을 Blob으로 읽기 등)를 하는 호출자가
 * **준비를 시작하기 전에** 잡아 `epoch` 옵션으로 넘긴다. 안 그러면 준비하는 동안 계정이
 * 바뀌어도 요청은 새 계정의 토큰을 정상값으로 잡고 나간다 — A의 입력이 B 계정에 들어간다.
 */
export function getSessionEpoch(): number {
  return sessionEpoch;
}

/** 재발급에 성공하면 새 토큰 쌍을 store에 넘겨 기기에도 남기게 한다. */
let onTokensRefreshed:
  | ((t: { accessToken: string; refreshToken: string; userId?: number | string }) => void)
  | null = null;
export function setTokensRefreshedHandler(
  fn: ((t: { accessToken: string; refreshToken: string; userId?: number | string }) => void) | null,
) {
  onTokensRefreshed = fn;
}

/**
 * 진행 중인 재발급. 여러 요청이 동시에 401을 받아도 재발급은 한 번만 돈다.
 *
 * 서버가 리프레시 토큰도 새로 주는 **회전** 방식이라, 같은 토큰으로 두 번 부르면
 * 두 번째는 이미 폐기된 토큰을 쓰게 되어 실패하고 멀쩡한 세션이 끊긴다.
 */
let refreshInFlight: { epoch: number; promise: Promise<RefreshOutcome> } | null = null;

/**
 * 재발급 결과.
 * - `ok`     새 토큰을 받았다
 * - `expired` 리프레시 토큰이 죽었다(401·403). 되살릴 방법이 없으니 로그아웃한다
 * - `failed`  일시 장애(타임아웃·네트워크·5xx). **세션을 지우면 안 된다**
 * - `stale`   응답이 오는 사이 세션이 바뀌었다. 조용히 버린다
 */
type RefreshOutcome = 'ok' | 'expired' | 'failed' | 'stale';

/**
 * 되살릴 수 없는 인증 오류. 서버가 전부 401로 주므로 코드로 가른다.
 *
 * `MEMBER4007`은 **탈퇴한 계정**이다. 이 서버는 탈퇴·로그아웃 때 서버 쪽 토큰 무효화를
 * 하지 않아서(JWT 순수 검증, 블랙리스트 없음), 탈퇴 뒤에도 자연 만료 전까지 옛 토큰이
 * 살아 있다. 그 토큰으로 다른 API를 부르면 매 요청 이 코드가 온다 — 재발급으로는 절대
 * 풀리지 않으므로 만료와 똑같이 세션을 정리해야 한다.
 * `MEMBER4005`(토큰의 유저 없음)도 같다.
 */
const TOKEN_DEAD_CODES = new Set([
  'TOKEN4001',
  'TOKEN4002',
  'TOKEN4003',
  'TOKEN4004',
  'MEMBER4005',
  'MEMBER4007',
]);

async function refreshTokens(): Promise<RefreshOutcome> {
  const token = refreshToken;
  if (!token) return 'expired';
  const epoch = sessionEpoch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // 재발급은 헤더로 보낸다(서버 스펙: RefreshToken 헤더). request()를 타지 않는다 —
    // 401 처리를 타면 재발급이 재발급을 부르는 고리가 생긴다.
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { RefreshToken: token },
      signal: ctrl.signal,
    });
    // 세션이 바뀐 뒤 도착한 응답은 남의 것이다. 전역 토큰을 건드리지 않고 버린다.
    if (epoch !== sessionEpoch) return 'stale';
    const json = (await res.json().catch(() => null)) as ApiEnvelope<{
      accessToken: string;
      refreshToken: string;
      userId?: number | string;
    }> | null;
    /**
     * 서버는 토큰 오류를 전부 401로 주고 코드로 갈라 준다.
     *   TOKEN4001 유효하지 않은 토큰 / TOKEN4002 만료된 토큰
     *   TOKEN4003 토큰 용도 불일치  / TOKEN4004 리프레시 토큰 만료
     * 넷 다 리프레시 토큰 자체가 죽었다는 뜻이라 되살릴 방법이 없다 — 로그아웃한다.
     */
    if (json?.code && TOKEN_DEAD_CODES.has(json.code)) return 'expired';
    if (res.status === 401 || res.status === 403 || res.status === 400) return 'expired';
    if (!res.ok || !json?.isSuccess || !json.result?.accessToken) {
      // 5xx·형식 불량은 서버가 흔들린 것이다. 세션을 지우지 않는다.
      return 'failed';
    }
    if (epoch !== sessionEpoch) return 'stale';
    authToken = json.result.accessToken;
    refreshToken = json.result.refreshToken ?? refreshToken;
    onTokensRefreshed?.({ accessToken: authToken, refreshToken, userId: json.result.userId });
    return 'ok';
  } catch {
    // 타임아웃·네트워크 단절. 리프레시 토큰은 멀쩡하므로 세션을 지우지 않는다.
    return epoch === sessionEpoch ? 'failed' : 'stale';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 같은 세대 안에서만 재발급을 공유한다.
 *
 * 세대를 구분하지 않으면, A 재발급이 도는 중에 B로 로그인한 요청까지 A의 프로미스에
 * 합류한다. A 결과가 `stale`이면 B는 자기 토큰으로 재발급을 시도조차 못 하고 실패한다.
 */
function refreshOnce(epoch: number): Promise<RefreshOutcome> {
  if (!refreshInFlight || refreshInFlight.epoch !== epoch) {
    const promise = refreshTokens().finally(() => {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    });
    refreshInFlight = { epoch, promise };
  }
  return refreshInFlight.promise;
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
/**
 * 요청 제한 시간.
 *
 * 없으면 서버가 연결만 받고 응답을 안 줄 때(nginx는 살아 있는데 뒤의 Spring이 멈춘 경우)
 * fetch가 영원히 매달린다. 화면은 스피너를 계속 돌리고 사용자는 실패한 줄도 모른다.
 * 실제로 코스 화면의 「아이 취향으로 코스를 찾는 중…」이 그렇게 끝나지 않았다.
 *
 * 사진을 올리는 요청은 오래 걸릴 수 있어 넉넉히 잡는다.
 */
const TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

type RequestOpts = {
  body?: unknown;
  auth?: boolean;
  /** 호출자가 미리 잡아둔 세대. 요청을 보내기 전에 이미 바뀌었으면 보내지 않는다 */
  epoch?: number;
  /**
   * 이 요청에만 쓸 토큰. 로그아웃 **뒤에** 그 계정의 것을 정리해야 할 때(늦게 성공한 푸시
   * 등록의 해제) 쓴다 — 현재 토큰은 이미 없거나 다른 계정의 것이다. 세대 검사는 하지 않는다.
   */
  token?: string;
};

async function request<T>(method: Method, path: string, opts: RequestOpts = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {};
    if (opts.body !== undefined && !isForm) h['Content-Type'] = 'application/json';
    if (opts.auth) {
      const token = opts.token ?? currentToken();
      if (token) h.Authorization = `Bearer ${token}`;
    }
    return h;
  };
  /**
   * 제한 시간은 **응답 본문까지** 건다.
   *
   * 예전에는 `fetch`가 헤더를 돌려주는 순간 타이머를 껐다. 헤더만 오고 본문 전송이 멈추면
   * `res.json()`이 무제한으로 기다려, 15초를 걸어둔 의미가 없었다. 타이머는 아래
   * try/finally에서 본문을 다 읽은 뒤에 끈다.
   */
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), isForm ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);

  const sendOnce = async (): Promise<Response> => {
    try {
      return await fetch(`${API_URL}${path}`, {
        method,
        // 재시도는 **새 토큰**으로 가야 하므로 헤더를 매번 다시 만든다
        headers: buildHeaders(),
        body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
        signal: ctrl.signal,
      });
    } catch (e) {
      // 제한 시간 초과와 연결 실패를 나눠 안내한다. 원인이 다르면 사용자가 할 일도 다르다 —
      // 전자는 기다렸다 다시, 후자는 네트워크 확인이다.
      if (e instanceof Error && e.name === 'AbortError') {
        throw new ApiError('서버 응답이 너무 늦어요. 잠시 후 다시 시도해 주세요.', 'TIMEOUT');
      }
      throw new ApiError('서버에 연결할 수 없어요. 네트워크를 확인해주세요.');
    }
  };

  /**
   * 요청이 **출발한 시점**의 세대. 예전에는 첫 401을 받은 뒤에야 잡아서, A 요청이 나간
   * 뒤 B로 로그인하면 뒤늦은 A의 401이 B 토큰으로 재발급·재전송을 일으켰다.
   * 성공 응답도 세대를 안 봐서 옛 세션의 결과가 새 화면에 반영될 수 있었다.
   */
  /**
   * 애초에 토큰이 있었는가. 없었다면 그 401은 "세션 만료"가 아니라 "아직 로그인 전"이다.
   */
  const hadToken = !opts.auth || (opts.token ?? currentToken()) != null;

  /**
   * 세대 검사를 하는 요청인가. 토큰을 명시한 요청은 "그 세션의 뒤처리"라 세대가 바뀐 뒤에
   * 보내는 것이 목적이다 — 검사하면 영영 못 보낸다.
   */
  const guarded = !!opts.auth && opts.token === undefined;
  const startEpoch = opts.epoch ?? sessionEpoch;
  if (guarded && startEpoch !== sessionEpoch) {
    // 준비하는 동안 계정이 바뀌었다. A의 입력을 B로 보내지 않는다
    throw new ApiError('세션이 바뀌었어요.', 'SESSION_CHANGED', 401);
  }
  // 타이머는 본문을 다 읽은 뒤에 끈다. 예외로 빠져나가는 경로에서도 반드시 꺼야 해서
  // 여기부터 함수 끝까지 try/finally로 감싼다.
  try {
    let res = await sendOnce();
    if (guarded && startEpoch !== sessionEpoch) {
      throw new ApiError('세션이 바뀌었어요.', 'SESSION_CHANGED', 401);
    }

    /**
     * 인증이 필요한 요청의 401 = 액세스 토큰 만료.
     *
     * 재발급을 한 번 시도하고 같은 요청을 다시 보낸다. 재발급까지 실패하면 되살릴 방법이
     * 없으므로 세션을 정리하고 로그인 화면으로 보낸다. 로그인·가입(auth:false)의 401은
     * 자격 증명이 틀린 것이라 건드리지 않는다.
     *
     * 재시도는 한 번만 한다 — 새 토큰으로도 401이면 토큰 문제가 아니다.
     */
    if (guarded && res.status === 401) {
      /**
       * 토큰이 없었으면 재발급도, 만료 처리도 의미가 없다.
       *
       * 끊을 세션이 없는데 로그아웃이 돌면, 앱이 뜨자마자 나가는 조회 하나가
       * 저장된 세션을 지우고 복원까지 무효화한다. 그냥 오류로만 돌려준다.
       */
      if (!hadToken) {
        throw new ApiError('로그인이 필요해요.', 'NO_SESSION', 401);
      }

      /**
       * 재발급으로 풀리지 않는 401이 있다.
       *
       * 탈퇴한 계정(MEMBER4007)·없는 유저(MEMBER4005)는 토큰을 새로 받아도 같은 답이 온다.
       * 굳이 재발급을 한 번 돌고 실패하느니 바로 세션을 정리한다.
       */
      const deadBody = (await res
        .clone()
        .json()
        .catch(() => null)) as { code?: string } | null;
      const outcome =
        deadBody?.code && TOKEN_DEAD_CODES.has(deadBody.code)
          ? ('expired' as const)
          : await refreshOnce(startEpoch);

      // 기다리는 사이 로그아웃·재로그인이 있었다면 이 응답은 남의 세션 것이다.
      // 성공으로도 실패로도 취급하지 않고, 화면이 조용히 넘어가게 둔다.
      if (startEpoch !== sessionEpoch || outcome === 'stale') {
        throw new ApiError('세션이 바뀌었어요.', 'SESSION_CHANGED', 401);
      }

      if (outcome === 'ok') {
        res = await sendOnce();
        // 재시도가 나갔다 오는 사이에도 세션이 바뀔 수 있다. 그 401로 새 세션을 끊으면 안 된다.
        if (startEpoch !== sessionEpoch) {
          throw new ApiError('세션이 바뀌었어요.', 'SESSION_CHANGED', 401);
        }
        if (res.status === 401) {
          // 새 토큰으로도 401이면 토큰 문제가 아니다. 더 시도하지 않는다.
          onUnauthorized?.();
          throw new ApiError('로그인이 만료됐어요. 다시 로그인해 주세요.', 'UNAUTHORIZED', 401);
        }
      } else if (outcome === 'expired') {
        onUnauthorized?.();
        throw new ApiError('로그인이 만료됐어요. 다시 로그인해 주세요.', 'UNAUTHORIZED', 401);
      } else {
        /**
         * 일시 장애 — 세션을 지우지 않는다.
         *
         * 리프레시 토큰은 멀쩡한데 서버가 잠깐 흔들린 것뿐이다. 여기서 로그아웃시키면
         * 502 한 번에 모든 사용자가 튕긴다. 이 서버는 실제로 502를 낸 적이 있다.
         */
        throw new ApiError('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.', 'TIMEOUT');
      }
    }

    const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
    /**
     * 본문을 읽는 동안에도 세션이 바뀔 수 있다 — 헤더는 A 세션에서 받고, `res.json()`을
     * 기다리는 사이 로그아웃·B 로그인, 그 뒤 A 본문 도착. 출발 시점 검사만으로는 이 경로가
     * 열려 있어 A의 성공 응답이 B 화면에 그대로 반환됐다. **모든 반환 경로가 세대를 본다.**
     */
    if (guarded && startEpoch !== sessionEpoch) {
      throw new ApiError('세션이 바뀌었어요.', 'SESSION_CHANGED', 401);
    }
    if (!json || typeof json.isSuccess !== 'boolean') {
      // 업로드 용량 초과는 nginx가 앱 envelope가 아닌 413(HTML)로 막는다 → 친화 메시지로 변환
      if (res.status === 413) {
        throw new ApiError('사진 용량이 너무 커요. 20MB 이하로 올려주세요.', 'PAYLOAD_TOO_LARGE', 413);
      }
      throw new ApiError(`서버 응답 오류 (${res.status})`, undefined, res.status);
    }
    if (!json.isSuccess) {
      throw new ApiError(json.message || '요청에 실패했어요.', json.code, res.status, json.result);
    }
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

export const authApi = {
  /** 이메일 회원가입 — 성공 시 계정 생성(토큰은 로그인에서 발급). nickname 2~20자, password 8~64자. */
  signup: (email: string, password: string, nickname: string) =>
    request<Record<string, never>>('POST', '/api/v1/users/signup', { body: { email, password, nickname } }),
  /** 이메일 로그인 — 액세스·리프레시 토큰 반환. */
  login: (email: string, password: string) =>
    request<LoginResult>('POST', '/api/v1/users/login', { body: { email, password } }),

  /**
   * 소셜 로그인. 계정이 없으면 **그 자리에서 자동 가입**한다(별도 가입 API가 없다).
   * 인증 불필요 — 아직 우리 토큰이 없는 상태로 들어오는 경로다.
   *
   * `providerToken`은 제공자마다 종류가 다르다:
   *   카카오·네이버 → **access token**   /   구글·애플 → **id_token**
   *
   * `name`은 **애플 최초 로그인에서만** 보낸다. 애플은 이름을 id_token에 담지 않고 최초
   * 인가 응답에서 단 한 번만 주므로, 그때 못 받으면 서버가 나중에 물어볼 방법이 없다.
   */
  social: (
    provider: SocialProvider,
    providerToken: string,
    name?: string,
    /**
     * 애플 전용. 서버가 **탈퇴 시 애플 토큰을 폐기**하는 데 쓴다(Apple 5.1.1(v) 요구사항).
     *
     * 5분 만료·1회용이라 탈퇴 시점에는 받을 수 없다 — 그때 받으려면 재로그인을 시켜야 한다.
     * 그래서 로그인할 때 함께 보내 서버가 보관한다. 값이 없으면 필드를 아예 빼서 보낸다.
     */
    authorizationCode?: string,
  ) =>
    request<SocialLoginResult>('POST', `/api/v1/auth/social/${provider}`, {
      body: {
        providerToken,
        ...(name ? { name } : {}),
        ...(authorizationCode ? { authorizationCode } : {}),
      },
    }),
};

export type SocialProvider = 'kakao' | 'naver' | 'google' | 'apple';

export type SocialLoginResult = LoginResult & {
  /** 이번 요청으로 계정이 새로 만들어졌으면 true. 온보딩으로 보낼지 판단하는 값 */
  isNewUser: boolean;
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
  create: async (input: Omit<Pet, 'petId'>) => {
    // 사진을 읽는 동안 계정이 바뀌면 이 입력은 그 계정의 것이 아니다 — 준비 전에 세대를 잡는다
    const epoch = getSessionEpoch();
    return request<{ petId: number }>('POST', '/api/v1/pets', { body: await toForm(input), auth: true, epoch });
  },
  /** 단건 조회. */
  get: async (petId: number): Promise<Pet> => toPet(await request<ServerPet>('GET', `/api/v1/pets/${petId}`, { auth: true })),
  /** 수정(전체 필드, multipart PUT). */
  update: async (petId: number, input: Omit<Pet, 'petId'>): Promise<Pet> => {
    const epoch = getSessionEpoch();
    return toPet(await request<ServerPet>('PUT', `/api/v1/pets/${petId}`, { body: await toForm(input), auth: true, epoch }));
  },
  /** 삭제. */
  remove: (petId: number) => request<{ petId: number }>('DELETE', `/api/v1/pets/${petId}`, { auth: true }),
};

// ─────────────────────────── 마이페이지(account) ───────────────────────────
// GET  /users/account → { nickname, avatarUri }
// PATCH /users/account (multipart) → nickname(필수) + avatar(선택 파일). 이메일은 응답에 없음.
/**
 * `userId`는 **아직 서버가 주지 않는다.** 백엔드가 넣기로 했고, 오면 그대로 쓰인다.
 * 선택 필드로 받아두면 서버만 배포해도 이미 나간 앱이 값을 집는다 — 앱을 다시 낼 필요가 없다.
 */
type ServerAccount = {
  nickname: string;
  avatarUri: string | null;
  userId?: number | string;
  /** 계정에 붙은 프로필. 매장을 하나라도 확정하면 'owner'가 생긴다 */
  profiles?: string[];
  /** 이 계정이 사업자 확인으로 확정한 시설 — 대시보드의 「내 매장」 목록 */
  ownedFacilityIds?: number[];
};

export const accountApi = {
  /** 내 회원정보 조회. */
  get: () => request<ServerAccount>('GET', '/api/v1/users/account', { auth: true }),
  /**
   * 회원정보 수정(multipart PATCH). nickname은 매번 필수.
   * photoUri가 새로 고른 로컬 이미지면 avatar 파일로 첨부, http URL·null이면 미첨부(기존 유지).
   */
  /**
   * 회원 탈퇴. **비밀번호는 선택이다** — 소셜로 가입하면 비밀번호가 없다
   * (`password_hash = NULL`). 이메일 가입자만 확인이 필요하므로 서버가 판단한다.
   *
   * Apple 심사 가이드라인 5.1.1(v)가 요구하는 필수 기능이다. 계정 생성을 지원하는 앱은
   * 앱 안에서 삭제도 제공해야 하고, 실제로 삭제돼야 한다.
   */
  remove: (password?: string) =>
    request<Record<string, never>>('DELETE', '/api/v1/users/account', {
      body: password ? { password } : {},
      auth: true,
    }),

  update: async (nickname: string, photoUri: string | null): Promise<ServerAccount> => {
    const epoch = getSessionEpoch();
    const fd = new FormData();
    fd.append('nickname', nickname);
    if (photoUri && !/^https?:/.test(photoUri)) {
      const blob = await (await fetch(photoUri)).blob();
      fd.append('avatar', blob, 'avatar.jpg');
    }
    return request<ServerAccount>('PATCH', '/api/v1/users/account', { body: fd, auth: true, epoch });
  },
};

/**
 * 푸시 토큰 등록·해제(`/users/push-tokens`).
 *
 * 서버가 받는 건 **FCM 등록 토큰**이다. 발송은 Firebase Admin SDK가 하므로 APNs 토큰을
 * 보내면 그 기기에는 알림이 가지 않는다 — 등록 자체는 200으로 성공한다는 게 함정이다.
 *
 * 등록은 upsert다. 같은 토큰이 다른 유저로 저장돼 있었으면 그쪽에서 떼어내고 요청한
 * 유저에게 붙인다(기기 재설치·계정 전환 대응). 그래서 로그인할 때마다 불러도 된다.
 */
export const pushApi = {
  /**
   * `withToken`은 등록을 예약한 세션의 액세스 토큰. 등록·해제는 세대 검사 대신 **예약한
   * 세션의 토큰으로 끝까지 간다** — 등록이 늦게 성공하면 같은 토큰으로 바로 되돌린다.
   */
  register: (token: string, platform: 'IOS' | 'ANDROID', withToken?: string) =>
    request<Record<string, never>>('POST', '/api/v1/users/push-tokens', {
      body: { token, platform },
      auth: true,
      token: withToken,
    }),

  /** 로그아웃·앱 삭제 시. 없는 토큰이어도 서버가 조용히 넘어간다(200). */
  unregister: (token: string, withToken?: string) =>
    request<Record<string, never>>(
      'DELETE',
      `/api/v1/users/push-tokens?token=${encodeURIComponent(token)}`,
      { auth: true, token: withToken },
    ),
};

/**
 * 시설 조건 확인 요청(`/facilities/{id}/condition-inquiries`).
 *
 * "이 시설 조건이 불명확하다"를 모은다. 사업자가 조건을 갱신할 근거가 되고, 사용자에게는
 * 전화 말고도 물어볼 길이 하나 더 생긴다.
 */
export const inquiryApi = {
  /** 요청을 보낸다. `memo`는 선택 — 무엇이 불명확한지 적을 수 있다. */
  create: (facilityId: number, memo?: string) =>
    request<Record<string, never>>('POST', `/api/v1/facilities/${facilityId}/condition-inquiries`, {
      body: memo ? { memo } : {},
      auth: true,
    }),

  /** 이 시설에 쌓인 요청 수. 사업자에게 "몇 명이 궁금해하는지"를 보여주는 값이다. */
  count: async (facilityId: number): Promise<number> => {
    const r = await request<{ count: number | null }>(
      'GET',
      `/api/v1/facilities/${facilityId}/condition-inquiries/count`,
      { auth: true },
    );
    return r.count ?? 0;
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
  maxWeightInclusive?: boolean | null;
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
    maxWeightInclusive: s.maxWeightInclusive ?? null,
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
// 검색에만 있는 것: requirements(상세 응답엔 아직 없음) → 스토어에서 병합한다.
// `maxWeight`는 2026-09-17 배포부터 **상세에도 온다** — 검색을 안 거친 경로(홈 TOP3·딥링크·
// 알림)에서 체중 제한이 비어 판별이 통과로 뒤집히던 문제가 이걸로 해소된다.
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
  /** 2026-09-17 배포부터 상세에도 포함. 옛 서버면 키가 없다(그때는 검색 값을 유지한다) */
  maxWeight?: number | null;
  confirmedAt: string | null;
  /** 서버가 실제로 내려준다(2026-09-12 명세). 사업자 확정·거부 제보 하향이 여기 실린다 */
  confidence?: string | null;
  confidenceSource?: string | null;
  maxWeightInclusive?: boolean | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  /**
   * 사장님 소개·방문 혜택(백엔드 PR #117). 이름이 사업자 API와 다르다 — 저장은
   * `PUT /owner/facilities/{id}/profile`인데 손님 응답 키는 `ownerIntroduction`이다.
   * `visitBenefits`는 켜 둔 것만·등록순이고 `benefitId`가 없다(읽기 전용이라 서버가 뺐다).
   */
  ownerIntroduction?: { introduction?: string | null; amenityTags?: string[] | null } | null;
  visitBenefits?: { title?: string | null; description?: string | null }[] | null;
};

/** 서버가 모르는 태그 값을 보내도 라벨 조회에서 터지지 않게 아는 값만 남긴다 */
export function toOwnerAmenities(tags: (string | null | undefined)[] | null | undefined): OwnerAmenity[] {
  return (tags ?? []).filter((t): t is OwnerAmenity => typeof t === 'string' && t in OWNER_AMENITY_LABEL);
}

function toOwnerIntroduction(p: NonNullable<ServerFacilityDetail['ownerIntroduction']> | null): OwnerIntroductionView | null {
  if (p === null) return null; // 명시된 '소개 없음'은 그대로 둔다(사장님이 지운 경우)
  return { introduction: p.introduction ?? null, amenityTags: toOwnerAmenities(p.amenityTags) };
}

function toVisitBenefits(b: NonNullable<ServerFacilityDetail['visitBenefits']>): VisitBenefit[] {
  // 제목이 없는 항목은 버린다 — 빈 줄만 그려지면 손님은 혜택이 깨진 것으로 읽는다
  return b
    .filter((x): x is { title: string; description?: string | null } => typeof x?.title === 'string' && x.title.length > 0)
    .map((x) => ({ title: x.title, description: x.description ?? null }));
}

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
> & {
  distanceM: number | null;
  address: string | null;
  maxWeight?: number | null;
  maxWeightInclusive?: boolean | null;
  ownerIntroduction?: OwnerIntroductionView | null;
  visitBenefits?: VisitBenefit[];
};

const CONFIDENCES = new Set<string>(['CONFIRMED', 'LIKELY', 'ESTIMATED', 'UNVERIFIED']);
const CONFIDENCE_SOURCES = new Set<string>(['OWNER', 'CROWD', 'PARSED', 'USER_CALL', 'DENIAL_REPORT', 'NONE', 'SERVER']);

function toFacilityDetail(s: ServerFacilityDetail): FacilityDetail {
  /**
   * 신뢰도는 **서버 값을 그대로** 쓴다. 예전에는 confirmedAt 유무로 지어냈는데, 사업자가
   * 확정한 뒤 거부 제보가 들어와 서버가 UNVERIFIED/DENIAL_REPORT를 줘도 앱은 "확정"을 그렸다.
   * 옛 서버가 두 필드를 안 주는 경우에만 confirmedAt으로 추정한다.
   */
  const confirmed = s.confirmedAt !== null;
  const confidence = s.confidence && CONFIDENCES.has(s.confidence) ? (s.confidence as Confidence) : null;
  const source =
    s.confidenceSource && CONFIDENCE_SOURCES.has(s.confidenceSource) ? (s.confidenceSource as ConfidenceSource) : null;
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
    confidence: confidence ?? (confirmed ? 'CONFIRMED' : 'ESTIMATED'),
    confidenceSource: source ?? (confirmed ? 'SERVER' : 'PARSED'),
    confirmedAt: s.confirmedAt,
    // 아래 선택 필드는 서버가 생략하면 **키를 만들지 않는다**. 스토어가 `...detail`로 병합하므로
    // undefined/null 키가 있으면 검색으로 알던 값(체중 제한·'이하/미만' 등)이 지워진다.
    ...(s.maxWeight !== undefined ? { maxWeight: s.maxWeight } : {}),
    ...(s.maxWeightInclusive !== undefined ? { maxWeightInclusive: s.maxWeightInclusive } : {}),
    ...(s.ownerIntroduction !== undefined ? { ownerIntroduction: toOwnerIntroduction(s.ownerIntroduction) } : {}),
    ...(s.visitBenefits != null ? { visitBenefits: toVisitBenefits(s.visitBenefits) } : {}),
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
  /** 사진을 첨부한 리뷰에만 온다(`@JsonInclude(NON_NULL)`) */
  photoUrl?: string | null;
  helpfulCount?: number;
  helpfulByMe?: boolean;
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
    photoUrl: s.photoUrl ?? null,
    reportedByMe: s.reportedByMe ?? false,
    helpfulCount: typeof s.helpfulCount === 'number' ? s.helpfulCount : undefined,
    helpfulByMe: s.helpfulByMe,
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
  /**
   * 방문 인증샷(로컬 uri). 있으면 multipart로, 없으면 지금까지처럼 JSON으로 보낸다.
   * **수정에서 생략하면 서버가 기존 사진을 유지한다** — 사진만 지우는 API는 없다.
   */
  photoUri?: string | null;
};

/** 사진이 있으면 multipart(FormData), 없으면 JSON 본문. 서버는 둘 다 받는다(review.md) */
async function reviewPayload(body: NewReviewBody): Promise<FormData | Omit<NewReviewBody, 'photoUri'>> {
  const { photoUri, ...rest } = body;
  if (!photoUri) return rest;
  const fd = new FormData();
  for (const id of rest.petIds) fd.append('petIds', String(id));
  fd.append('showPetInfo', rest.showPetInfo ? 'true' : 'false');
  fd.append('ratingSpace', String(rest.ratingSpace));
  fd.append('ratingStaff', String(rest.ratingStaff));
  fd.append('ratingAmenity', String(rest.ratingAmenity));
  fd.append('content', rest.content);
  for (const t of rest.tags) fd.append('tags', t);
  if (rest.visitedAt) fd.append('visitedAt', rest.visitedAt);
  const blob = await (await fetch(photoUri)).blob();
  fd.append('photo', blob, 'review.jpg');
  return fd;
}

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
  verdicts:
    | {
        petId: number;
        result: CheckResult;
        reason: string;
        conditions: string[] | null;
        verifyCode?: string | null;
      }[]
    | null;
};

/**
 * 서버 시각을 절대 시각으로 고친다.
 *
 * 서버는 `2026-09-07T16:07:22.634035`처럼 **타임존을 빼고 UTC**를 준다. 그대로
 * `new Date()`에 넣으면 자바스크립트가 기기 시간대로 읽어서, 한국 기기에서 9시간
 * 어긋난다(실측: KST 01:07에 만든 판별이 16:07로 기록됨). 오프셋이 이미 붙어 있으면
 * 건드리지 않는다 — 서버가 나중에 제대로 내려줘도 그대로 동작한다.
 */
function toAbsoluteIso(raw: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw) ? raw : `${raw}Z`;
}

/** 이력 조회가 주는 만큼만 담은 판별 요약. 상세(verdicts·checklist·tips)는 서버에 없다 */
export type PetCheckSummary = {
  checkId: number;
  facilityId: number;
  petIds: number[];
  overall: CheckResult;
  createdAt: string;
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

    const stops = (r.stops ?? []).map((st) => ({
      facility: {
        facilityId: st.facility.facilityId,
        name: st.facility.name,
        category: CATEGORY_FROM_SERVER[st.facility.category] ?? 'TOUR',
      },
      time: st.time,
      verdicts: (st.verdicts ?? []).map((v) => ({ ...v, conditions: v.conditions ?? [] })),
      overall: st.overall,
      alternative: st.alternative,
    }));

    // 스톱이나 아이별 판별이 요청한 만큼 오지 않으면 이 응답은 신뢰할 수 없다. 그대로 그리면
    // **근거 없이 overall만 보고 '갈 수 있다'가 뜬다** — /ai/check와 같은 이유로 막는다.
    const wantStops = new Set(facilityIds);
    const gotStops = new Set(stops.map((st) => st.facility.facilityId));
    const stopsCovered =
      wantStops.size === gotStops.size && [...wantStops].every((id) => gotStops.has(id));
    const wantPets = new Set(petIds);
    const verdictsCovered = stops.every((st) => {
      const got = new Set(st.verdicts.map((v) => v.petId));
      return wantPets.size === got.size && [...wantPets].every((id) => got.has(id));
    });
    if (!stopsCovered || !verdictsCovered) {
      throw new ApiError('코스 판별 결과를 받지 못했어요. 잠시 후 다시 시도해 주세요.');
    }

    return { overall: r.overall, blockedCount: r.blockedCount ?? 0, stops };
  },

  /**
   * 저장된 판별 하나를 상세로 되받는다.
   *
   * 목록(GET /pet-checks)은 요약만 줘서 verdicts가 비어 있다. 그래서 앱을 다시 켠 뒤
   * 예전 판별의 출입증을 열면 그릴 게 없어 "한 번 더 판별하면 바로 만들어져요"가 떴다.
   * 이 API가 verifyCode까지 그대로 돌려주므로 재판별 없이 출입증을 다시 연다.
   *
   * 남의 checkId는 존재 여부도 알려주지 않고 PETCHECK4001(404)로 막힌다.
   */
  checkDetail: async (checkId: number): Promise<AiCheckResult> => {
    const r = await request<ServerAiCheck>('GET', `/api/v1/pet-checks/${checkId}`, { auth: true });
    return {
      checkId: r.checkId,
      facilityId: r.facilityId,
      overall: r.overall,
      verdicts: (r.verdicts ?? []).map((v) => ({
        petId: v.petId,
        result: v.result,
        reason: v.reason,
        conditions: v.conditions ?? [],
        verifyCode: v.verifyCode ?? undefined,
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
      // 출입증 QR이 이 코드로 열린다. 없으면 QR을 그리지 않는다(로컬 판별 등)
      verifyCode: v.verifyCode ?? undefined,
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

  /**
   * 내 판별 이력 — **요약만** 온다. 아이별 판별(`verdicts`)과 체크리스트·팁은 담기지 않고,
   * `checkId`로 상세를 되찾는 API도 없다(명세에 미구현으로 명시).
   *
   * 그래서 이 함수가 돌려주는 항목은 "언제 어느 시설을 어떤 아이들로 판별했고 결과가
   * 무엇이었나"까지다. 출입증처럼 아이별 근거가 필요한 화면은 이 이력만으로는 그릴 수 없다.
   *
   * `offset`은 서버 제약상 **`limit`의 배수**여야 한다(아니면 400).
   */
  history: async (
    opts: { facilityId?: number; limit?: number; offset?: number } = {},
  ): Promise<{ items: PetCheckSummary[]; total: number }> => {
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;
    // 서버 제약을 여기서 막는다. 어기면 400이 오는데, 그때는 이미 왕복을 한 뒤라
    // 화면엔 원인 없는 실패로만 보인다.
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ApiError('이력 조회 개수는 1~100 사이여야 해요.');
    }
    if (!Number.isInteger(offset) || offset < 0 || offset % limit !== 0) {
      throw new ApiError('이력 조회 위치가 올바르지 않아요.');
    }
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (opts.facilityId != null) q.set('facilityId', String(opts.facilityId));

    const r = await request<{
      items: {
        checkId: number;
        facilityId: number;
        petIds: number[] | null;
        overall: CheckResult;
        createdAt: string;
      }[] | null;
      total: number | null;
    }>('GET', `/api/v1/pet-checks?${q.toString()}`, { auth: true });

    const items = (r.items ?? []).map((it) => ({
      checkId: it.checkId,
      facilityId: it.facilityId,
      petIds: it.petIds ?? [],
      overall: it.overall,
      createdAt: toAbsoluteIso(it.createdAt),
    }));
    return { items, total: r.total ?? items.length };
  },
};

// ─────────────────────────── 거부 제보(denial-reports) ───────────────────────────
// 문 앞에서 거부당한 순간 사유 하나만 눌러 보내는 제보. 검토를 기다리지 않고 바로 반영된다.
// 신뢰도는 이 응답이 아니라 시설 상세의 confidence/confidenceSource로 확인한다 —
// 최근 1주 내 실시간 거부가 있으면 UNVERIFIED/DENIAL_REPORT로 계산된다.

export type DenialReasonCode = 'WEIGHT' | 'BREED' | 'INDOOR' | 'POLICY_CHANGED' | 'CROWDED' | 'OTHER';

/** 서버 제보 레코드. 앱 FacilityReport와 필드가 거의 같다. */
export type ServerDenialReport = {
  reportId: number;
  facilityId: number;
  type: 'DENIED' | 'ENTERED' | 'CONDITION_CHANGED';
  content: string;
  reason: DenialReasonCode | null;
  weight: number | null;
  hasEvidence: boolean | null;
  mine: boolean | null;
  realtime: boolean | null;
  status: 'PENDING' | 'APPLIED' | 'REJECTED';
  createdAt: string;
};

/** 내가 판별받은 시설 중 최근 1주 내 거부가 뜬 곳. */
export type DenialAlert = {
  facility: { facilityId: number; name: string };
  report: { reportId: number; reason: DenialReasonCode | null; createdAt: string };
};

export const denialApi = {
  /**
   * 원터치 제보. 같은 시설에 24시간 내 재제보하면 REPORT4001(409)이 온다 —
   * 장애가 아니라 "이미 보냈다"는 뜻이라 화면에서 구분해 안내해야 한다.
   */
  report: (facilityId: number, reason: DenialReasonCode) =>
    request<ServerDenialReport>('POST', `/api/v1/facilities/${facilityId}/denial-reports`, {
      body: { reason },
      auth: true,
    }),

  /** 최근 1주 내 **타인의** 제보 최신순 최대 3건. 경고 배너용. 없으면 빈 배열. */
  recent: async (facilityId: number): Promise<ServerDenialReport[]> => {
    const r = await request<ServerDenialReport[] | null>(
      'GET',
      `/api/v1/facilities/${facilityId}/denial-reports/recent`,
      { auth: true },
    );
    return r ?? [];
  },

  /**
   * 내가 이 시설에 보낸 제보. **보낸 적이 없으면 `result` 키 자체가 응답에서 빠진다**
   * (`@JsonInclude(NON_NULL)`) — null 비교가 아니라 존재 여부로 판단해야 한다.
   */
  mine: async (facilityId: number): Promise<ServerDenialReport | null> => {
    const r = await request<ServerDenialReport | undefined>(
      'GET',
      `/api/v1/facilities/${facilityId}/denial-reports/mine`,
      { auth: true },
    );
    return r ?? null;
  },

  /** 내가 판별받은 시설 중 최근 1주 내 거부가 뜬 곳. 홈 상단 경고용. 시설당 최신 1건. */
  alerts: async (): Promise<DenialAlert[]> => {
    const r = await request<DenialAlert[] | null>('GET', '/api/v1/me/denial-alerts', { auth: true });
    return r ?? [];
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

/** 서버가 보내는 모양. 필드별로 빠질 수 있음을 타입에 적어야 방어가 실제로 필요한지 드러난다. */
type ServerPublicCourse = {
  courseId: number;
  name: string | null;
  description: string | null;
  ownerNickname: string | null;
  stopIds: number[] | null;
  createdAt: string;
};

function toPublicCourse(c: ServerPublicCourse): PublicCourse {
  return {
    courseId: c.courseId,
    // 이름이 비면 행이 아이콘과 "N곳"만 남은 빈 줄이 된다. 소유자와 같은 기준으로 막는다.
    name: c.name ?? '이름 없는 코스',
    description: c.description ?? null,
    // 소유자를 못 채워 보내도 목록이 깨지지 않게 한다. 빈 문자열이면 화면에서 숨긴다
    ownerNickname: c.ownerNickname ?? '',
    stopIds: c.stopIds ?? [],
    createdAt: c.createdAt,
  };
}

function toSavedCourse(c: SavedCourse): SavedCourse {
  return {
    courseId: c.courseId,
    name: c.name,
    description: c.description ?? null,
    stopIds: c.stopIds ?? [],
    createdAt: c.createdAt,
    isPublic: c.isPublic ?? false,
  };
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
   * 한때 명세와 달리 401이 왔지만 **2026-09-08 백엔드 PR #65로 열렸다**(optimize-order도 같이).
   * 토큰을 보내는 건 무해하고 로그인 사용자를 식별할 여지도 남으므로 auth는 그대로 둔다.
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

  /** 내 CUSTOM 코스 전체. 페이지네이션이 없다(많이 쌓일 자원이 아니라는 판단). */
  list: async (): Promise<SavedCourse[]> => {
    const r = await request<SavedCourse[] | null>('GET', '/api/v1/courses', { auth: true });
    return (r ?? []).map(toSavedCourse);
  },

  /** 추천으로 받은 stops의 facilityId를 그대로 넣으면 내 코스가 된다. 1~10개. */
  create: async (input: {
    name: string;
    description?: string;
    stopIds: number[];
    isPublic?: boolean;
  }): Promise<SavedCourse> =>
    toSavedCourse(await request<SavedCourse>('POST', '/api/v1/courses', { body: input, auth: true })),

  /**
   * stopIds **전체를 교체**한다. 한 곳만 바꾸려면 replaceStop을 쓴다.
   *
   * ⚠️ 서버 스키마에 공개 여부가 `isPublic`과 `public` **두 이름으로** 노출돼 있다
   * (Jackson의 boolean 게터 네이밍 부작용). 지금은 `isPublic`으로 왕복을 확인했지만,
   * 백엔드가 record로 바꾸거나 `@JsonProperty`를 붙이면 **200을 받고도 공개가 안 되는**
   * 형태로 조용히 깨진다. 응답 DTO는 `isPublic` 하나뿐이라 읽기 쪽은 안전하다.
   */
  update: async (
    courseId: number,
    input: { name: string; description?: string; stopIds: number[]; isPublic?: boolean },
  ): Promise<SavedCourse> =>
    toSavedCourse(
      await request<SavedCourse>('PUT', `/api/v1/courses/${courseId}`, { body: input, auth: true }),
    ),

  /**
   * 공개/비공개 토글 **전용**.
   *
   * 예전에는 `PUT /courses/{id}`로 이름·스톱까지 전부 다시 실어 보내야 공개 여부가 바뀌었다.
   * 지구본 아이콘 하나 누르는 동작에 코스 전체를 보내는 셈이라, 스톱이 비면 검증에 막혔다.
   *
   * 켤 때 `COURSE4045`가 오면 **코스에 담긴 시설 모두에 판별 기록과 리뷰가 있어야 한다**는
   * 뜻이다. 새로 생긴 제약이 아니라 PUT에도 있던 검증이므로 안내 문구를 그대로 쓴다.
   */
  setVisibility: async (courseId: number, isPublic: boolean): Promise<SavedCourse> =>
    toSavedCourse(
      await request<SavedCourse>('PATCH', `/api/v1/courses/${courseId}/visibility`, {
        body: { isPublic },
        auth: true,
      }),
    ),

  /**
   * 그 자리(0부터 시작)의 스톱만 교체한다. 개수가 바뀌는 추가·삭제는 update(전체 교체)를 쓴다.
   * 한 곳 스왑 때마다 stopIds 전체를 다시 구성해 보내지 않으려고 있는 API다.
   */
  replaceStop: async (courseId: number, stopOrder: number, facilityId: number): Promise<SavedCourse> =>
    toSavedCourse(
      await request<SavedCourse>('PUT', `/api/v1/courses/${courseId}/stops/${stopOrder}`, {
        body: { facilityId },
        auth: true,
      }),
    ),

  remove: (courseId: number) =>
    request<{ courseId: number }>('DELETE', `/api/v1/courses/${courseId}`, { auth: true }),

  /** 이름만 바꾼다(백엔드 PR #97). PUT처럼 스톱을 다시 보내지 않아도 된다. 본인 코스만. */
  rename: async (courseId: number, name: string): Promise<SavedCourse> =>
    toSavedCourse(
      await request<SavedCourse>('PATCH', `/api/v1/courses/${courseId}/name`, { body: { name }, auth: true }),
    ),

  /**
   * 공유 코드 발급. 같은 코스에 다시 부르면 같은 코드가 오는지, 새 코드가 오는지는 서버가
   * 정한다 — 앱은 매번 받은 값을 쓴다. 공개 여부와 무관하게 코드로는 담을 수 있다.
   */
  share: async (courseId: number): Promise<string> => {
    const r = await request<{ courseId: number; shareCode?: string }>(
      'POST',
      `/api/v1/courses/${courseId}/share`,
      { auth: true },
    );
    if (!r.shareCode) throw new ApiError('공유 코드를 받지 못했어요', 'COURSE_SHARE_EMPTY');
    return r.shareCode;
  },
  /** 공유 코드로 남의 코스를 내 코스로 복사한다. 원본과 연결되지 않은 독립 사본이 생긴다. */
  copyShared: async (shareCode: string): Promise<SavedCourse> =>
    toSavedCourse(
      await request<SavedCourse>('POST', `/api/v1/courses/shared/${encodeURIComponent(shareCode)}/copy`, {
        auth: true,
      }),
    ),

  /**
   * 스톱 순서만 최근접 이웃으로 다듬는다. **아무것도 저장하지 않는다** — 결과를 저장하려면
   * 반환된 순서를 코스 저장/수정 API에 다시 넣어야 한다.
   *
   * 한때 명세와 달리 401이 왔지만 **2026-09-08 백엔드 PR #65로 열렸다**(distance-options도 같이).
   * 토큰을 보내는 건 무해하고 로그인 사용자를 식별할 여지도 남으므로 auth는 그대로 둔다.
   */
  optimizeOrder: async (stopIds: number[]): Promise<number[]> => {
    const r = await request<{ stopIds: number[] | null }>('POST', '/api/v1/courses/optimize-order', {
      body: { stopIds },
      auth: true,
    });
    // 서버가 순서를 못 주면 원래 순서를 그대로 쓴다 — 동선이 덜 다듬어질 뿐 코스는 유효하다
    return r.stopIds ?? stopIds;
  },

  /**
   * 다른 사람이 공개한 코스 목록(`GET /courses/public`). 인증이 필요 없어 로그인 전에도 쓴다.
   *
   * 서버가 `items`를 못 주면 빈 배열로 떨어뜨리되 **호출 자체의 실패는 그대로 던진다** —
   * 장애를 "아직 공개된 코스가 없어요"로 안내하면 사용자가 서비스가 빈 것으로 오해한다.
   */
  publicList: async (params: { page?: number; size?: number } = {}): Promise<{
    items: PublicCourse[];
    total: number;
  }> => {
    const q = new URLSearchParams();
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 10));

    /**
     * 인증 헤더를 **붙인다.**
     *
     * 이 API는 로그인 없이도 되지만, 토큰을 보내면 서버가 그 사용자의 아이 취향에 맞는 코스를
     * 먼저 올려준다. 예전에는 `auth`를 빼서 항상 인기순만 받았다 — 에러가 안 나고 목록도
     * 채워지므로 화면만 봐서는 알 수 없는 조용한 누락이었다.
     * 토큰이 없으면 헤더가 안 붙고 그대로 인기순이 온다.
     */
    const r = await request<{ items: ServerPublicCourse[] | null; total: number | null }>(
      'GET',
      `/api/v1/courses/public?${q.toString()}`,
      { auth: true },
    );
    const items = (r.items ?? []).map(toPublicCourse);
    // total이 비면 받은 개수로 대신한다. 0으로 떨어뜨리면 항목이 있는데 "0개"로 보인다
    return { items, total: r.total ?? items.length };
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
  create: async (facilityId: number, body: NewReviewBody) => {
    // 사진을 읽는 동안 계정이 바뀌면 이전 계정 토큰으로 나가지 않게 세대를 고정한다
    const epoch = getSessionEpoch();
    return request<ServerReview>('POST', `/api/v1/facilities/${facilityId}/reviews`, {
      body: await reviewPayload(body),
      auth: true,
      epoch,
    });
  },
  /**
   * 수정(reviewId 기준, 본인만). 필드는 create와 같다. 경험치는 다시 주지 않는다.
   * REVIEW4041 없는 리뷰 · REVIEW4002 남의 리뷰.
   */
  update: async (reviewId: number, body: NewReviewBody) => {
    const epoch = getSessionEpoch();
    return request<ServerReview>('PUT', `/api/v1/reviews/${reviewId}`, {
      body: await reviewPayload(body),
      auth: true,
      epoch,
    });
  },
  /**
   * 「도움됐어요」 — 남의 리뷰에만(본인 리뷰는 REVIEW4005). 취소 API는 없다(멱등, 중복 카운트 없음).
   * 리뷰 작성자의 '구원자' 배지 카운트가 이걸로 오른다.
   */
  helpful: (reviewId: number) =>
    request<{ reviewId: number; helpfulCount: number }>('POST', `/api/v1/reviews/${reviewId}/helpful`, { auth: true }),
  /** 「도움됐어요」 취소. 표시한 적 없어도 멱등. */
  unhelpful: (reviewId: number) =>
    request<{ reviewId: number; helpfulCount: number }>('DELETE', `/api/v1/reviews/${reviewId}/helpful`, { auth: true }),
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

// ─────────────────────────── 반려동물 캘린더 ───────────────────────────
// GET    /calendar-events?month=YYYY-MM         — 그 달에 걸리는 일정(반복·기간 전개, 복용 여부 포함)
// POST   /calendar-events                       — 생성(multipart)
// PATCH  /calendar-events/{id}                  — 수정(multipart, date·eventType·title 필수)
// DELETE /calendar-events/{id}
// PUT    /calendar-events/{id}/med-log/{date}   — 그날 복용 체크
// DELETE /calendar-events/{id}/med-log/{date}   — 체크 해제
// PATCH  /calendar-events/{id}/reminder         — 알림 on/off
//
// 앱은 일정을 "기준 일정 + 반복 규칙"으로 들고 직접 전개한다(`eventOccursOn`). 서버 목록은
// 이미 전개된 **발생(occurrence)** 단위라, 받은 뒤 eventId로 접어 기준 일정을 복원한다.
type ServerCalType = 'VACCINE' | 'MED' | 'CHECKUP' | 'TRAVEL' | 'ETC';
const CAL_TYPE_TO_SERVER: Record<CalEventType, ServerCalType> = {
  VACCINE: 'VACCINE', MED: 'MED', CHECKUP: 'CHECKUP', TRAVEL: 'TRAVEL', OTHER: 'ETC',
};
const CAL_TYPE_FROM_SERVER: Record<string, CalEventType> = {
  VACCINE: 'VACCINE', MED: 'MED', CHECKUP: 'CHECKUP', TRAVEL: 'TRAVEL', ETC: 'OTHER',
};

type ServerOccurrence = {
  eventId: number;
  petId?: number | null;
  eventType?: string;
  title?: string;
  date?: string;
  endDate?: string | null;
  time?: string | null;
  repeatType?: string;
  reminderEnabled?: boolean;
  notes?: string | null;
  taken?: boolean;
  /** 반복 일정의 시작일(백엔드 PR #115). 옛 서버엔 없다 */
  startDate?: string | null;
};

export type CalendarSnapshot = {
  events: CalendarEvent[];
  /** "eventId:YYYY-MM-DD" — 그날 복용을 체크한 발생 */
  taken: string[];
};

function occurrenceToEvent(o: ServerOccurrence): CalendarEvent {
  const repeat = (o.repeatType ?? 'NONE') as CalRepeat;
  return {
    eventId: o.eventId,
    petId: typeof o.petId === 'number' ? o.petId : null,
    type: CAL_TYPE_FROM_SERVER[o.eventType ?? ''] ?? 'OTHER',
    title: o.title ?? '',
    // 시작일이 오면 그게 기준일이다. 없으면(옛 서버) 발생일로 두고 fold가 가장 이른 날을 고른다
    date: o.startDate || o.date || '',
    endDate: o.endDate || null,
    time: o.time ? o.time.slice(0, 5) : null,
    repeat: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'].includes(repeat) ? repeat : 'NONE',
    reminder: o.reminderEnabled ?? false,
    notes: o.notes || null,
  };
}

/**
 * 발생 목록 → 기준 일정.
 *
 * 같은 eventId가 여러 날에 걸쳐 오면(반복·기간) **가장 이른 날**을 기준일로 삼는다. 서버가
 * 기준일을 그대로 실어 보내면 전부 같은 값이라 상관없고, 발생일을 보내면 이 창 안에서
 * 처음 보이는 날이 기준이 된다 — 그 뒤 발생은 반복 규칙으로 앱이 똑같이 그려낸다.
 */
function foldOccurrences(list: ServerOccurrence[]): CalendarSnapshot {
  const byId = new Map<number, CalendarEvent>();
  const taken: string[] = [];
  for (const o of list) {
    if (typeof o.eventId !== 'number' || !o.date) continue;
    const ev = occurrenceToEvent(o);
    const cur = byId.get(o.eventId);
    if (!cur || ev.date < cur.date) byId.set(o.eventId, ev);
    if (o.taken) taken.push(`${o.eventId}:${o.date}`);
  }
  return { events: [...byId.values()], taken };
}

/** 앱 일정 → 서버 create/update용 multipart. null·빈 값은 싣지 않는다(서버가 없음으로 본다). */
function calendarForm(e: Omit<CalendarEvent, 'eventId'>): FormData {
  const fd = new FormData();
  fd.append('eventType', CAL_TYPE_TO_SERVER[e.type]);
  fd.append('title', e.title);
  fd.append('date', e.date);
  fd.append('repeatType', e.repeat);
  fd.append('reminderEnabled', e.reminder ? 'true' : 'false');
  if (e.petId !== null) fd.append('petId', String(e.petId));
  if (e.endDate) fd.append('endDate', e.endDate);
  if (e.time) fd.append('time', e.time);
  if (e.notes) fd.append('notes', e.notes);
  return fd;
}

export const calendarApi = {
  /** 한 달치(YYYY-MM). 여러 달을 합칠 때는 호출한 쪽이 eventId로 중복을 걷어낸다. */
  month: async (ym: string): Promise<CalendarSnapshot> => {
    const r = await request<{ events?: ServerOccurrence[] }>(
      'GET',
      `/api/v1/calendar-events?month=${encodeURIComponent(ym)}`,
      { auth: true },
    );
    return foldOccurrences(r.events ?? []);
  },
  create: async (e: Omit<CalendarEvent, 'eventId'>): Promise<number> => {
    const r = await request<{ eventId: number }>('POST', '/api/v1/calendar-events', {
      body: calendarForm(e),
      auth: true,
    });
    return r.eventId;
  },
  /** 전체 수정. 서버가 date·eventType·title을 매번 요구해 병합된 일정을 통째로 보낸다. */
  update: (eventId: number, e: Omit<CalendarEvent, 'eventId'>) =>
    request<unknown>('PATCH', `/api/v1/calendar-events/${eventId}`, { body: calendarForm(e), auth: true }),
  remove: (eventId: number) =>
    request<unknown>('DELETE', `/api/v1/calendar-events/${eventId}`, { auth: true }),
  setReminder: (eventId: number, enabled: boolean) =>
    request<unknown>('PATCH', `/api/v1/calendar-events/${eventId}/reminder`, {
      body: { reminderEnabled: enabled },
      auth: true,
    }),
  setMedTaken: (eventId: number, date: string, taken: boolean) =>
    request<unknown>(taken ? 'PUT' : 'DELETE', `/api/v1/calendar-events/${eventId}/med-log/${date}`, {
      auth: true,
    }),
};

// ─────────────────────────── 사업자(진위확인·내 매장 조건 확정) ───────────────────────────
// POST /business/verify                       — 국세청 사업자등록정보 진위확인
// POST /business/facilities/{id}/claim        — 내 매장의 출입 조건을 사업자 확인으로 확정
//
// claim은 세션이 아니라 **요청마다 사업자 정보를 다시 받는다.** 그래서 화면은 1단계에서
// 확인한 번호·대표자명·개업일을 3단계까지 들고 있어야 한다. 번호 원본은 기기에 남기지 않는다.
export type BusinessIdentity = {
  /** 숫자 10자리 */
  businessNumber: string;
  representativeName: string;
  /** YYYYMMDD 8자리 */
  openingDate: string;
};

export type BusinessVerifyResult = {
  valid: boolean;
  /** 서버 상태 코드(계속사업자·휴업·폐업 등). 화면은 statusLabel을 쓴다 */
  status: string;
  statusLabel: string;
};

export type BusinessClaimInput = {
  petAllowed: 'ALLOWED' | 'DENIED' | 'PENDING';
  maxWeight: number | null;
  /** true면 "N kg 이하", false면 "N kg 미만" */
  maxWeightInclusive: boolean;
  requirements: Requirement[];
  conditionRaw: string;
};

/** 신청 상태 — 운영자가 사업자등록증을 보고 정한다. APPROVED가 돼야 시설이 CONFIRMED/OWNER로 바뀐다 */
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export type BusinessClaimResult = { claimId: number; status: ClaimStatus };

/** 5-1·5-2의 중복 후보. `source`는 출처(관광공사 적재분 / 다른 사업자의 자체 등록) */
export type DuplicateCandidate = {
  facilityId: number;
  name: string;
  address: string | null;
  category: Category;
  source: 'TOUR_API' | 'BUSINESS_SELF';
  distanceMeters: number | null;
};

/** 신규 매장 등록(5-2) 입력. 좌표는 서버가 주소를 지오코딩해 채운다 — 앱이 보내지 않는다 */
export type NewFacilityInput = BusinessClaimInput & {
  name: string;
  category: Category;
  address: string;
  phone: string | null;
  /** `GET /facilities/regions`에서 고른 값을 **그대로** 보낸다 */
  sidoCode: string;
  sigunguCode: string | null;
  /** 유사 후보를 보고도 "다른 매장이다"를 확인했는가. false면 서버가 BUSINESS4010으로 막는다 */
  duplicateCheckAcknowledged: boolean;
};

export type NewFacilityResult = {
  facilityId: number;
  claimId: number;
  name: string;
  address: string | null;
  status: ClaimStatus;
};

function toCandidates(raw: unknown): DuplicateCandidate[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((c): c is Record<string, unknown> => !!c && typeof (c as { facilityId?: unknown }).facilityId === 'number')
    .map((c) => ({
      facilityId: c.facilityId as number,
      name: typeof c.name === 'string' ? c.name : '',
      address: typeof c.address === 'string' ? c.address : null,
      category: CATEGORY_FROM_SERVER[String(c.category)] ?? 'TOUR',
      source: c.source === 'BUSINESS_SELF' ? 'BUSINESS_SELF' : 'TOUR_API',
      distanceMeters: typeof c.distanceMeters === 'number' ? c.distanceMeters : null,
    }));
}

/**
 * `BUSINESS4010`(중복 후보 미확인)에 실려 온 후보 목록. 다른 오류면 빈 배열이다.
 * 이 코드를 받으면 화면이 후보를 보여주고 "이 매장인가요?"를 물어야 한다(business.md 5-2).
 */
export function duplicateCandidatesOf(e: unknown): DuplicateCandidate[] {
  if (!(e instanceof ApiError) || e.code !== 'BUSINESS4010') return [];
  const r = e.result as { candidates?: unknown } | null | undefined;
  return toCandidates(r?.candidates);
}

export type MyClaim = {
  claimId: number;
  facilityId: number;
  facilityName: string;
  facilityAddress: string | null;
  status: ClaimStatus;
  appliedAt: string;
  /** 반려·해제 사유. 대기·승인이면 null */
  reviewReason: string | null;
  requestedMaxWeightInclusive: boolean | null;
};

export const businessApi = {
  /** 진위확인. 유효하지 않아도 200으로 오고 `valid:false` + 상태 라벨(휴업·폐업 등)이 실린다. */
  verify: async (id: BusinessIdentity): Promise<BusinessVerifyResult> => {
    const r = await request<Partial<BusinessVerifyResult>>('POST', '/api/v1/business/verify', {
      body: id,
      auth: true,
    });
    return {
      valid: r.valid === true,
      status: r.status ?? '',
      statusLabel: r.statusLabel ?? (r.valid ? '확인됨' : '확인되지 않음'),
    };
  },
  /**
   * 내 매장 등록 **신청**(multipart). 사업자등록증 사진이 필수다 — 운영자가 보고 승인해야 시설이
   * `CONFIRMED / OWNER`로 바뀐다(백엔드 PR #107). 그 전까지는 `PENDING`이고 손님 화면은 그대로다.
   * maxWeight는 제한이 없으면 아예 보내지 않는다 — 0을 보내면 "0kg까지"가 된다.
   *
   * BUSINESS4003 다른 사람이 이미 승인된 매장 · BUSINESS4004 내 대기 신청이 있음 · BUSINESS4005 이미 내 승인 매장.
   */
  claim: async (
    facilityId: number,
    id: BusinessIdentity,
    input: BusinessClaimInput,
    certificateUri: string,
  ): Promise<BusinessClaimResult> => {
    const epoch = getSessionEpoch();
    const fd = new FormData();
    fd.append('businessNumber', id.businessNumber);
    fd.append('representativeName', id.representativeName);
    fd.append('openingDate', id.openingDate);
    fd.append('petAllowed', input.petAllowed);
    fd.append('maxWeightInclusive', input.maxWeightInclusive ? 'true' : 'false');
    for (const r of input.requirements) fd.append('requirements', r);
    if (input.conditionRaw) fd.append('conditionRaw', input.conditionRaw);
    if (input.maxWeight !== null && input.maxWeight > 0) fd.append('maxWeight', String(input.maxWeight));
    const blob = await (await fetch(certificateUri)).blob();
    fd.append('registrationCertificate', blob, 'certificate.jpg');
    const r = await request<Partial<BusinessClaimResult>>(
      'POST',
      `/api/v1/business/facilities/${facilityId}/claim`,
      { body: fd, auth: true, epoch },
    );
    return { claimId: r.claimId ?? 0, status: (r.status as ClaimStatus) ?? 'PENDING' };
  },
  /**
   * 5-1. 중복 후보 사전조회 — 이름·주소만으로. 사업자 정보는 아직 필요 없다.
   * 반경 100m·이름 유사 최대 5건. 비어 있으면 새로 등록해도 안전하다는 뜻이다.
   */
  duplicateCheck: async (name: string, address: string): Promise<DuplicateCandidate[]> => {
    const r = await request<{ candidates?: unknown }>('POST', '/api/v1/business/facilities/duplicate-check', {
      body: { name, address },
      auth: true,
    });
    return toCandidates(r.candidates);
  },
  /**
   * 5-2. 신규 매장 등록 — 관광공사 목록에 없는 매장을 직접 만들고 소유권까지 확정한다.
   * 등록증·운영자 승인이 없다(대조할 관광공사 데이터가 없으니 국세청 진위확인으로 대신한다).
   * 응답은 항상 `APPROVED` — claim과 달리 PENDING을 거치지 않는다.
   */
  registerFacility: async (id: BusinessIdentity, input: NewFacilityInput): Promise<NewFacilityResult> => {
    const r = await request<Partial<NewFacilityResult>>('POST', '/api/v1/business/facilities', {
      body: {
        businessNumber: id.businessNumber,
        representativeName: id.representativeName,
        openingDate: id.openingDate,
        name: input.name,
        category: input.category,
        address: input.address,
        phone: input.phone,
        sidoCode: input.sidoCode,
        sigunguCode: input.sigunguCode,
        petAllowed: input.petAllowed,
        maxWeight: input.maxWeight,
        maxWeightInclusive: input.maxWeightInclusive,
        requirements: input.requirements,
        conditionRaw: input.conditionRaw,
        duplicateCheckAcknowledged: input.duplicateCheckAcknowledged,
      },
      auth: true,
    });
    return {
      facilityId: r.facilityId ?? 0,
      claimId: r.claimId ?? 0,
      name: r.name ?? input.name,
      address: r.address ?? input.address,
      status: (r.status as ClaimStatus) ?? 'APPROVED',
    };
  },
  /** 내 신청 목록 — 상태별. 반려 사유는 아직 응답에 없다(백엔드 요청 중). */
  myClaims: async (): Promise<MyClaim[]> => {
    const r = await request<{ claims?: Partial<MyClaim>[] }>('GET', '/api/v1/business/claims', { auth: true });
    return (r.claims ?? [])
      .filter((c): c is MyClaim => typeof c?.claimId === 'number' && typeof c?.facilityId === 'number')
      .map((c) => ({
        claimId: c.claimId,
        facilityId: c.facilityId,
        facilityName: c.facilityName ?? '',
        facilityAddress: c.facilityAddress ?? null,
        status: (c.status as ClaimStatus) ?? 'PENDING',
        appliedAt: c.appliedAt ?? '',
        reviewReason: c.reviewReason ?? null,
        requestedMaxWeightInclusive: c.requestedMaxWeightInclusive ?? null,
      }));
  },
};

// ─────────────────────────── 게이미피케이션(집사 레벨·발바닥 티어) ───────────────────────────
// GET   /me/gamification               — 레벨·누적 XP·발바닥 티어·받은 배지
// PATCH /me/gamification/notification  — 레벨업 알림 on/off
//
// XP는 **계정 단위**다(판별·리뷰·제보·만족도·코스 공개/복사). 반려동물별로 나뉘지 않는다.
// 레벨 곡선(`100 × L × (L−1) / 2`, 최대 70)과 티어 구성은 서버가 확정했다 — `data/level.ts` 참고.
type ServerGamification = {
  level?: number;
  totalXp?: number;
  xpToNextLevel?: number;
  tierAnimal?: string;
  /** 선명도 5단계(서버 재설계 2026-09-18). 옛 서버엔 없다 */
  tierFinish?: string;
  tierColor?: string;
  tierLabel?: string;
  tierBadgeImageUrl?: string | null;
  levelUpNotificationEnabled?: boolean;
  badges?: { code?: string; label?: string; description?: string; earnedAt?: string | null }[];
  /** 도메인별 누적 횟수·단계(백엔드 PR #116). 옛 서버엔 없다 */
  progress?: { family?: string; label?: string; count?: number; tiers?: { tier?: string; threshold?: number; earnedAt?: string | null }[] }[];
};

// ─────────────────────────── 오늘의 퀘스트(quest) ───────────────────────────
// GET /me/gamification/quests — 오늘(KST) 6개 행동의 진행률
//
// **퀘스트는 새로운 행동이 아니다.** XP를 주던 기존 6개 행동을 "오늘 몇 번 했는지"로 보여줄
// 뿐이고, 이 API를 부른다고 XP가 지급되지 않는다(지급은 각 도메인 API에서). 하루 상한이
// 곧 target이라 completed가 target을 넘는 일은 없다. 리셋은 KST 자정.
export type QuestSource =
  | 'PETCHECK'
  | 'REVIEW'
  | 'REPORT'
  | 'SATISFACTION'
  | 'COURSE_PUBLISHED'
  | 'COURSE_SHARED_COPY';

export type DailyQuest = {
  sourceType: QuestSource;
  label: string;
  completed: number;
  target: number;
  earnedXpToday: number;
};

export type DailyQuests = {
  /** 다음 리셋(내일 KST 자정). 서버가 안 주면 null — 화면은 "자정에 초기화"만 안내한다 */
  resetsAt: string | null;
  quests: DailyQuest[];
};

const QUEST_SOURCES = new Set<string>([
  'PETCHECK',
  'REVIEW',
  'REPORT',
  'SATISFACTION',
  'COURSE_PUBLISHED',
  'COURSE_SHARED_COPY',
]);

// ─────────────────────────── 지역 랭킹(region ranking) ───────────────────────────
// GET /gamification/ranking — 사용자를 시/도·시/군/구로 줄 세운다.
//
// **시설 발자국 랭킹(`facilitiesApi.ranking`)과 다른 기능이다.** 저쪽은 시설을 등급순으로,
// 이쪽은 사람을 누적 XP순으로 세운다. 명세는 `docs/13-지역-랭킹.md`(프론트 작성) 기준이고,
// 백엔드 구현 중이라 **경로·필드가 달라질 수 있다** — 없으면 화면이 "준비 중"으로 떨어진다.
const REGION_RANKING_PATH = '/api/v1/gamification/ranking';

export type RankingScope = 'NATION' | 'SIDO' | 'SIGUNGU';

export type RegionRankingEntry = {
  rank: number;
  userId: number | null;
  nickname: string;
  xp: number;
  level: number;
  tierAnimal: TierAnimal;
  tierColor: TierColor;
  isMe: boolean;
};

export type RegionRankingMe = {
  rank: number;
  /** 이 지역에서 집계된 사람 수 — "340명 중 12번째"의 340 */
  participantCount: number;
  xp: number;
  level: number;
  /** 참여자가 최소 인원 미만이면 false — 순위를 감춘다 */
  ranked: boolean;
};

export type RegionRanking = {
  scope: RankingScope;
  sido: string | null;
  sigungu: string | null;
  me: RegionRankingMe | null;
  items: RegionRankingEntry[];
  total: number;
  /** 집계 기준 시각. 스냅샷이면 "오늘 새벽 기준"을 밝혀야 한다 */
  updatedAt: string | null;
};

/** 서버가 아직 이 API를 안 만들었을 때(404·405) 던진다 — 화면이 오류 대신 "준비 중"을 그린다 */
export class NotDeployedError extends Error {
  constructor() {
    super('아직 준비 중인 기능이에요.');
    this.name = 'NotDeployedError';
  }
}

const TIER_ANIMALS = new Set<string>(['DOG', 'CAT']);
const TIER_COLORS = new Set<string>(['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'INDIGO', 'VIOLET']);
const int = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback);

function toEntry(raw: unknown, index: number): RegionRankingEntry | null {
  const e = raw as Record<string, unknown> | null;
  if (!e || typeof e.nickname !== 'string') return null;
  const animal = String(e.tierAnimal);
  const color = String(e.tierColor);
  return {
    rank: int(e.rank, index + 1),
    userId: typeof e.userId === 'number' ? e.userId : null,
    nickname: e.nickname,
    xp: Math.max(int(e.xp), 0),
    level: Math.max(int(e.level, 1), 1),
    tierAnimal: TIER_ANIMALS.has(animal) ? (animal as TierAnimal) : 'DOG',
    tierColor: TIER_COLORS.has(color) ? (color as TierColor) : 'RED',
    isMe: e.isMe === true,
  };
}

export const regionRankingApi = {
  get: async (params: { scope: RankingScope; sidoCode?: string | null; sigunguCode?: string | null; size?: number }): Promise<RegionRanking> => {
    const q = new URLSearchParams({ scope: params.scope, size: String(params.size ?? 20) });
    if (params.scope !== 'NATION' && params.sidoCode) q.set('sidoCode', params.sidoCode);
    if (params.scope === 'SIGUNGU' && params.sigunguCode) q.set('sigunguCode', params.sigunguCode);
    let r: Record<string, unknown>;
    try {
      r = await request<Record<string, unknown>>('GET', `${REGION_RANKING_PATH}?${q.toString()}`, { auth: true });
    } catch (e) {
      // 아직 배포 전이면 404가 온다. 오류 화면 대신 "준비 중"으로 안내한다
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) throw new NotDeployedError();
      throw e;
    }
    const meRaw = r.me as Record<string, unknown> | null | undefined;
    return {
      scope: (r.scope as RankingScope) ?? params.scope,
      sido: typeof r.sido === 'string' ? r.sido : null,
      sigungu: typeof r.sigungu === 'string' ? r.sigungu : null,
      me:
        meRaw && typeof meRaw.rank === 'number'
          ? {
              rank: int(meRaw.rank, 0),
              participantCount: Math.max(int(meRaw.participantCount), 0),
              xp: Math.max(int(meRaw.xp), 0),
              level: Math.max(int(meRaw.level, 1), 1),
              // 서버가 안 주면 "순위를 보여도 된다"로 본다 — 준 경우에만 감춘다
              ranked: meRaw.ranked !== false,
            }
          : null,
      items: (Array.isArray(r.items) ? r.items : []).map(toEntry).filter((x): x is RegionRankingEntry => x !== null),
      total: Math.max(int(r.total), 0),
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
    };
  },
};

export const questsApi = {
  /** 오늘의 퀘스트 6개. 모르는 sourceType은 버린다 — 라벨만 있고 갈 곳을 모르면 눌러도 막힌다 */
  today: async (): Promise<DailyQuests> => {
    const r = await request<{
      resetsAt?: string | null;
      quests?: { sourceType?: string; label?: string; completed?: number; target?: number; earnedXpToday?: number }[];
    }>('GET', '/api/v1/me/gamification/quests', { auth: true });
    const int = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(Math.trunc(v), 0) : fallback);
    return {
      resetsAt: r.resetsAt ?? null,
      quests: (r.quests ?? [])
        .filter((q): q is { sourceType: QuestSource } & typeof q => !!q.sourceType && QUEST_SOURCES.has(q.sourceType))
        .map((q) => ({
          sourceType: q.sourceType,
          label: q.label || '',
          completed: int(q.completed),
          // target이 0이면 진행률이 0으로 나눠져 NaN이 된다. 1로 바닥을 깐다
          target: Math.max(int(q.target, 1), 1),
          earnedXpToday: int(q.earnedXpToday),
        })),
    };
  },
};

export const gamificationApi = {
  /** 내 레벨·티어·배지. 값이 빠져 있어도 화면이 깨지지 않게 여기서 기본값을 채운다. */
  me: async (): Promise<Gamification> => {
    const r = await request<ServerGamification>('GET', '/api/v1/me/gamification', { auth: true });
    /**
     * 경계에서 모양을 본다. 숫자 자리에 숫자가 아닌 값이 오면 `Math.trunc`가 NaN을 만들어
     * 레벨이 "Lv.NaN"으로 그려지고, `badges`가 배열이 아니면 `.map`에서 터진다.
     * 빠진 필드는 아래 기본값으로 받되, **틀린 모양**은 실패로 돌린다.
     */
    const num = (v: unknown) => v === undefined || v === null || (typeof v === 'number' && Number.isFinite(v));
    if (!num(r.level) || !num(r.totalXp) || !num(r.xpToNextLevel) || (r.badges !== undefined && !Array.isArray(r.badges))) {
      throw new ApiError('레벨 정보의 형식이 올바르지 않아요.', 'GAMIFICATION_SHAPE');
    }
    const level = Math.min(Math.max(Math.trunc(r.level ?? 1), 1), MAX_LEVEL);
    const animal = (r.tierAnimal ?? 'DOG') as TierAnimal;
    const color = (r.tierColor ?? 'RED') as TierColor;
    return {
      level,
      totalXp: Math.max(r.totalXp ?? 0, 0),
      xpToNextLevel: Math.max(r.xpToNextLevel ?? 0, 0),
      tierAnimal: TIER_ANIMAL_LABEL[animal] ? animal : 'DOG',
      tierColor: TIER_COLOR_LABEL[color] ? color : 'RED',
      tierLabel: r.tierLabel ?? '',
      // 빈 문자열이 오면 <Image>가 조용히 깨진다. 없는 것과 같게 만든다
      tierBadgeImageUrl: r.tierBadgeImageUrl ? r.tierBadgeImageUrl : null,
      levelUpNotificationEnabled: r.levelUpNotificationEnabled ?? true,
      badges: (r.badges ?? []).map((b) => ({
        code: b.code ?? '',
        label: b.label ?? '배지',
        description: b.description ?? '',
        earnedAt: b.earnedAt ?? null,
      })),
      progress: (Array.isArray(r.progress) ? r.progress : [])
        .filter((g) => typeof g?.family === 'string')
        .map((g) => ({
          family: g.family as string,
          label: g.label ?? '',
          count: typeof g.count === 'number' && Number.isFinite(g.count) ? g.count : 0,
          tiers: (g.tiers ?? [])
            .filter((t) => typeof t?.tier === 'string')
            .map((t) => ({ tier: t.tier as string, threshold: t.threshold ?? 0, earnedAt: t.earnedAt ?? null })),
        })),
    };
  },
  /** 레벨업 알림 on/off. 서버가 확정한 값을 돌려준다. */
  setLevelUpNotification: async (enabled: boolean): Promise<boolean> => {
    const r = await request<{ levelUpNotificationEnabled?: boolean }>(
      'PATCH',
      '/api/v1/me/gamification/notification',
      { body: { levelUpNotificationEnabled: enabled }, auth: true },
    );
    return r.levelUpNotificationEnabled ?? enabled;
  },
};

// ─────────────────────────── 공지사항 ───────────────────────────
// GET /notices — 인증 불필요. 고정(pinned) 먼저, 그 안에서 최신순. 작성·수정 API는 없다(운영자가 DB에 직접).
export type Notice = { id: number; title: string; body: string; createdAt: string; pinned: boolean };

export const noticesApi = {
  list: async (): Promise<Notice[]> => {
    const r = await request<Partial<Notice>[] | { notices?: Partial<Notice>[] }>('GET', '/api/v1/notices');
    // 명세는 배열이지만 다른 도메인처럼 감싸 올 가능성에도 대비한다
    const arr = Array.isArray(r) ? r : (r?.notices ?? []);
    return arr
      .filter((n): n is Notice => typeof n?.id === 'number' && typeof n?.title === 'string')
      .map((n) => ({ id: n.id, title: n.title, body: n.body ?? '', createdAt: n.createdAt ?? '', pinned: n.pinned === true }));
  },
};

// ─────────────────────────── 사업자 대시보드(owner) ───────────────────────────
// GET  /owner/facilities                                   — 내 매장 카드(조건·지표·거부 요약·소개 초기값) 1콜
// GET  /owner/facilities/{id}/denial-alerts                — 확정 이후 거부 제보 전체
// PUT  /owner/facilities/{id}/conditions                   — 출입 조건 수정(재심사 없음)
// PUT  /owner/facilities/{id}/profile                      — 소개·편의시설
// GET  /owner/facilities/{id}/review-stats                 — 항목 평균·등급 추이·관심도
// GET/POST /owner/facilities/{id}/benefits · DELETE/PATCH …/{benefitId}[/enabled]
//
// 승인(APPROVED)된 소유자만 통과한다. 비소유자·대기·없는 시설 전부 BUSINESS4008(403)로 같다.

export type OwnerEntryCondition = {
  petAllowed: 'ALLOWED' | 'DENIED' | 'PENDING';
  maxWeight: number | null;
  maxWeightInclusive: boolean | null;
  requirements: Requirement[];
  conditionRaw: string | null;
  confirmedAt: string | null;
  confidence: Confidence;
  confidenceSource: ConfidenceSource;
};

export type OwnerFacility = {
  facilityId: number;
  name: string;
  category: Category;
  address: string | null;
  entryCondition: OwnerEntryCondition;
  stats: { weeklyPetCheckCount: number; reviewCount: number };
  denialAlerts: { count: number; latest: { reason: string; reportedAt: string } | null };
  profile: { introduction: string | null; amenityTags: OwnerAmenity[] };
};

/**
 * 사장님이 보는 거부 제보. **사진·제보자는 어떤 경우에도 오지 않는다**(제보 위축 방지).
 *
 * 라이브 응답(2026-09-19)은 `{reason, reportedAt}`뿐이고 명세가 말하는 원문(`content`)·
 * `reportId`는 아직 없다 — 옵셔널로 두고, 없으면 화면이 그 줄을 그리지 않는다.
 */
export type OwnerDenialAlert = { reportId?: number; reason: string; content?: string | null; reportedAt: string };
export type OwnerReviewStats = {
  itemAverages: { reviewCount: number; averageSpace: number; averageStaff: number; averageAmenity: number };
  gradeTrend: { date: string; pawGradeLevel: number | null; petScore: number | null }[];
  interestCount: number;
};
export type OwnerBenefit = { benefitId: number; title: string; description: string | null; isEnabled: boolean };

const KNOWN_REQ = new Set<string>(['LEASH', 'CAGE', 'MUZZLE', 'VACCINATION', 'SMALL_ONLY', 'OUTDOOR_ONLY', 'STROLLER', 'MANNER_BELT']);
function toCondition(c: Partial<OwnerEntryCondition> | null | undefined): OwnerEntryCondition {
  return {
    petAllowed: (c?.petAllowed as OwnerEntryCondition['petAllowed']) ?? 'PENDING',
    maxWeight: typeof c?.maxWeight === 'number' ? c.maxWeight : null,
    maxWeightInclusive: c?.maxWeightInclusive ?? null,
    requirements: ((c?.requirements ?? []) as string[]).filter((r): r is Requirement => KNOWN_REQ.has(r)),
    conditionRaw: c?.conditionRaw ?? null,
    confirmedAt: c?.confirmedAt ?? null,
    confidence: (c?.confidence as Confidence) ?? 'UNVERIFIED',
    confidenceSource: (c?.confidenceSource as ConfidenceSource) ?? 'NONE',
  };
}

export const ownerApi = {
  facilities: async (): Promise<OwnerFacility[]> => {
    const r = await request<{ facilities?: Record<string, unknown>[] }>('GET', '/api/v1/owner/facilities', { auth: true });
    return (r.facilities ?? [])
      .filter((f) => typeof f.facilityId === 'number')
      .map((f) => {
        const stats = (f.stats ?? {}) as Partial<OwnerFacility['stats']>;
        const alerts = (f.denialAlerts ?? {}) as Partial<OwnerFacility['denialAlerts']>;
        const profile = (f.profile ?? {}) as Partial<OwnerFacility['profile']>;
        return {
          facilityId: f.facilityId as number,
          name: (f.name as string) ?? '',
          category: CATEGORY_FROM_SERVER[f.category as string] ?? 'TOUR',
          address: (f.address as string | null) ?? null,
          entryCondition: toCondition(f.entryCondition as Partial<OwnerEntryCondition>),
          stats: { weeklyPetCheckCount: stats.weeklyPetCheckCount ?? 0, reviewCount: stats.reviewCount ?? 0 },
          denialAlerts: { count: alerts.count ?? 0, latest: alerts.latest ?? null },
          profile: { introduction: profile.introduction ?? null, amenityTags: toOwnerAmenities(profile.amenityTags) },
        };
      });
  },
  denialAlerts: async (facilityId: number): Promise<OwnerDenialAlert[]> => {
    const r = await request<{ alerts?: Partial<OwnerDenialAlert>[] }>('GET', `/api/v1/owner/facilities/${facilityId}/denial-alerts`, { auth: true });
    // 사유·시각이 없는 항목은 버린다 — 빈 카드가 쌓이면 제보가 온 것처럼 보인다
    return (r.alerts ?? [])
      .filter((a): a is OwnerDenialAlert => typeof a?.reason === 'string' && typeof a?.reportedAt === 'string')
      .map((a) => ({ reportId: a.reportId, reason: a.reason, content: a.content ?? null, reportedAt: a.reportedAt }));
  },
  /** 재심사 없이 즉시 반영. 판별에 쓰이는 값이 실제로 바뀐 경우에만 confirmedAt이 갱신된다. */
  updateConditions: async (
    facilityId: number,
    body: { petAllowed: 'ALLOWED' | 'DENIED' | 'PENDING'; maxWeight: number | null; maxWeightInclusive: boolean | null; requirements: Requirement[]; conditionRaw: string | null },
  ): Promise<OwnerEntryCondition> =>
    toCondition(await request<Partial<OwnerEntryCondition>>('PUT', `/api/v1/owner/facilities/${facilityId}/conditions`, { body, auth: true })),
  updateProfile: (facilityId: number, body: { introduction: string | null; amenityTags: OwnerAmenity[] }) =>
    request<{ introduction: string | null; amenityTags: OwnerAmenity[] }>('PUT', `/api/v1/owner/facilities/${facilityId}/profile`, { body, auth: true }),
  reviewStats: async (facilityId: number): Promise<OwnerReviewStats> => {
    const r = await request<Partial<OwnerReviewStats>>('GET', `/api/v1/owner/facilities/${facilityId}/review-stats`, { auth: true });
    return {
      itemAverages: { reviewCount: 0, averageSpace: 0, averageStaff: 0, averageAmenity: 0, ...(r.itemAverages ?? {}) },
      gradeTrend: r.gradeTrend ?? [],
      interestCount: r.interestCount ?? 0,
    };
  },
  benefits: async (facilityId: number): Promise<OwnerBenefit[]> => {
    const r = await request<{ benefits?: OwnerBenefit[] }>('GET', `/api/v1/owner/facilities/${facilityId}/benefits`, { auth: true });
    return r.benefits ?? [];
  },
  addBenefit: (facilityId: number, title: string, description: string | null) =>
    request<OwnerBenefit>('POST', `/api/v1/owner/facilities/${facilityId}/benefits`, { body: { title, description }, auth: true }),
  removeBenefit: (facilityId: number, benefitId: number) =>
    request<{ benefitId: number }>('DELETE', `/api/v1/owner/facilities/${facilityId}/benefits/${benefitId}`, { auth: true }),
  setBenefitEnabled: (facilityId: number, benefitId: number, isEnabled: boolean) =>
    request<OwnerBenefit>('PATCH', `/api/v1/owner/facilities/${facilityId}/benefits/${benefitId}/enabled`, { body: { isEnabled }, auth: true }),
};
