import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { clearSession, loadSession, saveSession } from '@/lib/token-store';
import { clearStamps, loadStamps, saveStamps } from '@/lib/stamp-store';
import { loadHiddenChecks, saveHiddenChecks } from '@/lib/hidden-checks';
import { getFcmToken } from '@/lib/push';

import type { ThemeMode } from '@/constants/theme';
import { CHECK_RANK, buildChecklist, judgeGroup } from '@/data/judge';
import {
  ApiError,
  accountApi,
  aiApi,
  denialApi,
  facilitiesApi,
  petsApi,
  pushApi,
  reviewsApi,
  satisfactionApi,
  bumpSessionEpoch,
  setAuthToken,
  setRefreshToken,
  setTokensRefreshedHandler,
  setUnauthorizedHandler,
  type DenialAlert,
  type ServerDenialReport,
} from '@/lib/api';
import { DEV_TOKEN } from '@/lib/config';
import {
  loadCalendarEvents,
  loadMedLog,
  saveCalendarEvents,
  saveMedLog,
} from '@/lib/calendar-store';
import { loadMyReviewIds, saveMyReviewIds } from '@/lib/my-reviews';
import { loadSettings, saveSettings } from '@/lib/settings-store';
import type { Coords } from '@/lib/location';
import { FACILITIES, INITIAL_CAL_EVENTS, INITIAL_CHECKS, INITIAL_PETS, INITIAL_REPORTS, REVIEWS, isMockFacilityId } from '@/data/mock';
import { eventOccursOn, nextVaccinationOf, pawGradeOf, vaccinationDday } from '@/data/types';
import { matchRegion, type Stamp } from '@/data/stamps';
import type {
  CalendarEvent,
  Confidence,
  ConfidenceSource,
  FontSizeMode,
  Facility,
  FacilityReviewData,
  Pet,
  PetCheck,
  PetSatisfaction,
  PetVerdictResult,
  Region,
  Requirement,
  Review,
  ReviewTag,
  TopPlace,
} from '@/data/types';

/**
 * 목 시설의 리뷰 집계. 목 시설은 서버에 없어 `/facilities/{id}/reviews`가 404를 주므로,
 * 로컬 REVIEWS로 서버와 같은 모양을 만들어 친화도 섹션이 정상 렌더되게 한다.
 * 데모(공모전 시연)에서 목 시설이 에러 화면으로 보이면 안 된다.
 */
function mockReviewData(facilityId: number): FacilityReviewData {
  const rs = REVIEWS.filter((r) => r.facilityId === facilityId);
  const avg = (pick: (r: Review) => number) =>
    rs.length === 0 ? 0 : Math.round((rs.reduce((sum, r) => sum + pick(r), 0) / rs.length) * 10) / 10;
  const tagCount = new Map<ReviewTag, number>();
  rs.forEach((r) => r.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)));
  return {
    grade: pawGradeOf(rs),
    categoryAverages: {
      space: avg((r) => r.ratingSpace),
      staff: avg((r) => r.ratingStaff),
      amenity: avg((r) => r.ratingAmenity),
    },
    topTags: [...tagCount.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
    reviews: rs,
    pageInfo: { page: 0, size: rs.length, totalElements: rs.length, hasNext: false },
  };
}

/**
 * 서버 제보 → 앱 Report. 필드가 거의 같지만 nullable 여부가 달라 여기서 확정한다.
 * weight/hasEvidence는 사진·AI 검증(2단계, 미구현)이 있어야 값이 달라지는 필드라 지금은 고정값이다.
 */
function toReport(r: ServerDenialReport): Report {
  return {
    reportId: r.reportId,
    facilityId: r.facilityId,
    type: r.type,
    content: r.content,
    weight: r.weight ?? 2,
    hasEvidence: r.hasEvidence ?? false,
    reason: r.reason,
    mine: r.mine ?? false,
    realtime: r.realtime ?? true,
    status: r.status,
    createdAt: r.createdAt,
  };
}

/** 이름만 아는 시설의 빈 껍데기. 홈 TOP3 캐시와 상세 병합의 기본값으로 쓴다. */
const EMPTY_FACILITY: Facility = {
  facilityId: 0,
  name: '',
  category: 'TOUR',
  address: '',
  phone: null,
  distanceM: null,
  petAllowed: null,
  petConditionRaw: null,
  maxWeight: null,
  requirements: [],
  sido: '',
  sigungu: '',
  confidence: 'ESTIMATED',
  confidenceSource: 'PARSED',
  confirmedAt: null,
};

export interface AppSettings {
  /** 화면 모드 — 라이트/다크/자동(저녁~새벽 다크) */
  themeMode: ThemeMode;
  /** 주변 검색 반경(km) */
  searchRadiusKm: number;
  /**
   * 반려동물 동반 정보가 있는 곳만 보기(서버 `petAllowed=ALLOWED` 필터).
   * 관광공사 4.8만 건 중 동반 정보가 있는 건 9,677건(19.85%)뿐이고 나머지 80%는 PENDING이라,
   * 여행을 계획하는 사용자에겐 그 80%가 노이즈다. 다만 "이 근처에 뭐가 있나"에는 여전히
   * 쓸모가 있어 기본값은 끈 채로 두고, 필요할 때 켜게 한다.
   */
  onlyPetInfo: boolean;
  /** 체크리스트에 계절 맞춤 팁 표시 */
  seasonalTips: boolean;
  notifPush: boolean;
  notifReport: boolean;
  notifNearby: boolean;
  notifMarketing: boolean;
  /** 캘린더: 동반 여행 일정 자동 기록 (사용자 허용 시) */
  autoTravelLog: boolean;
  /** 앱 잠금 — 실행/복귀 시 생체인증 요구 (네이티브만) */
  appLock: boolean;
  /** 글씨 크기 — 앱 전체 텍스트에 같은 배율로 걸린다 */
  fontSize: FontSizeMode;
}

const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'light',
  searchRadiusKm: 3,
  onlyPetInfo: false,
  seasonalTips: true,
  notifPush: true,
  notifReport: true,
  notifNearby: true,
  notifMarketing: false,
  autoTravelLog: true,
  appLock: false,
  fontSize: 'normal',
};

/**
 * 로그인 프로필(페르소나) — 계정 하나 아래에 소비자·사업자 두 모드가 공존한다.
 * 넷플릭스/티빙처럼 앱을 켜면 프로필을 고르고, 고른 프로필에 따라 화면 세트가 달라진다.
 * - consumer: 일반 여행자 앱 (탭: 홈·탐색·반려동물·설정)
 * - owner: 사업자 대시보드 (내 매장 관리·통계) — 매장을 등록해야 생긴다
 */
export type ProfileKind = 'consumer' | 'owner';

export interface Session {
  authed: boolean;
  email: string | null;
  /** 현재 활성 프로필. null이면 아직 안 골랐다는 뜻(프로필 선택 화면으로) */
  activeProfile: ProfileKind | null;
}

/** 계정 프로필 — 닉네임·아바타. 리뷰 작성자명 등에 쓰인다(저장은 백엔드 연동 시) */
export interface Account {
  nickname: string;
  avatarUri: string | null;
}

export type ReportType = 'ENTERED' | 'DENIED' | 'CONDITION_CHANGED';

/** 문 앞에서 거부당한 이유 — 원터치 제보라 서술 대신 코드로 받는다 */
export type DenialReason = 'WEIGHT' | 'BREED' | 'INDOOR' | 'POLICY_CHANGED' | 'CROWDED' | 'OTHER';

export const DENIAL_REASON_LABEL: Record<DenialReason, string> = {
  WEIGHT: '체중 초과',
  BREED: '견종 제한',
  INDOOR: '실내 불가',
  POLICY_CHANGED: '정책이 바뀜',
  CROWDED: '혼잡·자리 없음',
  OTHER: '그 밖의 이유',
};

export interface Report {
  reportId: number;
  facilityId: number;
  type: ReportType;
  content: string;
  /** 증거 사진·AI 검증 여부를 반영한 신뢰도 가중치 (docs/04 4-1) */
  weight: number;
  hasEvidence: boolean;
  /** 거부 제보일 때의 사유 코드 */
  reason: DenialReason | null;
  /** 내가 보낸 제보인지 — 남의 거부는 경고로, 내 거부는 접수 상태로 보여준다 */
  mine: boolean;
  /**
   * 현장에서 거부당한 즉시 보낸 제보인지.
   * 사후 정정 제보와 달리 검토를 기다리지 않고 신뢰도에 바로 반영된다.
   */
  realtime: boolean;
  status: 'PENDING' | 'APPLIED' | 'REJECTED';
  createdAt: string;
}

/** 실시간 거부 경고를 노출하는 기간 — 이보다 오래된 제보는 신뢰도에만 남는다 */
const DENIAL_ALERT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 1주
/** 한 시설에 최대 몇 건의 거부를 경고로 보여줄지 (최신순) */
const MAX_DENIAL_ALERTS = 3;

/**
 * 사업자 셀프 등록 (F5) — 사업자가 진위확인 후 자기 매장의 출입 조건을 직접 확정한다.
 * 모호함이 발생 지점(사업자)에서 소멸하고, 그 시설의 신뢰도가 '확정'으로 올라간다.
 */
export interface BusinessReg {
  facilityId: number;
  /** 진위확인된 사업자등록번호 — 표시용 마스킹만 보관. 원본은 저장하지 않는다 */
  bizNoMasked: string;
  petAllowed: boolean;
  maxWeight: number | null;
  requirements: Requirement[];
  conditionRaw: string;
  confirmedAt: string;
}

/**
 * 반려동물 편의시설 태그 (docs/10 facility_promotions.amenities).
 * 사업자가 소개에서 고르고, 방문자 시설 상세 "사장님이 전하는 우리 매장"에 노출된다.
 */
export type Amenity =
  | 'WATER_BOWL'
  | 'POOP_BAG'
  | 'PET_MENU'
  | 'OUTDOOR_SEAT'
  | 'OFF_LEASH_ZONE'
  | 'PARKING'
  | 'PET_SUPPLIES'
  | 'BLANKET';

export const AMENITY_LABEL: Record<Amenity, string> = {
  WATER_BOWL: '급수대',
  POOP_BAG: '배변봉투',
  PET_MENU: '펫 메뉴',
  OUTDOOR_SEAT: '야외 테라스',
  OFF_LEASH_ZONE: '목줄 프리 공간',
  PARKING: '주차 가능',
  PET_SUPPLIES: '반려용품 비치',
  BLANKET: '방석·담요',
};

/** 사업자 매장 소개·홍보 — 소유 인증된 시설에 1:1 (docs/10 facility_promotions) */
export interface Promotion {
  facilityId: number;
  intro: string;
  amenities: Amenity[];
  /** 데모: 사진은 개수만 관리(실제 업로드는 백엔드). 0이면 사진 없음 */
  photoCount: number;
}

/** 방문 혜택 안내 — MVP는 안내 텍스트만, 쿠폰 발급은 2차 (docs/10 facility_benefits) */
export interface Benefit {
  benefitId: number;
  facilityId: number;
  title: string;
  detail: string;
  active: boolean;
}

export type ReviewReportReason = 'FALSE_INFO' | 'SPAM' | 'ABUSE' | 'PRIVACY' | 'IRRELEVANT';

export const REVIEW_REPORT_REASON_LABEL: Record<ReviewReportReason, string> = {
  FALSE_INFO: '허위 후기',
  SPAM: '광고·스팸',
  ABUSE: '욕설·비방',
  PRIVACY: '개인정보 노출',
  IRRELEVANT: '시설과 무관',
};

export interface NewReview {
  facilityId: number;
  /** 함께 방문한 아이들 (여러 마리 가능) */
  petIds: number[];
  /** 우리 아이 품종·몸무게 공개 여부 (옵트인) */
  showPetInfo: boolean;
  ratingSpace: number;
  ratingStaff: number;
  ratingAmenity: number;
  content: string | null;
  tags: ReviewTag[];
}

interface AppStore {
  /** 내 사용자 id — 내가 쓴 리뷰 구분 등에 쓴다 */
  /** 내 사용자 ID. 서버에서 받기 전에는 `null`이다 — 그때는 내 글 여부를 단정하지 않는다. */
  myUserId: number | null;
  /** 이 리뷰가 내 글인가. 서버 userId를 모를 때는 기기에 남긴 작성 기록으로 가른다. */
  isMyReview: (r: { reviewId: number; userId: number }) => boolean;
  pets: Pet[];
  /** 등록·수정·삭제는 서버가 실패하면 화면을 되돌리고 **던진다** — 호출한 쪽이 안내해야 한다. */
  addPet: (input: Omit<Pet, 'petId'>) => Promise<void>;
  removePet: (petId: number) => Promise<void>;
  updatePet: (petId: number, patch: Partial<Omit<Pet, 'petId'>>) => Promise<void>;

  checks: PetCheck[];
  /** 선택한 여러 마리를 한 번에 판별한다 */
  runCheck: (facilityId: number, petIds: number[]) => Promise<PetCheck | null>;
  /**
   * 판별 이력을 목록에서 지운다.
   *
   * 서버에 삭제 API가 없어 **이 기기에서만 숨긴다.** 지운 id를 남겨두지 않으면 다음에
   * 서버에서 다시 불러와 되살아난다.
   */
  hideCheck: (checkId: number) => void;

  /** 다음 접종이 30일 이내로 다가왔거나 지난 아이들 (홈 알림용) — 임박순 */
  upcomingVaccinations: () => { pet: Pet; dday: number; date: string }[];

  reviews: Review[];
  /** 목데이터 기반 리뷰 (랭킹·카드·사업자 화면 — 해당 엔드포인트 미배포) */
  reviewsOf: (facilityId: number) => Review[];
  /** 시설 상세 친화도 탭용 — 서버 집계(등급·평균·태그·목록). 미로드면 undefined */
  reviewDataOf: (facilityId: number) => FacilityReviewData | undefined;
  /** 이 시설 리뷰 로드가 실패했는지 (목으로 감추지 않고 에러 UI 표시용) */
  reviewErrorOf: (facilityId: number) => boolean;
  /** 시설 리뷰를 서버에서 불러와 캐시한다. 실패하면 목이 아니라 에러로 표시 */
  loadReviews: (facilityId: number) => Promise<void>;
  /** 리뷰 작성/수정(upsert). 자격·소유 오류는 ApiError로 던진다 */
  addReview: (input: NewReview) => Promise<void>;
  removeReview: (reviewId: number, facilityId: number) => Promise<void>;
  /** 해당 시설에 판별 이력이 있어야 리뷰 작성 자격이 생긴다 */
  canReview: (facilityId: number) => boolean;
  myReviewFor: (facilityId: number) => Review | undefined;

  reports: Report[];
  addReport: (
    facilityId: number,
    type: ReportType,
    content: string,
    weight: number,
    hasEvidence: boolean,
  ) => void;
  /** 문 앞에서 거부당한 즉시 보내는 원터치 제보 — 신뢰도를 바로 하향시킨다 */
  reportDenial: (facilityId: number, reason: DenialReason) => Promise<void>;
  /** 최근 1주 내 남이 보낸 현장 거부 제보 — 최신순 최대 3건 (시설 상세 토글) */
  recentDenialsOf: (facilityId: number) => Report[];
  /** 그중 가장 최신 1건 — 홈 알림·목록 카드용 */
  recentDenialOf: (facilityId: number) => Report | undefined;
  /** 시설 상세 진입 시 서버 제보를 받아둔다(목 시설은 건너뛴다) */
  loadDenials: (facilityId: number) => Promise<void>;
  /** 내가 판별받은 시설 중 최근 1주 내 거부가 뜬 곳 — 홈 알림에 쓴다 */
  plannedDenialAlerts: () => { facility: Facility; report: Report }[];
  /** 내가 이 시설에 보낸 현장 거부 제보 */
  myDenialOf: (facilityId: number) => Report | undefined;

  /** (목 폴백용) 신고된 리뷰 id — 데모 시설에서 등급 산정 제외 표시에 쓴다 */
  reportedReviewIds: Set<number>;
  /** 리뷰 신고. 접수에 실패하면 **던진다** — 화면이 접수됐다고 말하면 안 된다. */
  reportReview: (reviewId: number, reason: ReviewReportReason, facilityId?: number) => Promise<void>;

  /** 여권 도장 (게임 요소 1단계). 서버 API가 없어 기기에만 남는다 */
  stamps: Stamp[];
  /**
   * 도장을 찍는다. 지역을 못 알아내면 `null`을 준다 — 엉뚱한 지역에 찍는 것보다 안 찍는 게 낫다.
   * 같은 시설에 이미 찍혀 있으면 그 도장을 그대로 돌려주고 새로 만들지 않는다.
   */
  addStamp: (input: {
    facilityId: number;
    facilityName: string;
    address: string;
    petIds: number[];
    photoUri: string | null;
    /** 찍을 때 시설 근처에 있었는지. 강제하지 않고 표시만 한다 */
    verifiedOnSite: boolean;
  }) => Stamp | null;
  /** 도장첩이 지역을 알아내는 데 쓰는 트리(TourAPI 코드 포함). 못 받았으면 빈 배열 */
  stampRegions: Region[];
  /** 지역 트리 재조회. 못 받으면 도장을 찍을 수 없어 화면에 재시도 경로가 필요하다 */
  reloadStampRegions: () => Promise<void>;
  /** 도장을 기기에 남기지 못했다. 이번 세션에는 보이지만 앱을 다시 켜면 사라진다 */
  stampSaveFailed: boolean;

  /** 반려동물 개인 만족도 (사업자 리뷰와 분리, 본인만 조회) */
  satisfactions: PetSatisfaction[];
  satisfactionOf: (petId: number, facilityId: number) => number | null;
  /** 슬라이더 값 변경 — 로컬은 즉시, 서버 POST(upsert)는 드래그가 멈춘 뒤 디바운스 */
  setSatisfaction: (petId: number, facilityId: number, score: number) => void;
  /** 이 시설에 대한 내 반려동물 만족도를 서버에서 불러온다 (시설 상세 진입 시) */
  loadFacilitySatisfactions: (facilityId: number) => Promise<void>;
  /** 그 아이가 좋아한 곳 TOP N (만족도 높은 순) — 서버 계산값 */
  topPlacesForPet: (petId: number, n?: number) => TopPlace[];

  /** 시설 조회 — 서버 검색결과 캐시 우선, 없으면 목데이터 */
  facilityById: (id: number) => Facility | undefined;
  /** GET /facilities/{id} — 상세를 받아 캐시에 병합한다(검색을 안 거치고 들어온 시설용) */
  loadFacility: (id: number) => Promise<void>;
  /** 서버 데이터를 다시 불러온다 — 홈의 당겨서 새로고침. 최초 조회 실패에서 빠져나올 길이다. */
  reloadAll: () => Promise<void>;
  /** GET /pet-checks/{checkId} — 요약만 있는 이력에 아이별 근거를 채운다(출입증 재열람용) */
  hydrateCheck: (checkId: number) => Promise<void>;
  /** 탐색이 잡은 GPS를 보관 — 상세·코스 빌더에서 권한을 다시 묻지 않고 거리 계산에 쓴다 */
  lastCoords: Coords | null;
  setLastCoords: (c: Coords | null) => void;
  /** 서버에서 받은 시설을 상세 조회용 캐시에 등록 */
  registerFacilities: (fs: Facility[]) => void;

  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;

  /** 사용자가 전화 등으로 직접 확인한 시설 — 신뢰도를 '확정'으로 끌어올린다 */
  userConfirmedIds: Set<number>;
  confirmFacility: (facilityId: number) => void;
  /**
   * 전화를 걸어놓고 아직 "확인했다"는 답을 받지 못한 시설.
   * `Linking.openURL`이 성공했다는 건 다이얼러가 열렸다는 뜻이지 통화가 됐다는 뜻이 아니다 —
   * 열고 바로 취소해도 성공으로 온다. 그래서 전화 앱에서 돌아왔을 때 한 번 물어보고,
   * 사용자가 답해야 신뢰도를 올린다.
   */
  pendingCallConfirm: { facilityId: number; name: string } | null;
  setPendingCallConfirm: (target: { facilityId: number; name: string } | null) => void;
  /** 신뢰도를 즉시 하향시킨 시설 (거부 실시간 피드백에서 사용) */
  downgradedIds: Set<number>;
  downgradeFacility: (facilityId: number) => void;
  /** override를 반영한 시설의 현재 신뢰도 */
  confidenceOf: (f: Facility) => { confidence: Confidence; source: ConfidenceSource; confirmedAt: string | null };

  /** 사업자 셀프 등록 (F5) — 사업자가 확정한 시설의 출입 조건 override */
  businessRegs: Record<number, BusinessReg>;
  registerBusiness: (reg: BusinessReg) => void;
  businessRegOf: (facilityId: number) => BusinessReg | null;
  /** 사업자 확정 조건을 반영한 시설 — 판별·표시는 모두 이걸 기준으로 한다 */
  effectiveFacility: (f: Facility) => Facility;

  /** 매장 소개·홍보 (사업자 대시보드 ②) */
  promotions: Record<number, Promotion>;
  promotionOf: (facilityId: number) => Promotion | null;
  setPromotion: (promotion: Promotion) => void;
  /** 방문 혜택 안내 (사업자 대시보드 ③) */
  benefitsOf: (facilityId: number) => Benefit[];
  addBenefit: (facilityId: number, title: string, detail: string) => void;
  toggleBenefit: (facilityId: number, benefitId: number) => void;
  removeBenefit: (facilityId: number, benefitId: number) => void;

  /** 반려동물 캘린더 — 접종·약·검진·여행 일정 */
  calendarEvents: CalendarEvent[];
  addCalendarEvent: (input: Omit<CalendarEvent, 'eventId'>) => void;
  removeCalendarEvent: (eventId: number) => void;
  updateCalendarEvent: (eventId: number, patch: Partial<Omit<CalendarEvent, 'eventId'>>) => void;
  toggleEventReminder: (eventId: number) => void;
  /** 특정 날짜(YYYY-MM-DD)의 일정 (반복 반영) — 시간순 */
  eventsOn: (date: string) => CalendarEvent[];
  /** 약 복용 기록 토글/조회 (eventId+날짜 단위) */
  toggleMedTaken: (eventId: number, date: string) => void;
  isMedTaken: (eventId: number, date: string) => boolean;

  /** 계정 프로필 (닉네임·아바타) */
  account: Account;
  /** 프로필 수정. 서버가 실패하면 화면을 되돌리고 **던진다** — 호출한 쪽이 안내해야 한다. */
  updateAccount: (patch: Partial<Account>) => Promise<void>;

  /** 로그인 세션 (계정 하나 + 활성 프로필) */
  session: Session;
  /** 저장된 세션을 아직 확인 중. true면 로그인 여부를 판단하면 안 된다 */
  restoring: boolean;
  /** 이 계정이 가진 프로필들 — 소비자는 항상, 사업자는 매장을 등록했을 때 생긴다 */
  availableProfiles: ProfileKind[];
  /** (소셜 데모용) 세션만 설정 — 프로필이 하나면 자동 진입, 둘이면 프로필 선택으로 */
  login: (email: string) => void;
  /** 백엔드 로그인 성공 시 — 토큰 저장 + 세션 설정 */
  /** 로그인 성공. `userId`는 서버가 주기 시작하면 함께 들어온다(지금은 재발급 응답에만 있다). */
  authenticate: (
    email: string,
    tokens: { accessToken: string; refreshToken: string; userId?: number },
  ) => void;
  /** 현재 액세스 토큰(인증 헤더용). 미로그인이면 null */
  accessToken: string | null;
  logout: () => void;
  /** 프로필 선택(넷플릭스식) — 고른 프로필로 화면 세트가 바뀐다 */
  selectProfile: (kind: ProfileKind) => void;
  /** 다시 프로필 선택 화면으로 (다중 프로필일 때 전환용) */
  switchProfile: () => void;
}

/**
 * 내 사용자 ID. **서버가 알려줄 때까지는 모른다(null).**
 *
 * 예전에는 1로 박아뒀다. 그래서 ID가 1이 아닌 사람은 자기 리뷰에 삭제 대신 신고가 뜨고,
 * 사용자 1의 리뷰는 누구에게나 삭제 버튼이 보였다. 모를 때는 남의 리뷰에 삭제가 뜨지
 * 않는 쪽(= 전부 신고)으로 둔다 — 틀린 추측보다 낫다.
 *
 * 지금은 `POST /auth/refresh` 응답에서만 받을 수 있다. 백엔드가 `GET /users/account`에
 * `userId`를 넣어 주면 로그인 직후부터 알 수 있다(요청해 둠).
 */
const AppStoreContext = createContext<AppStore | null>(null);

/**
 * 목 시드를 초기값으로 넣을지.
 *
 * 개발 중에는 서버 없이도 화면을 볼 수 있어야 하지만, 실제 사용자 기기에서는
 * **자기가 만들지 않은 아이·판별 이력·제보·일정이 보이면 안 된다.** 서버 조회가
 * 실패하거나(오프라인·502) 아직 돌아오지 않은 동안 목데이터가 그대로 남아,
 * 새 계정으로 들어와도 "몽이"와 "보리"가 등록돼 있는 것처럼 보였다. 그 아이를 눌러
 * 무언가 하려 하면 서버는 그런 petId를 모른다.
 */
const SEED_MOCK = __DEV__;

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [pets, setPets] = useState<Pet[]>(SEED_MOCK ? INITIAL_PETS : []);
  const [checks, setChecks] = useState<PetCheck[]>(SEED_MOCK ? INITIAL_CHECKS : []);
  // 목록에서 지운 판별 이력. 서버 삭제가 없어 불러온 뒤 걸러낸다.
  const [hiddenCheckIds, setHiddenCheckIds] = useState<number[]>([]);
  const [reviews, setReviews] = useState<Review[]>(SEED_MOCK ? REVIEWS : []);
  // 시설별 서버 리뷰 집계 캐시 (친화도 탭). 시설 상세 진입 시 loadReviews로 채운다.
  const [reviewData, setReviewData] = useState<Record<number, FacilityReviewData>>({});
  // 리뷰 로드에 실패한 시설 — 목으로 감추지 않고 에러 UI로 보여준다
  const [reviewErrors, setReviewErrors] = useState<Set<number>>(new Set());
  const [reports, setReports] = useState<Report[]>(SEED_MOCK ? INITIAL_REPORTS : []);
  const [reportedReviewIds, setReportedReviewIds] = useState<Set<number>>(new Set());
  // 시설 상세 진입 시 그 시설분을 서버에서 채운다(실서비스엔 목 시드가 없다).
  const [satisfactions, setSatisfactions] = useState<PetSatisfaction[]>([]);
  // 여권 도장(게임 요소 1단계). 서버 API가 없어 기기에만 남는다.
  const [stamps, setStamps] = useState<Stamp[]>([]);
  // 도장의 지역 이름을 알아내는 트리. 주소 문자열만으로는 "고양시 덕양구"를 못 가른다.
  const [stampRegions, setStampRegions] = useState<Region[]>([]);
  // 반려동물별 좋아한 곳 TOP3 (홈) — 서버가 시설명·카테고리까지 계산해 내려준다
  const [topPlaces, setTopPlaces] = useState<Record<number, TopPlace[]>>({});
  const [myUserId, setMyUserId] = useState<number | null>(null);
  /**
   * 내가 쓴 리뷰 ID. `myUserId`를 모르는 동안 내 글을 가려내는 수단이다.
   * 리뷰를 쓴 시점에 기록하고 기기에 남긴다 — 앱을 다시 켜도 유지된다.
   */
  const [myReviewIds, setMyReviewIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    let alive = true;
    loadMyReviewIds().then((ids) => {
      if (alive) setMyReviewIds(new Set(ids));
    });
    return () => {
      alive = false;
    };
  }, []);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  /**
   * 저장된 설정을 읽기 전에는 기록하지 않는다. 불러오기 전에 저장하면 기본값이 덮어써서
   * 사용자가 켜둔 앱 잠금·다크모드가 매 실행마다 날아간다.
   */
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    loadSettings(DEFAULT_SETTINGS).then((saved) => {
      if (!alive) return;
      setSettings(saved);
      setSettingsLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (settingsLoaded) void saveSettings(settings);
  }, [settings, settingsLoaded]);
  const [userConfirmedIds, setUserConfirmedIds] = useState<Set<number>>(new Set());
  // 씨드 거부 제보도 신뢰도에 반영돼 있어야 앱을 켜자마자 하향된 상태로 보인다
  const [downgradedIds, setDowngradedIds] = useState<Set<number>>(
    () => new Set(INITIAL_REPORTS.filter((r) => r.realtime).map((r) => r.facilityId)),
  );
  const [businessRegs, setBusinessRegs] = useState<Record<number, BusinessReg>>({});
  const [promotions, setPromotions] = useState<Record<number, Promotion>>({});
  const [benefits, setBenefits] = useState<Record<number, Benefit[]>>({});
  const [session, setSession] = useState<Session>({ authed: false, email: null, activeProfile: null });
  // 백엔드 인증 토큰. 기기에도 남긴다(네이티브 SecureStore / 웹 localStorage) —
  // 남기지 않으면 새로고침·앱 재실행마다 로그인해야 한다.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // 저장된 세션을 확인하는 동안은 "아직 모름"이다. 이 값이 false가 되기 전에
  // 라우터가 판단하면 로그인돼 있는 사용자를 로그인 화면으로 한 번 튕긴다.
  const [restoring, setRestoring] = useState(true);
  // 세션이 바뀔 때마다 오른다. 복원은 await가 두 번 있어 그 사이에 로그인·로그아웃이
  // 끼어들 수 있는데, 그때 복원이 늦게 끝나면 **옛 계정으로 되돌려놓는다.**
  // 네이버 로그인에서 돌아오는 흐름이 복원과 나란히 도는 실제 경로가 있다.
  const sessionRev = useRef(0);
  const refreshTokenRef = useRef<string | null>(null);
  const [account, setAccount] = useState<Account>({ nickname: '나', avatarUri: null });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(SEED_MOCK ? INITIAL_CAL_EVENTS : []);
  /**
   * 일정·복용 기록을 기기에 남긴다.
   *
   * 서버 API는 있지만 연동은 1.1이다. 그때까지 상태로만 두면 앱을 끄는 순간 사라지는데,
   * 만든 사람은 저장되지 않았다는 걸 알 방법이 없다. 불러오기 전에는 쓰지 않는다 —
   * 빈 배열이 저장된 값을 덮는다.
   */
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  // 약 복용 기록 — "eventId:YYYY-MM-DD" 집합
  const [medLog, setMedLog] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [events, log] = await Promise.all([loadCalendarEvents<CalendarEvent>(), loadMedLog()]);
      if (!alive) return;
      if (events) setCalendarEvents(events);
      if (log.length > 0) setMedLog(new Set(log));
      setCalendarLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (calendarLoaded) void saveCalendarEvents(calendarEvents);
  }, [calendarEvents, calendarLoaded]);
  useEffect(() => {
    if (calendarLoaded) void saveMedLog([...medLog]);
  }, [medLog, calendarLoaded]);
  const nextEventId = useRef(INITIAL_CAL_EVENTS.length + 1);
  const nextBenefitId = useRef(1);
  const nextPetId = useRef(INITIAL_PETS.length + 1);
  // 로컬 전용 판별은 음수 id를 쓴다 — 서버 checkId와 겹치면 이력 병합이 어긋난다.
  // INITIAL_CHECKS가 이미 -1..-n을 쓰고 있으므로 그 다음부터 발급해야 한다.
  const nextCheckId = useRef(INITIAL_CHECKS.length + 1);
  const nextReportId = useRef(INITIAL_REPORTS.length + 1);

  // 최신 pets를 콜백에서 읽기 위한 미러(수정 시 기존 값 + patch 병합용)
  const petsRef = useRef<Pet[]>(pets);
  petsRef.current = pets;

  // 서버 검색·홈 TOP3 등으로 알게 된 시설을 상세 조회용으로 캐시한다.
  // (아래 registerFacilities/facilityById가 쓰고, loadTopPlaces도 최소 정보로 채운다)
  const facilityCache = useRef<Map<number, Facility>>(new Map());
  // 캐시가 ref라 값이 바뀌어도 리렌더가 안 된다. 상세를 받아오면 이 숫자를 올려 화면을 다시 그린다.
  const [facilityVersion, setFacilityVersion] = useState(0);
  // 탐색 화면이 잡은 GPS를 보관한다. 상세에서 다시 권한을 묻지 않고 거리(distanceM)를 받기 위한 것.
  const [lastCoords, setLastCoords] = useState<Coords | null>(null);

  /**
   * 서버에서 내 반려동물을 불러와 로컬 상태를 채운다.
   *
   * **로그인 전에는 부르지 않는다.** 예전에는 무조건 불러서 401을 받았는데, 그 401이
   * 재발급 실패로 이어지고 그 결과가 늦게 도착하면 **그 사이 새로 로그인한 세션까지**
   * 만료 처리됐다. 401을 만들 이유가 없는 호출은 아예 하지 않는 게 맞다.
   * __DEV__에선 dev 토큰이 있어 로그인 없이도 조회된다.
   */
  useEffect(() => {
    if (!session.authed && !(__DEV__ && DEV_TOKEN)) return;
    let alive = true;
    petsApi
      .list()
      .then((serverPets) => {
        if (alive) setPets(serverPets);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [session.authed]);

  // 서버에서 판별 이력을 불러온다. 목록이 주는 건 **요약뿐**이라 아이별 판별(verdicts)이
  // 비어 있다 — 필요할 때 hydrateCheck(GET /pet-checks/{checkId})로 채운다.
  //
  // 그래서 덮어쓰지 않고 **합친다.** 이번 세션에서 방금 판별한 항목은 상세를 갖고 있는데,
  // 서버 요약으로 덮으면 그 자리에서 출입증이 빈 화면이 된다. 같은 checkId면 로컬을 남긴다.
  useEffect(() => {
    if (!session.authed) return;
    let alive = true;
    aiApi
      .history({ limit: 20 })
      .then(({ items }) => {
        if (!alive) return;
        setChecks((prev) => {
          const local = new Map(prev.map((c) => [c.checkId, c]));
          const merged = items.map((it): PetCheck => {
            const mine = local.get(it.checkId);
            // 요약 필드는 서버를 따르고, 서버에 없는 상세만 로컬에서 가져온다.
            // 특히 createdAt은 서버 값을 써야 한다 — 로컬은 toISOString()이라 UTC고
            // 서버는 타임존 없는 현지 시각이라, 섞으면 정렬이 9시간 어긋난다.
            return mine
              ? { ...mine, ...it }
              : { ...it, verdicts: [], checklist: [], tips: [] };
          });
          // 서버에 없는 로컬 전용 판별(목 시설·사업자 확정 조건 경로)은 남긴다.
          // 이들의 checkId는 음수라 서버 항목과 겹치지 않는다.
          const localOnly = prev.filter((c) => c.checkId < 0);
          // 문자열이 아니라 시각으로 비교한다. 서버는 타임존 없는 현지시각,
          // 앱은 toISOString()의 UTC라 형식이 달라 — 문자열로 세우면 9시간 안쪽에서
          // 더 오래된 항목이 위로 올라온다. Date.parse는 둘 다 올바른 시점으로 읽는다.
          return [...merged, ...localOnly].sort(
            (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
          );
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [session.authed]);

  /**
   * 반려동물 등록·수정·삭제.
   *
   * 셋 다 **실패를 삼키지 않는다.** 예전에는 화면에 먼저 반영하고 서버 오류를 버려서,
   * 오프라인에서 저장해도 폼이 닫히고 성공한 것처럼 보였다. 등록은 잠깐 나타났다
   * 사라지고, 수정·삭제는 로컬 변경이 남아 다음 실행에 서버의 옛 정보가 돌아왔다.
   * 화면에는 낙관적으로 먼저 반영하되, 실패하면 되돌리고 던진다.
   */
  const addPet = useCallback(async (input: Omit<Pet, 'petId'>) => {
    const tempId = -nextPetId.current++; // 음수 임시 id — 서버 양수 id와 충돌 방지
    setPets((prev) => [...prev, { ...input, petId: tempId }]);
    try {
      const r = await petsApi.create(input);
      setPets((prev) => prev.map((p) => (p.petId === tempId ? { ...p, petId: r.petId } : p)));
    } catch (e) {
      setPets((prev) => prev.filter((p) => p.petId !== tempId));
      throw e;
    }
  }, []);

  const removePet = useCallback(async (petId: number) => {
    const before = petsRef.current;
    setPets((prev) => prev.filter((p) => p.petId !== petId));
    if (petId <= 0) return; // 서버에 없는 임시 항목
    try {
      await petsApi.remove(petId);
    } catch (e) {
      setPets(before);
      throw e;
    }
  }, []);

  const updatePet = useCallback(async (petId: number, patch: Partial<Omit<Pet, 'petId'>>) => {
    const before = petsRef.current;
    setPets((prev) => prev.map((p) => (p.petId === petId ? { ...p, ...patch } : p)));
    const existing = before.find((p) => p.petId === petId);
    if (!existing || petId <= 0) return;
    const { petId: _omit, ...full } = { ...existing, ...patch };
    try {
      await petsApi.update(petId, full);
    } catch (e) {
      setPets(before);
      throw e;
    }
  }, []);

  const upcomingVaccinations = useCallback(() => {
    return pets
      .map((pt) => ({ pet: pt, dday: vaccinationDday(pt), date: nextVaccinationOf(pt) }))
      .filter(
        (x): x is { pet: Pet; dday: number; date: string } =>
          x.dday !== null && x.date !== null && x.dday <= 30,
      )
      .sort((a, b) => a.dday - b.dday);
  }, [pets]);

  const runCheck = useCallback(
    async (facilityId: number, petIds: number[]): Promise<PetCheck | null> => {
      // 서버 시설(검색·홈 TOP3·상세)은 목데이터에 없다. 캐시를 먼저 보지 않으면
      // 실제 시설에서 판별 버튼이 아무 반응 없이 끝난다.
      const base = facilityCache.current.get(facilityId) ?? FACILITIES.find((f) => f.facilityId === facilityId);
      const chosen = pets.filter((p) => petIds.includes(p.petId));
      if (!base || chosen.length === 0) return null;

      // 사업자가 확정한 조건이 있으면 그 조건으로 판별한다 (F5)
      const reg = businessRegs[facilityId];
      const facility: Facility = reg
        ? {
            ...base,
            petAllowed: reg.petAllowed,
            maxWeight: reg.maxWeight,
            requirements: reg.requirements,
            petConditionRaw: reg.conditionRaw,
          }
        : base;

      // 목 시설은 서버에 없다. 데모·시연 경로를 살려두려고 로컬 규칙 엔진으로 판별한다.
      // 목을 걷어낼 때(이슈 #15) 이 분기만 지우면 된다.
      //
      // 사업자가 조건을 확정한 시설도 로컬로 돈다. 그 조건은 아직 서버에 올라가지 않아
      // (owner/* API 미배포) 서버가 관광공사 원문으로만 판별하면 사업자 확정이 무시된다.
      if (isMockFacilityId(facilityId) || reg) {
        const { verdicts, overall, checklist, tips } = judgeGroup(chosen, facility);
        const check: PetCheck = {
          checkId: -nextCheckId.current++,
          facilityId,
          petIds: chosen.map((p) => p.petId),
          verdicts,
          overall,
          checklist,
          tips,
          createdAt: new Date().toISOString(),
        };
        setChecks((prev) => [check, ...prev]);
        return check;
      }

      // 서버 판별. overall도 서버가 정하므로 앱이 다시 계산하지 않는다.
      const res = await aiApi.check(facilityId, chosen.map((p) => p.petId));

      // 응답에 checklist·tips가 없다(명세에 미구현으로 명시). 앱이 만들되 **서버가 준
      // conditions를 입력으로** 쓴다 — facility.requirements로 다시 만들면 판별과 안내가
      // 어긋난다. 가장 관대한 결과를 기준으로 삼는 것은 로컬 judgeGroup과 같은 규칙이다.
      const best = res.verdicts.reduce<PetVerdictResult | null>(
        (b, v) => (b === null || CHECK_RANK[v.result] < CHECK_RANK[b.result] ? v : b),
        null,
      );
      const { checklist, tips } = buildChecklist(
        best ?? { result: 'DENIED', reason: '', conditions: [] },
        facility,
      );

      const check: PetCheck = {
        checkId: res.checkId, // 서버가 발급한 id — 이력 조회·출입증이 이 값을 쓴다
        facilityId,
        petIds: chosen.map((p) => p.petId),
        verdicts: res.verdicts,
        overall: res.overall,
        checklist,
        tips,
        createdAt: new Date().toISOString(),
      };
      setChecks((prev) => [check, ...prev]);
      return check;
    },
    [pets, businessRegs],
  );

  const reviewsOf = useCallback(
    (facilityId: number) => reviews.filter((r) => r.facilityId === facilityId),
    [reviews],
  );

  // 서버에서 시설 리뷰 집계를 불러와 캐시한다.
  // 실패하면 '목데이터'로 감추지 않고 에러로 표시한다 — 실서비스엔 목이 없어야 하고,
  // 서버 장애가 가짜 데이터에 가려지면 사용자가 문제를 인지할 수 없기 때문이다.
  const loadReviews = useCallback(async (facilityId: number) => {
    // 재시도 시 이전 에러를 지워 로딩 상태로 되돌린다
    setReviewErrors((prev) => {
      if (!prev.has(facilityId)) return prev;
      const next = new Set(prev);
      next.delete(facilityId);
      return next;
    });
    // 목 시설은 서버에 없다. 호출하면 FACILITY4041이 떨어지고 친화도 섹션이 통째로
    // "불러오지 못했어요 + 다시 시도"(절대 성공하지 않는다)가 된다. 로컬 목 리뷰로 집계를 만든다.
    if (isMockFacilityId(facilityId)) {
      setReviewData((prev) => ({ ...prev, [facilityId]: mockReviewData(facilityId) }));
      return;
    }
    try {
      const data = await reviewsApi.list(facilityId);
      setReviewData((prev) => ({ ...prev, [facilityId]: data }));
    } catch {
      setReviewErrors((prev) => new Set(prev).add(facilityId));
    }
  }, []);

  const reviewDataOf = useCallback(
    (facilityId: number) => reviewData[facilityId],
    [reviewData],
  );

  const reviewErrorOf = useCallback(
    (facilityId: number) => reviewErrors.has(facilityId),
    [reviewErrors],
  );

  const canReview = useCallback(
    (facilityId: number) => checks.some((c) => c.facilityId === facilityId),
    [checks],
  );

  const myReviewFor = useCallback(
    (facilityId: number) =>
      reviews.find((r) => r.facilityId === facilityId && myUserId != null && r.userId === myUserId),
    [reviews],
  );

  // 작성/수정(upsert) — 서버가 자격(REVIEW4001)·소유(PET4002)를 검사하므로 오류는 그대로 던져 화면에서 처리.
  const addReview = useCallback(
    async (input: NewReview) => {
      // 목 시설은 서버에 없다. 그대로 보내면 "존재하지 않는 시설입니다"가 사용자에게 노출된다
      // (이 함수는 자격·소유 오류를 화면에서 처리하려고 의도적으로 throw한다).
      if (isMockFacilityId(input.facilityId)) {
        await loadReviews(input.facilityId);
        return;
      }
      const created = await reviewsApi.create(input.facilityId, {
        petIds: input.petIds,
        showPetInfo: input.showPetInfo,
        ratingSpace: input.ratingSpace,
        ratingStaff: input.ratingStaff,
        ratingAmenity: input.ratingAmenity,
        content: input.content ?? '',
        tags: input.tags,
      });
      // 방금 쓴 글의 id를 남긴다. 서버가 내 userId를 알려주기 전까지 "내 리뷰" 판정에 쓴다.
      if (typeof created?.reviewId === 'number') {
        setMyReviewIds((prev) => {
          const next = new Set(prev).add(created.reviewId);
          void saveMyReviewIds([...next]);
          return next;
        });
      }
      await loadReviews(input.facilityId);
    },
    [loadReviews],
  );

  /** 리뷰 삭제. 실패를 삼키지 않는다 — 지워지지도 않았는데 지워진 것처럼 보이면 안 된다. */
  /**
   * 이 리뷰가 내 글인가.
   *
   * 서버 userId를 알면 그걸 쓰고, 모르면 기기에 남긴 작성 기록으로 가른다.
   * 둘 다 없으면 **내 글이 아니라고 본다** — 남의 글에 삭제 버튼을 띄우는 쪽이 더 나쁘다.
   */
  const isMyReview = useCallback(
    (r: { reviewId: number; userId: number }) =>
      (myUserId != null && r.userId === myUserId) || myReviewIds.has(r.reviewId),
    [myUserId, myReviewIds],
  );

  const removeReview = useCallback(
    async (reviewId: number, facilityId: number) => {
      await reviewsApi.remove(reviewId);
      await loadReviews(facilityId);
    },
    [loadReviews],
  );

  const addReport = useCallback(
    (
      facilityId: number,
      type: ReportType,
      content: string,
      weight: number,
      hasEvidence: boolean,
    ) => {
      setReports((prev) => [
        {
          reportId: nextReportId.current++,
          facilityId,
          type,
          content,
          weight,
          hasEvidence,
          reason: null,
          mine: true,
          realtime: false,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [],
  );

  // 최근 1주 내 남의 현장 거부를 최신순 최대 3건 (시설 상세에서 토글로 펼쳐 본다)
  /**
   * 서버에서 받은 시설별 거부 제보. 목 시설은 서버에 없으므로 로컬 reports를 그대로 쓴다
   * (판별과 같은 분기다). 서버 시설은 이 캐시가 진실이고, 비어 있으면 진짜로 제보가 없는 것이다.
   */
  const [serverDenials, setServerDenials] = useState<Record<number, { recent: Report[]; mine: Report | null }>>({});

  /**
   * 시설별 제보 변경 세대. 제보가 성공하면 올린다.
   * 화면에 들어오자마자 조회가 시작된 상태에서 사용자가 제보하면, 먼저 떠난 조회가 나중에
   * 도착해 방금 접수한 mine을 조회 시점의 null로 덮어쓴다 — 완료 카드가 다시 입력 폼으로
   * 바뀌고, 사용자는 다시 눌렀다가 REPORT4001(24시간 중복)을 받는다.
   */
  const denialGen = useRef<Record<number, number>>({});

  const loadDenials = useCallback(async (facilityId: number) => {
    if (isMockFacilityId(facilityId)) return;
    const gen = denialGen.current[facilityId] ?? 0;
    try {
      const [recent, mine] = await Promise.all([
        denialApi.recent(facilityId),
        denialApi.mine(facilityId),
      ]);
      // 조회가 도는 사이 제보가 접수됐으면 이 응답은 이미 낡았다
      if ((denialGen.current[facilityId] ?? 0) !== gen) return;
      setServerDenials((prev) => ({
        ...prev,
        [facilityId]: { recent: recent.map(toReport), mine: mine ? toReport(mine) : null },
      }));
    } catch {
      // 경고를 못 받아도 화면은 떠야 한다. 다만 조용히 빈 값으로 두지 않고 캐시를 만들지 않아,
      // "제보가 없다"와 "못 받았다"를 구분한다.
    }
  }, []);

  const recentDenialsOf = useCallback(
    (facilityId: number): Report[] =>
      serverDenials[facilityId]?.recent ??
      reports
        .filter(
          (r) =>
            r.facilityId === facilityId &&
            r.type === 'DENIED' &&
            r.realtime &&
            !r.mine &&
            Date.now() - new Date(r.createdAt).getTime() < DENIAL_ALERT_WINDOW_MS,
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_DENIAL_ALERTS),
    [reports, serverDenials],
  );

  // 가장 최신 1건 (홈 알림·목록 카드용) — 목록의 첫 번째
  const recentDenialOf = useCallback(
    (facilityId: number): Report | undefined => recentDenialsOf(facilityId)[0],
    [recentDenialsOf],
  );

  /**
   * 서버가 계산해 둔 거부 경고. `GET /me/denial-alerts`.
   *
   * 예전에는 이 API를 정의만 해두고 부르지 않았다. 그래서 앱을 다시 켜면 거부 캐시가
   * 비어 있어 홈 종 배지와 알림 목록이 늘 "새로운 알림이 없어요"였다 — 시설 상세를
   * 직접 열어 loadDenials가 돌기 전에는 경고를 볼 방법이 없었다.
   */
  const [serverAlerts, setServerAlerts] = useState<DenialAlert[]>([]);
  useEffect(() => {
    if (!session.authed) return;
    let alive = true;
    denialApi
      .alerts()
      .then((list) => {
        if (alive) setServerAlerts(list);
      })
      .catch(() => {
        // 못 받으면 아래 로컬 계산분만 보인다. 알림 화면을 막지는 않는다.
      });
    return () => {
      alive = false;
    };
  }, [session.authed]);

  // 내가 판별받은(=가려던) 시설 중, 남의 현장 거부가 1주 내 들어온 곳.
  // 위치(GPS)가 아니라 "판별 이력"으로 '가려던 곳'을 판단한다.
  const plannedDenialAlerts = useCallback((): { facility: Facility; report: Report }[] => {
    const seen = new Set<number>();
    const out: { facility: Facility; report: Report }[] = [];
    for (const c of checks) {
      if (seen.has(c.facilityId)) continue;
      const report = recentDenialOf(c.facilityId);
      if (!report) continue;
      // 캐시(서버에서 받은 실제 시설) 우선. 목 배열만 보면 관광공사 시설의 거부 경고가
      // 홈 종 배지와 알림 목록에서 통째로 빠진다 — 시설 상세에서는 보이는데 홈엔 안 떴다.
      const facility =
        facilityCache.current.get(c.facilityId) ?? FACILITIES.find((f) => f.facilityId === c.facilityId);
      if (!facility) continue;
      seen.add(c.facilityId);
      out.push({ facility, report });
    }
    // 서버가 준 경고를 합친다. 판별 이력이 아직 안 불러와졌어도 이쪽은 뜬다.
    for (const a of serverAlerts) {
      if (seen.has(a.facility.facilityId)) continue;
      const facility =
        facilityCache.current.get(a.facility.facilityId) ??
        FACILITIES.find((f) => f.facilityId === a.facility.facilityId);
      if (!facility) continue;
      seen.add(a.facility.facilityId);
      out.push({
        facility,
        report: {
          reportId: a.report.reportId,
          facilityId: a.facility.facilityId,
          type: 'DENIED',
          content: '',
          weight: 1,
          hasEvidence: false,
          createdAt: a.report.createdAt,
        } as Report,
      });
    }
    return out;
  }, [checks, recentDenialOf, serverAlerts]);

  const myDenialOf = useCallback(
    (facilityId: number) => {
      const cached = serverDenials[facilityId];
      if (cached) return cached.mine ?? undefined;
      return reports.find((r) => r.facilityId === facilityId && r.type === 'DENIED' && r.realtime && r.mine);
    },
    [reports, serverDenials],
  );

  /**
   * 리뷰 신고. **접수를 확인한 뒤에 화면을 바꾼다.**
   *
   * 예전에는 먼저 신고한 것으로 표시하고 요청 실패를 삼켰다. 네트워크가 끊겨 있어도
   * "신고 접수 · 등급 산정 제외"로 바뀌고 다시 신고할 버튼도 사라져, 접수되지 않은
   * 신고를 접수됐다고 말했다. 목록 새로고침도 신고가 끝나기 전에 나갔다.
   * (서버는 신고해도 바로 제외하지 않고 관리자 승인 후 등급에서 뺀다 — docs/04 4-2)
   */
  const reportReview = useCallback(
    async (reviewId: number, reason: ReviewReportReason, facilityId?: number) => {
      await reviewsApi.report(reviewId, reason);
      setReportedReviewIds((prev) => new Set(prev).add(reviewId));
      if (facilityId !== undefined) await loadReviews(facilityId);
    },
    [loadReviews],
  );

  const satisfactionOf = useCallback(
    (petId: number, facilityId: number) =>
      satisfactions.find((s) => s.petId === petId && s.facilityId === facilityId)?.score ?? null,
    [satisfactions],
  );

  // 시설 상세 진입 시 그 시설에 대한 내 반려동물 만족도를 서버에서 채운다.
  const loadFacilitySatisfactions = useCallback(async (facilityId: number) => {
    if (isMockFacilityId(facilityId)) return; // 서버에 없다 — 404를 부르지 않는다
    try {
      const items = await satisfactionApi.ofFacility(facilityId);
      setSatisfactions((prev) => {
        // 이 시설분은 서버 값으로 교체하고, 기록된(recorded) 것만 로컬에 남긴다
        const rest = prev.filter((s) => s.facilityId !== facilityId);
        const recorded = items
          .filter((it) => it.recorded && it.score !== null)
          .map((it) => ({ petId: it.petId, facilityId, score: it.score as number }));
        return [...rest, ...recorded];
      });
    } catch {
      // 실패해도 조용히 — 슬라이더는 '기록 전'으로 보인다
    }
  }, []);

  const loadTopPlaces = useCallback(async () => {
    try {
      const pets = await satisfactionApi.topPlaces();
      const map: Record<number, TopPlace[]> = {};
      pets.forEach((pet) => {
        map[pet.petId] = pet.topFacilities.map((f) => ({
          facility: { facilityId: f.facilityId, name: f.name, category: f.category },
          score: f.score,
        }));
        // TOP3 시설은 실제 서버 시설이라 검색 캐시엔 없을 수 있다. 상세 화면이 열리도록
        // 이름·카테고리만 담은 최소 시설을 등록한다(검색으로 받은 완전한 정보는 덮지 않음).
        // 시설 상세 조회 API가 배포되면 상세에서 원문·조건까지 다시 채우면 된다.
        pet.topFacilities.forEach((f) => {
          if (facilityCache.current.has(f.facilityId)) return;
          facilityCache.current.set(f.facilityId, {
            ...EMPTY_FACILITY,
            facilityId: f.facilityId,
            name: f.name,
            category: f.category,
          });
        });
      });
      setTopPlaces(map);
    } catch {
      // 실패 시 기존 캐시 유지
    }
  }, []);

  // 슬라이더는 드래그 중 값이 연속으로 바뀐다 → 로컬은 즉시 반영하고, 서버 upsert는
  // 실패 시 되돌릴 직전 값을 콜백에서 읽기 위한 미러
  const satisfactionsRef = useRef<PetSatisfaction[]>(satisfactions);
  satisfactionsRef.current = satisfactions;

  // 마지막 변경 뒤 600ms 디바운스로 한 번만 보낸다(요청 폭주 방지).
  const satTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const setSatisfaction = useCallback(
    (petId: number, facilityId: number, score: number) => {
      setSatisfactions((prev) => {
        const rest = prev.filter((s) => !(s.petId === petId && s.facilityId === facilityId));
        return [...rest, { petId, facilityId, score }];
      });
      // 로컬 상태는 위에서 갱신했다. 목 시설은 서버 전송만 건너뛴다 — 보내면 404라
      // 슬라이더가 조용히 실패해 항상 '기록 전'으로 보인다.
      if (isMockFacilityId(facilityId)) return;
      const key = `${petId}:${facilityId}`;
      // 되돌릴 지점을 지금 잡아둔다. 디바운스 뒤에 읽으면 그 사이 변경분까지 지워진다.
      const before = satisfactionsRef.current.find(
        (s2) => s2.petId === petId && s2.facilityId === facilityId,
      );
      const timers = satTimers.current;
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          satisfactionApi
            .set(facilityId, petId, score)
            .then(() => loadTopPlaces()) // 기록이 바뀌면 홈 TOP3도 갱신
            .catch(() => {
              /**
               * 저장에 실패하면 **화면도 되돌린다.**
               *
               * 예전에는 실패를 버려서, 오프라인에서 슬라이더를 움직여도 점수가 기록된
               * 것처럼 남았다. 다음 실행에 사라지는데 사용자는 왜인지 알 수 없다.
               * 그 사이 같은 자리를 또 바꿨으면(예약이 새로 걸렸으면) 건드리지 않는다.
               */
              if (satTimers.current.has(key)) return;
              setSatisfactions((prev) => {
                const rest = prev.filter((s2) => !(s2.petId === petId && s2.facilityId === facilityId));
                return before ? [...rest, before] : rest;
              });
            });
        }, 600),
      );
    },
    [loadTopPlaces],
  );

  const topPlacesForPet = useCallback(
    (petId: number, n = 3) => (topPlaces[petId] ?? []).slice(0, n),
    [topPlaces],
  );

  /**
   * 홈 "좋아한 곳 TOP3"를 로그인 시 서버에서 미리 받아둔다(반려동물 카드 스택 → 한 번에).
   *
   * **로그인 전에는 부르지 않는다.** 의존성에 session.authed만 있고 가드가 없어서, 앱이
   * 뜨자마자 토큰 없이 GET /pets/satisfactions가 나가 401(COMMON401)이 찍혔다.
   * 인증 헤더를 안 붙인 게 아니라 붙일 토큰이 아직 없던 것이다.
   * 반려동물·회원정보 조회와 같은 이유다 — 늦게 온 401이 새 세션을 만료시킬 수도 있다.
   */
  useEffect(() => {
    if (!session.authed && !(__DEV__ && DEV_TOKEN)) return;
    void loadTopPlaces();
  }, [session.authed, loadTopPlaces]);

  // 서버 검색으로 받은 시설을 상세 조회용으로 캐시한다(탐색 목록에서 탭 → 상세에서 재조회).
  const registerFacilities = useCallback((fs: Facility[]) => {
    fs.forEach((f) => facilityCache.current.set(f.facilityId, f));
  }, []);
  const facilityById = useCallback(
    (id: number): Facility | undefined =>
      facilityCache.current.get(id) ?? FACILITIES.find((f) => f.facilityId === id),
    // facilityVersion은 값을 쓰지 않지만, 캐시가 ref라 이게 없으면 상세를 받아와도 화면이 다시 그려지지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facilityVersion],
  );

  // GET /facilities/{id} — 검색을 안 거치고 들어온 시설(홈 TOP3·알림·딥링크)의 빈 상세를 채운다.
  // 상세 응답엔 maxWeight·requirements가 없으므로 **덮어쓰지 않고 병합**한다. 덮으면 탐색에서
  // 들어온 시설의 체중 제한이 사라져 판별이 통과로 뒤집힌다.
  /**
   * 서버 데이터를 다시 불러온다. 홈의 당겨서 새로고침이 쓴다.
   *
   * 예전에는 800ms 기다리는 연출뿐이었다. 지하철에서 앱을 처음 열어 조회가 실패하면
   * 앱을 완전히 껐다 켜기 전까지 빈 화면이 이어졌다 — 네트워크가 돌아와도 방법이 없었다.
   */
  const reloadAll = useCallback(async () => {
    if (!session.authed && !(__DEV__ && DEV_TOKEN)) return;
    await Promise.all([
      petsApi
        .list()
        .then(setPets)
        .catch(() => {}),
      accountApi
        .get()
        .then((a) => setAccount({ nickname: a.nickname, avatarUri: a.avatarUri }))
        .catch(() => {}),
      denialApi
        .alerts()
        .then(setServerAlerts)
        .catch(() => {}),
    ]);
  }, [session.authed]);

  const loadFacility = useCallback(async (id: number) => {
    if (!Number.isInteger(id) || id <= 0) return; // 숫자가 아니면 서버가 400이 아니라 500을 낸다
    // 목 시설은 서버에 없다. 호출해봐야 404고, 혹시 같은 ID가 있으면 남의 시설이 병합된다.
    if (isMockFacilityId(id)) return;
    try {
      const detail = await facilitiesApi.detail(id, lastCoords ?? undefined);
      const base = facilityCache.current.get(id) ?? FACILITIES.find((f) => f.facilityId === id);
      const merged: Facility = {
        ...(base ?? EMPTY_FACILITY),
        ...detail,
        // 좌표를 못 실어 보냈으면 서버가 거리를 null로 준다 → 검색으로 알던 거리를 유지.
        // ??를 쓰는 이유: 시설 앞에 서 있어 실제 거리가 0이면 그 0을 그대로 써야 한다.
        // 마지막을 0으로 떨어뜨리지 않는다 — base가 홈 TOP3의 빈 껍데기면 그 0은 '모른다'의
        // 자리표시자라, 여기서 0을 쓰면 "거리 없음"이 "0m"로 둔갑한다.
        distanceM: detail.distanceM ?? base?.distanceM ?? null,
        // 주소도 같다 — 상세가 주소를 안 주면(null) 검색으로 알던 주소를 지우지 않는다.
        address: detail.address ?? base?.address ?? '',
        latitude: detail.latitude ?? base?.latitude,
        longitude: detail.longitude ?? base?.longitude,
      };
      facilityCache.current.set(id, merged);
      setFacilityVersion((v) => v + 1);
    } catch {
      // 실패해도 조용히 — 캐시에 있던 정보로 화면은 그대로 뜬다(데모 안전)
    }
  }, [lastCoords]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const [pendingCallConfirm, setPendingCallConfirm] = useState<{ facilityId: number; name: string } | null>(null);

  const confirmFacility = useCallback((facilityId: number) => {
    setUserConfirmedIds((prev) => new Set(prev).add(facilityId));
    setDowngradedIds((prev) => {
      if (!prev.has(facilityId)) return prev;
      const next = new Set(prev);
      next.delete(facilityId);
      return next;
    });
  }, []);

  const downgradeFacility = useCallback((facilityId: number) => {
    setDowngradedIds((prev) => new Set(prev).add(facilityId));
    setUserConfirmedIds((prev) => {
      if (!prev.has(facilityId)) return prev;
      const next = new Set(prev);
      next.delete(facilityId);
      return next;
    });
  }, []);

  // downgradeFacility 를 쓰므로 그 아래에 둔다
  const reportDenial = useCallback(
    async (facilityId: number, reason: DenialReason) => {
      // 목 시설은 서버에 없다. 시연 경로를 살려두려고 로컬로 접수한다(판별과 같은 분기).
      if (isMockFacilityId(facilityId)) {
        setReports((prev) => [
          {
            reportId: nextReportId.current++,
            facilityId,
            type: 'DENIED',
            content: `현장 거부 · ${DENIAL_REASON_LABEL[reason]}`,
            // 현장에서 바로 보낸 제보는 시점이 붙어 있어 사후 기억보다 정확하다 → 사진 없이도 가중치 2
            weight: 2,
            hasEvidence: false,
            reason,
            mine: true,
            realtime: true,
            // 검토를 기다리지 않고 신뢰도에 즉시 반영되므로 접수 시점부터 APPLIED
            status: 'APPLIED',
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        downgradeFacility(facilityId);
        return;
      }

      // 서버 시설은 서버가 접수하고 신뢰도도 서버가 계산한다(시설 상세의 confidenceSource가
      // DENIAL_REPORT로 내려온다). 실패는 삼키지 않고 던져서 화면이 알려주게 한다 —
      // 접수되지 않았는데 "접수됐다"고 보여주면 사용자는 경고가 남에게 전달됐다고 믿는다.
      const created = await denialApi.report(facilityId, reason);
      // 진행 중이던 조회가 이 결과를 덮지 못하게 세대를 올린다
      denialGen.current[facilityId] = (denialGen.current[facilityId] ?? 0) + 1;
      setServerDenials((prev) => {
        const cur = prev[facilityId] ?? { recent: [], mine: null };
        return { ...prev, [facilityId]: { ...cur, mine: toReport(created) } };
      });
      downgradeFacility(facilityId);
    },
    [downgradeFacility],
  );

  const registerBusiness = useCallback((reg: BusinessReg) => {
    setBusinessRegs((prev) => ({ ...prev, [reg.facilityId]: reg }));
    // 사업자가 조건을 확정했으니, 그동안의 거부 하향은 해소한다
    setDowngradedIds((prev) => {
      if (!prev.has(reg.facilityId)) return prev;
      const next = new Set(prev);
      next.delete(reg.facilityId);
      return next;
    });
  }, []);

  const businessRegOf = useCallback(
    (facilityId: number) => businessRegs[facilityId] ?? null,
    [businessRegs],
  );

  const effectiveFacility = useCallback(
    (f: Facility): Facility => {
      const reg = businessRegs[f.facilityId];
      if (!reg) return f;
      // 사업자가 확정한 조건이 원본을 대체한다 — 판별도 표시도 이 값을 기준으로 한다
      return {
        ...f,
        petAllowed: reg.petAllowed,
        maxWeight: reg.maxWeight,
        requirements: reg.requirements,
        petConditionRaw: reg.conditionRaw,
        confidence: 'CONFIRMED',
        confidenceSource: 'OWNER',
        confirmedAt: reg.confirmedAt,
      };
    },
    [businessRegs],
  );

  const confidenceOf = useCallback(
    (f: Facility): { confidence: Confidence; source: ConfidenceSource; confirmedAt: string | null } => {
      // 사업자 확정이 최우선 — 발생 지점에서 확정된 정보다
      const reg = businessRegs[f.facilityId];
      if (reg) {
        return { confidence: 'CONFIRMED', source: 'OWNER', confirmedAt: reg.confirmedAt };
      }
      // 사용자가 직접 확인 → 확정으로 상향
      if (userConfirmedIds.has(f.facilityId)) {
        return { confidence: 'CONFIRMED', source: 'USER_CALL', confirmedAt: new Date().toISOString() };
      }
      // 현장 거부 제보 반영 → 미확인으로 하향 (정보를 믿지 말라는 신호).
      // 근거를 CROWD가 아니라 DENIAL_REPORT로 두는 이유: '제보 다수 일치'와 '거부 한 건'은
      // 사용자에게 정반대 의미다. confirmedAt은 그대로 둔다 — 마지막으로 확인된 시점은 여전히 과거다.
      if (downgradedIds.has(f.facilityId)) {
        return { confidence: 'UNVERIFIED', source: 'DENIAL_REPORT', confirmedAt: f.confirmedAt };
      }
      return { confidence: f.confidence, source: f.confidenceSource, confirmedAt: f.confirmedAt };
    },
    [businessRegs, userConfirmedIds, downgradedIds],
  );

  const promotionOf = useCallback(
    (facilityId: number) => promotions[facilityId] ?? null,
    [promotions],
  );

  const setPromotion = useCallback((promotion: Promotion) => {
    setPromotions((prev) => ({ ...prev, [promotion.facilityId]: promotion }));
  }, []);

  const benefitsOf = useCallback(
    (facilityId: number) => benefits[facilityId] ?? [],
    [benefits],
  );

  const addBenefit = useCallback((facilityId: number, title: string, detail: string) => {
    setBenefits((prev) => ({
      ...prev,
      [facilityId]: [
        ...(prev[facilityId] ?? []),
        { benefitId: nextBenefitId.current++, facilityId, title, detail, active: true },
      ],
    }));
  }, []);

  const toggleBenefit = useCallback((facilityId: number, benefitId: number) => {
    setBenefits((prev) => ({
      ...prev,
      [facilityId]: (prev[facilityId] ?? []).map((b) =>
        b.benefitId === benefitId ? { ...b, active: !b.active } : b,
      ),
    }));
  }, []);

  const removeBenefit = useCallback((facilityId: number, benefitId: number) => {
    setBenefits((prev) => ({
      ...prev,
      [facilityId]: (prev[facilityId] ?? []).filter((b) => b.benefitId !== benefitId),
    }));
  }, []);

  const addCalendarEvent = useCallback((input: Omit<CalendarEvent, 'eventId'>) => {
    setCalendarEvents((prev) => [...prev, { ...input, eventId: nextEventId.current++ }]);
  }, []);

  const removeCalendarEvent = useCallback((eventId: number) => {
    setCalendarEvents((prev) => prev.filter((e) => e.eventId !== eventId));
  }, []);

  const updateCalendarEvent = useCallback(
    (eventId: number, patch: Partial<Omit<CalendarEvent, 'eventId'>>) => {
      setCalendarEvents((prev) => prev.map((e) => (e.eventId === eventId ? { ...e, ...patch } : e)));
    },
    [],
  );

  const toggleEventReminder = useCallback((eventId: number) => {
    setCalendarEvents((prev) =>
      prev.map((e) => (e.eventId === eventId ? { ...e, reminder: !e.reminder } : e)),
    );
  }, []);

  const eventsOn = useCallback(
    (date: string) =>
      calendarEvents
        .filter((e) => eventOccursOn(e, date))
        .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')),
    [calendarEvents],
  );

  const toggleMedTaken = useCallback((eventId: number, date: string) => {
    setMedLog((prev) => {
      const key = `${eventId}:${date}`;
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const isMedTaken = useCallback(
    (eventId: number, date: string) => medLog.has(`${eventId}:${date}`),
    [medLog],
  );

  // 매장을 하나라도 등록하면 사업자 프로필이 계정에 생긴다 (A-하이브리드: 가입은 소비자 하나)
  const availableProfiles = useMemo<ProfileKind[]>(
    () => (Object.keys(businessRegs).length > 0 ? ['consumer', 'owner'] : ['consumer']),
    [businessRegs],
  );

  const login = useCallback((email: string) => {
    setSession({
      authed: true,
      email,
      // 프로필이 하나뿐이면 바로 자동 로그인, 둘이면 선택 화면(activeProfile=null)으로 보낸다
      activeProfile: Object.keys(businessRegs).length > 0 ? null : 'consumer',
    });
  }, [businessRegs]);

  // 저장된 세션을 되살린다. 토큰이 남아 있어도 **유효한지는 확인해야 한다** —
  // 만료된 토큰으로 로그인 상태를 만들면 화면은 들어가지는데 모든 조회가 401로
  // 실패해, 데이터가 텅 빈 채로 로그인된 것처럼 보인다. (재발급이 붙은 뒤로는 조회가
  // 알아서 되살리지만, 리프레시까지 죽었으면 여기서 걸러야 한다.)
  //
  // 회원정보 조회로 확인한다. 성공하면 닉네임·아바타까지 같이 채워진다.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const rev = sessionRev.current;
      // 매 await 뒤에 확인한다. 살아 있는지(alive)만으로는 부족하다 —
      // 컴포넌트는 그대로인데 세션만 새것으로 바뀐 경우를 못 걸러낸다.
      const stale = () => !alive || rev !== sessionRev.current;

      const saved = await loadSession();
      if (stale()) return;
      if (!saved) {
        setRestoring(false);
        return;
      }
      restoredEmailRef.current = saved.email;
      setAuthToken(saved.accessToken);
      setRefreshToken(saved.refreshToken);
      try {
        const me = await accountApi.get();
        if (stale()) return;
        if (typeof me.userId === 'number') setMyUserId(me.userId);
        /**
         * 조회가 401을 거쳐 **재발급으로 성공**했을 수 있다. 그때는 api 레이어가 이미
         * 새 토큰을 들고 있는데, 여기서 `saved.accessToken`을 다시 넣으면 스토어만
         * 만료된 토큰으로 되돌아가 둘이 갈린다. 재발급 콜백이 채워둔 값이 있으면 그걸 쓴다.
         */
        setAccessToken(refreshedRef.current?.accessToken ?? saved.accessToken);
        refreshTokenRef.current = refreshedRef.current?.refreshToken ?? saved.refreshToken;
        setAccount({ nickname: me.nickname, avatarUri: me.avatarUri });
        setSession({ authed: true, email: saved.email, activeProfile: 'consumer' });
      } catch (e) {
        if (stale()) return;
        // 인증 실패(만료·폐기)와 서버 장애를 구분한다. 502·네트워크 오류로 지워버리면
        // 서버가 잠깐 흔들릴 때마다 모든 사용자가 로그아웃된다 — 이 서버는 실제로
        // 502를 낸 적이 있다. 그런 경우엔 토큰을 그대로 두고 로그인 상태를 유지한다.
        const authFailed = e instanceof ApiError && (e.status === 401 || e.status === 403);
        if (authFailed) {
          setAuthToken(null);
          await clearSession();
        } else {
          setAccessToken(refreshedRef.current?.accessToken ?? saved.accessToken);
          refreshTokenRef.current = refreshedRef.current?.refreshToken ?? saved.refreshToken;
          setSession({ authed: true, email: saved.email, activeProfile: 'consumer' });
        }
      } finally {
        // 세션이 바뀌었으면 그쪽이 이미 restoring을 내렸다
        if (alive && rev === sessionRev.current) setRestoring(false);
      }
    })();
    return () => {
      alive = false;
    };
    // 앱 시작에 한 번만 — 이후 로그인/로그아웃은 authenticate·logout이 관리한다
  }, []);

  const authenticate = useCallback(
    (email: string, tokens: { accessToken: string; refreshToken: string; userId?: number }) => {
      // 진행 중인 복원이 이 로그인을 덮어쓰지 않도록 세대를 올린다
      bumpSessionEpoch();
      refreshedRef.current = null;
      restoredEmailRef.current = email || null;
      sessionRev.current += 1;
      setRestoring(false);
      setAccessToken(tokens.accessToken);
      setAuthToken(tokens.accessToken); // 보호 API 호출에 쓰이도록 api 레이어에도 넣는다
      setRefreshToken(tokens.refreshToken);
      if (typeof tokens.userId === 'number') setMyUserId(tokens.userId);
      refreshTokenRef.current = tokens.refreshToken;
      setSession({
        authed: true,
        email,
        activeProfile: Object.keys(businessRegs).length > 0 ? null : 'consumer',
      });
      // 다음 실행에서 되살릴 수 있게 기기에 남긴다. 이메일까지 담는 이유는 서버가
      // 회원정보에 이메일을 주지 않아, 없으면 설정·프로필 화면이 게스트로 되돌아가기 때문.
      void saveSession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        email: email || null,
      });
    },
    [businessRegs],
  );

  /**
   * 요약만 있는 판별 이력에 아이별 근거(verdicts)를 채운다.
   *
   * 목록 API(GET /pet-checks)는 요약만 줘서, 앱을 다시 켠 뒤 예전 판별의 출입증을 열면
   * 그릴 게 없어 "한 번 더 판별하면 바로 만들어져요"가 떴다. 단건 상세로 verifyCode까지
   * 받아 채우면 재판별 없이 출입증이 열린다.
   */
  const hydrateCheck = useCallback(async (checkId: number) => {
    // 로컬 전용 판별은 음수 id라 서버에 없다. 부르면 404만 돌아온다.
    if (!Number.isInteger(checkId) || checkId <= 0) return;
    try {
      const d = await aiApi.checkDetail(checkId);
      setChecks((prev) =>
        prev.map((c) =>
          c.checkId === checkId ? { ...c, overall: d.overall, verdicts: d.verdicts } : c,
        ),
      );
    } catch {
      // 못 채우면 기존 안내("한 번 더 판별하면…")로 떨어진다. 화면을 막지는 않는다.
    }
  }, []);

  /**
   * 계정에 딸린 상태를 전부 비운다.
   *
   * 로그아웃과 세션 만료가 같은 정리를 해야 한다. 만료 뒤에 반드시 같은 사람이 다시
   * 로그인한다는 보장이 없는데, 예전에는 만료가 토큰만 지워서 A의 일정·도장·만족도가
   * B 화면에 그대로 남았다.
   *
   * 설정(화면 모드·글씨 크기·앱 잠금)은 기기에 속한 값이라 남긴다.
   */
  const clearAccountState = useCallback(() => {
    // 예약된 만족도 전송을 취소한다. 두면 600ms 뒤 이전 계정의 기록이 새 토큰으로 나간다.
    for (const t of satTimers.current.values()) clearTimeout(t);
    satTimers.current.clear();
    setMyUserId(null);
    setPets([]);
    setChecks([]);
    setHiddenCheckIds([]);
    setReports([]);
    setReviews([]);
    setReviewData({});
    setReviewErrors(new Set());
    setReportedReviewIds(new Set());
    setServerDenials({});
    setCalendarEvents([]);
    setMedLog(new Set());
    void saveCalendarEvents([]);
    void saveMedLog([]);
    setSatisfactions([]);
    setBusinessRegs({});
    setUserConfirmedIds(new Set());
    setPendingCallConfirm(null);
    // A의 거부 제보로 하향된 시설이 남으면, B가 서버에서 새 정보를 받아도 로컬 하향이 이긴다
    setDowngradedIds(new Set());
    setTopPlaces({});
    setPromotions({});
    setBenefits({});
    setAccount({ nickname: '나', avatarUri: null });
    setStamps([]);
    void clearStamps();
  }, []);

  /**
   * 세션 만료 — 401을 받았을 때 부른다.
   *
   * 로그아웃과 **도장 처리가 다르다.** 로그아웃은 기기를 남에게 넘길 수 있다고 보고
   * 기기에 남은 도장을 지우지만, 만료는 같은 사람이 다시 로그인할 뿐이라 지울 이유가 없다.
   * 서버에 재발급 API가 없어 토큰을 되살릴 수 없으므로 로그인 화면으로 돌려보낸다.
   */
  const expireSession = useCallback(() => {
    // api 레이어의 세대도 올린다. 진행 중이던 재발급 응답이 이 세션을 되살리지 못하게.
    bumpSessionEpoch();
    refreshedRef.current = null;
    sessionRev.current += 1;
    setRestoring(false);
    setAccessToken(null);
    setAuthToken(null);
    setRefreshToken(null);
    refreshTokenRef.current = null;
    setSession({ authed: false, email: null, activeProfile: null });
    void clearSession();
    clearAccountState();
  }, [clearAccountState]);

  // request가 401을 만나면 이 함수를 부른다. api.ts는 React에 기대지 않으므로 등록으로 잇는다.
  useEffect(() => {
    setUnauthorizedHandler(expireSession);
    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  /**
   * 재발급에 성공하면 새 토큰 쌍을 기기에도 남긴다.
   *
   * 서버가 리프레시 토큰을 회전시키므로, 안 남기면 다음 실행에서 이미 폐기된 토큰으로
   * 복원을 시도하다 로그아웃된다.
   */
  useEffect(() => {
    setTokensRefreshedHandler(({ accessToken, refreshToken, userId }) => {
      refreshedRef.current = { accessToken, refreshToken };
      if (typeof userId === 'number') setMyUserId(userId);
      setAccessToken(accessToken);
      refreshTokenRef.current = refreshToken;
      /**
       * 이메일은 **기기에 저장돼 있던 값**을 우선한다.
       *
       * 복원 도중에 재발급이 일어나면 `session.email`은 아직 null이다. 그걸 그대로
       * 저장하면 기기에서 이메일이 지워져, 다음 실행부터 계정 정보가 비어 보인다.
       * 서버 회원정보에 이메일이 없어 다시 채울 방법도 없다.
       */
      const email = restoredEmailRef.current ?? sessionRef.current.email ?? null;
      void saveSession({ accessToken, refreshToken, email });
    });
    return () => setTokensRefreshedHandler(null);
  }, []);

  const finishLogout = useCallback(() => {
    bumpSessionEpoch();
    refreshedRef.current = null;
    restoredEmailRef.current = null;
    sessionRev.current += 1; // 복원이 늦게 끝나 로그아웃을 되돌리지 않도록
    setRestoring(false);
    setAccessToken(null);
    setAuthToken(null);
    setRefreshToken(null);
    refreshTokenRef.current = null;
    setSession({ authed: false, email: null, activeProfile: null });
    void clearSession(); // 남겨두면 다음 실행에 로그아웃한 계정으로 되살아난다
    // 도장도 여기서 함께 지운다. 기기에 있어 계정과 묶여 있지 않아서, 안 지우면 다음에
    // 로그인한 사람에게 앞사람의 도장첩·뱃지가 그대로 보인다.
    clearAccountState();
  }, [clearAccountState]);

  /**
   * 푸시 해제에 허용하는 시간.
   *
   * 해제는 **세션을 정리하기 전에** 끝나야 한다. 인증이 필요한 요청이라 토큰을 먼저
   * 지우면 401을 받아도 재발급할 수단이 없어 영영 실패하고, 로그아웃한 계정의 등록이
   * 서버에 남는다. 그렇다고 무한정 기다리면 네트워크가 느릴 때 로그아웃이 멈춘 것처럼
   * 보이므로 짧게 끊고 진행한다. 못 지운 토큰은 서버의 무효 토큰 정리가 걷어간다.
   */
  const PUSH_UNREGISTER_WAIT_MS = 3000;

  const logout = useCallback(() => {
    // 등록이 아직 진행 중일 수도 있다. 그 토큰까지 함께 해제한다.
    const pushed = pushTokenRef.current ?? pushPendingRef.current;
    pushTokenRef.current = null;
    pushPendingRef.current = null;
    if (!pushed) {
      finishLogout();
      return;
    }
    void Promise.race([
      pushApi.unregister(pushed).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, PUSH_UNREGISTER_WAIT_MS)),
    ]).then(finishLogout);
  }, [finishLogout]);

  const selectProfile = useCallback((kind: ProfileKind) => {
    setSession((s) => ({ ...s, activeProfile: kind }));
  }, []);

  const switchProfile = useCallback(() => {
    setSession((s) => ({ ...s, activeProfile: null }));
  }, []);

  // 최신 account를 콜백에서 읽기 위한 미러(PATCH에 닉네임을 항상 실어야 함)
  const accountRef = useRef<Account>(account);
  accountRef.current = account;

  // 재발급 콜백이 지금 세션의 이메일을 읽어야 한다. 상태를 의존성에 걸면 세션이 바뀔 때마다
  // 핸들러가 다시 등록되므로 미러로 읽는다.
  const sessionRef = useRef<Session>(session);
  sessionRef.current = session;

  /** 재발급으로 갱신된 토큰. 복원 코드가 옛 토큰으로 덮지 않도록 참고한다. */
  const refreshedRef = useRef<{ accessToken: string; refreshToken: string } | null>(null);
  /** 기기에서 읽어온 이메일. 복원 중 재발급이 일어나도 이메일을 잃지 않게 들고 있는다. */
  const restoredEmailRef = useRef<string | null>(null);

  // 서버에서 내 회원정보(닉네임·아바타)를 불러와 채운다. 실패 시 조용히 기본값 유지.
  // 반려동물 조회와 같은 이유로 로그인 전에는 부르지 않는다(늦은 401이 새 세션을 만료시킨다).
  useEffect(() => {
    if (!session.authed && !(__DEV__ && DEV_TOKEN)) return;
    let alive = true;
    accountApi
      .get()
      .then((a) => {
        if (!alive) return;
        setAccount({ nickname: a.nickname, avatarUri: a.avatarUri });
        // 서버가 userId를 주기 시작하면 그때부터 내 글 판정이 기기 기록 없이도 정확해진다.
        if (typeof a.userId === 'number') setMyUserId(a.userId);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [session.authed]);

  // 수정: 낙관적으로 로컬 반영 후 서버 PATCH. 서버가 준 최종값(아바타 URL 등)으로 다시 맞춘다.
  /**
   * 프로필 수정. **실패를 삼키지 않는다.**
   *
   * 예전에는 화면에 먼저 반영하고 서버 실패를 조용히 버렸다. 네트워크가 끊긴 채 저장하면
   * 바뀐 것처럼 보이고 화면이 닫히는데, 다음 조회에서 옛 정보로 돌아왔다. 실패하면 화면을
   * 되돌리고 오류를 던져, 호출한 쪽이 사용자에게 알리고 화면을 닫지 않게 한다.
   */
  const updateAccount = useCallback(async (patch: Partial<Account>) => {
    const before = accountRef.current;
    const nickname = patch.nickname ?? before.nickname;
    const photoUri = patch.avatarUri ?? before.avatarUri;
    setAccount((prev) => ({ ...prev, ...patch }));
    try {
      const a = await accountApi.update(nickname, photoUri);
      setAccount({ nickname: a.nickname, avatarUri: a.avatarUri });
    } catch (e) {
      setAccount(before);
      throw e;
    }
  }, []);

  // 지운 판별 이력을 기기에서 복원한다. 실패해도 목록이 전부 보일 뿐 앱을 막지 않는다.
  useEffect(() => {
    let alive = true;
    loadHiddenChecks().then((ids) => {
      if (alive) setHiddenCheckIds(ids);
    });
    return () => {
      alive = false;
    };
  }, []);

  const hideCheck = useCallback((checkId: number) => {
    setHiddenCheckIds((prev) => {
      if (prev.includes(checkId)) return prev;
      const next = [...prev, checkId];
      void saveHiddenChecks(next);
      return next;
    });
  }, []);

  /**
   * 화면에 보이는 판별 이력. 지운 것을 걸러낸다.
   *
   * 원본 `checks`를 직접 지우지 않는 이유는 서버에서 다시 불러올 때마다 되돌아오기
   * 때문이다. 걸러내는 자리를 한 곳으로 모아야 화면마다 빠뜨리지 않는다.
   */
  const visibleChecks = useMemo(
    () => (hiddenCheckIds.length === 0 ? checks : checks.filter((c) => !hiddenCheckIds.includes(c.checkId))),
    [checks, hiddenCheckIds],
  );

  // ── 여권 도장 (게임 요소 1단계) ─────────────────────────────────────
  // 기기에서 복원한다. 실패해도 빈 도장첩으로 시작할 뿐 앱을 막지 않는다.
  //
  // `stampsLoaded`는 **복원이 끝나기 전에 저장하지 않기 위한** 표시다. 없으면 아래 저장
  // 이펙트가 초기 빈 배열을 그대로 기기에 써서 복원 대상을 지워버린다.
  const stampsLoaded = useRef(false);
  useEffect(() => {
    let alive = true;
    loadStamps().then((list) => {
      if (!alive) return;
      setStamps(list);
      stampsLoaded.current = true;
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 도장을 기기에 남긴다. **상태가 바뀔 때마다 따라 쓴다** — 도장을 만드는 쪽이 직접
   * 저장하면 그쪽이 들고 있던 배열이 옛 스냅샷일 때 디스크만 뒤처진다.
   *
   * 저장 실패는 삼키지 않는다. 이 저장소는 한계가 빠듯해서(`stamp-store.ts` 참고) 실제로
   * 실패할 수 있고, 그때 화면이 계속 성공이라고 말하면 사용자는 앱을 다시 켠 뒤에야 안다.
   */
  const [stampSaveFailed, setStampSaveFailed] = useState(false);
  useEffect(() => {
    if (!stampsLoaded.current) return;
    let alive = true;
    saveStamps(stamps).then((ok) => {
      if (alive) setStampSaveFailed(!ok);
    });
    return () => {
      alive = false;
    };
  }, [stamps]);

  // 지역 트리는 도장을 찍을 때 주소를 해석하는 데 쓴다.
  //
  // `facilities/regions`를 쓰는 이유는 이쪽만 **관광공사 TourAPI 코드**(sidoCode·sigunguCode)를
  // 함께 주기 때문이다. `courses/regions`는 이름 문자열만 준다. 도장에 코드를 남겨야
  // 나중에 그 지역의 관광 정보와 이어붙일 수 있다.
  //
  // 다만 이 API는 인증이 필요해서 토큰이 생긴 뒤에 부른다 — 앱이 뜨자마자 부르면 401이다.
  // 못 받으면 도장을 아예 못 찍으므로, 화면이 재시도 경로를 준다.
  useEffect(() => {
    if (!accessToken) return;
    let alive = true;
    facilitiesApi
      .regions()
      .then((r) => {
        if (alive) setStampRegions(r);
      })
      .catch(() => {
        // 빈 채로 남는 것이 실패의 표시다. 화면(도장 버튼·도장첩)이 그 상태를 안내한다.
      });
    return () => {
      alive = false;
    };
  }, [accessToken]);

  /**
   * 푸시 토큰 등록.
   *
   * 로그인할 때마다 부른다 — 서버가 upsert로 받으므로 중복 등록이 아니라 소유자 갱신이다.
   * 기기를 재설치하거나 다른 계정으로 갈아타도 이 호출로 정리된다.
   *
   * 실패해도 아무것도 막지 않는다. 푸시가 안 오는 것뿐이고, 거부 경고는 홈 상단의
   * `GET /me/denial-alerts`로도 볼 수 있다. 다만 해제하려면 그때 등록한 토큰이 필요해서
   * 값을 들고 있는다.
   */
  const pushTokenRef = useRef<string | null>(null);
  /**
   * 등록이 끝나기 전에 OFF·로그아웃이 오면 `pushTokenRef`가 아직 비어 있어 해제를
   * 건너뛰었고, 뒤늦게 끝난 등록만 서버에 남았다. 등록을 시작하는 순간 토큰을 기록해
   * 그 사이에 들어온 해제가 이 토큰도 지우게 한다.
   */
  const pushPendingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!accessToken || !settingsLoaded) return;
    let alive = true;
    (async () => {
      /**
       * 알림을 꺼두면 **서버에서 토큰을 지운다.**
       *
       * 예전에는 설정을 보지 않고 등록만 해서, 사용자가 꺼도 서버에는 그대로 남았다.
       * 개인정보처리방침에 "끄면 저장된 푸시 토큰도 함께 삭제됩니다"라고 적어둔 터라
       * 문서와 동작이 어긋나 있었다.
       */
      if (!settings.notifPush) {
        const registered = pushTokenRef.current ?? pushPendingRef.current;
        if (registered) {
          // 해제가 성공해야 참조를 버린다. 먼저 지우면 실패했을 때 다시 시도할 정보가 없다.
          const ok = await pushApi
            .unregister(registered)
            .then(() => true)
            .catch(() => false);
          if (ok) {
            pushTokenRef.current = null;
            pushPendingRef.current = null;
          }
        }
        return;
      }
      const token = await getFcmToken();
      if (!alive || !token) return;
      pushPendingRef.current = token;
      try {
        await pushApi.register(token, Platform.OS === 'ios' ? 'IOS' : 'ANDROID');
        // 등록이 도는 사이 화면을 벗어났거나 알림이 꺼졌으면 바로 되돌린다.
        if (!alive || !settings.notifPush) {
          await pushApi.unregister(token).catch(() => {});
          pushPendingRef.current = null;
          return;
        }
        pushTokenRef.current = token;
      } catch {
        // 등록 실패는 알림이 안 오는 것으로 끝난다. 로그인·사용을 막지 않는다.
        pushPendingRef.current = null;
      }
    })();
    return () => {
      alive = false;
    };
  }, [accessToken, settings.notifPush, settingsLoaded]);

  /** 지역 트리 재조회. 화면의 재시도 버튼이 쓴다 — 없으면 앱을 다시 켤 때까지 도장을 못 찍는다. */
  const reloadStampRegions = useCallback(async () => {
    try {
      setStampRegions(await facilitiesApi.regions());
    } catch {
      // 실패하면 빈 배열이 그대로 남는다. 화면이 계속 재시도를 안내한다.
    }
  }, []);

  /**
   * 도장을 찍는다.
   *
   * **반드시 함수형 업데이트로 쓴다.** 이 함수가 불리는 시점과 실제 실행 사이에는 카메라
   * 대기와 목 판별을 합쳐 1초 넘는 틈이 있다. 그 사이에 기기에서 도장을 복원하는
   * `loadStamps`가 끝나면, 캡처된 옛 `stamps`(빈 배열)로 덮어써서 **복원된 도장이 상태에서도
   * 디스크에서도 통째로 사라진다.** 로컬이 유일한 보관처라 복구 경로가 없다.
   * 중복 검사도 같은 이유로 업데이터 안에서 해야 한다.
   */
  const addStamp = useCallback(
    (input: {
      facilityId: number;
      facilityName: string;
      address: string;
      petIds: number[];
      photoUri: string | null;
      verifiedOnSite: boolean;
    }): Stamp | null => {
      const region = matchRegion(input.address, stampRegions);
      // 지역을 모르면 안 찍는다. 잘못 찍힌 도장은 사용자가 지울 방법이 없다.
      if (!region) return null;

      const stamp: Stamp = {
        facilityId: input.facilityId,
        facilityName: input.facilityName,
        sido: region.sido,
        sigungu: region.sigungu,
        sidoCode: region.sidoCode,
        sigunguCode: region.sigunguCode,
        petIds: input.petIds,
        photoUri: input.photoUri,
        verifiedOnSite: input.verifiedOnSite,
        createdAt: new Date().toISOString(),
      };

      setStamps((prev) => {
        // 이미 찍은 시설이면 새로 세지 않는다. 같은 곳을 반복해 세면 "정복"이 아니게 된다.
        const idx = prev.findIndex((s2) => s2.facilityId === input.facilityId);
        if (idx >= 0) {
          // 다만 예전엔 멀리서 찍었는데 이번엔 현장이라면 승격한다. 그대로 두면
          // 현장에 다녀와도 「현장」 배지와 현장 집계가 영영 안 올라간다.
          if (!input.verifiedOnSite || prev[idx].verifiedOnSite) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], verifiedOnSite: true };
          return next;
        }
        return [stamp, ...prev];
      });
      return stamp;
    },
    [stampRegions],
  );

  const value = useMemo(
    () => ({
      myUserId,
      isMyReview,
      pets,
      addPet,
      removePet,
      updatePet,
      checks: visibleChecks,
      hideCheck,
      runCheck,
      upcomingVaccinations,
      reviews,
      reviewsOf,
      reviewDataOf,
      reviewErrorOf,
      loadReviews,
      addReview,
      removeReview,
      canReview,
      myReviewFor,
      reports,
      addReport,
      reportDenial,
      loadDenials,
      recentDenialsOf,
      recentDenialOf,
      plannedDenialAlerts,
      myDenialOf,
      reportedReviewIds,
      reportReview,
      stamps,
      addStamp,
      stampRegions,
      reloadStampRegions,
      stampSaveFailed,
      satisfactions,
      satisfactionOf,
      setSatisfaction,
      loadFacilitySatisfactions,
      topPlacesForPet,
      facilityById,
      registerFacilities,
      loadFacility,
      reloadAll,
      hydrateCheck,
      lastCoords,
      setLastCoords,
      settings,
      updateSettings,
      userConfirmedIds,
      confirmFacility,
      pendingCallConfirm,
      setPendingCallConfirm,
      downgradedIds,
      downgradeFacility,
      confidenceOf,
      businessRegs,
      registerBusiness,
      businessRegOf,
      effectiveFacility,
      promotions,
      promotionOf,
      setPromotion,
      benefitsOf,
      addBenefit,
      toggleBenefit,
      removeBenefit,
      calendarEvents,
      addCalendarEvent,
      removeCalendarEvent,
      updateCalendarEvent,
      toggleEventReminder,
      eventsOn,
      toggleMedTaken,
      isMedTaken,
      session,
      restoring,
      availableProfiles,
      login,
      authenticate,
      accessToken,
      logout,
      selectProfile,
      switchProfile,
      account,
      updateAccount,
    }),
    [
      pets,
      addPet,
      removePet,
      updatePet,
      visibleChecks,
      hideCheck,
      runCheck,
      upcomingVaccinations,
      reviews,
      reviewsOf,
      reviewDataOf,
      reviewErrorOf,
      loadReviews,
      addReview,
      removeReview,
      canReview,
      myReviewFor,
      reports,
      addReport,
      reportDenial,
      recentDenialsOf,
      loadDenials,
      recentDenialOf,
      plannedDenialAlerts,
      myDenialOf,
      reportedReviewIds,
      reportReview,
      stamps,
      addStamp,
      stampRegions,
      reloadStampRegions,
      stampSaveFailed,
      satisfactions,
      satisfactionOf,
      setSatisfaction,
      loadFacilitySatisfactions,
      topPlacesForPet,
      facilityById,
      registerFacilities,
      loadFacility,
      reloadAll,
      hydrateCheck,
      lastCoords,
      setLastCoords,
      settings,
      updateSettings,
      userConfirmedIds,
      pendingCallConfirm,
      confirmFacility,
      downgradedIds,
      downgradeFacility,
      confidenceOf,
      businessRegs,
      registerBusiness,
      businessRegOf,
      effectiveFacility,
      promotions,
      promotionOf,
      setPromotion,
      benefitsOf,
      addBenefit,
      toggleBenefit,
      removeBenefit,
      calendarEvents,
      addCalendarEvent,
      removeCalendarEvent,
      updateCalendarEvent,
      toggleEventReminder,
      eventsOn,
      toggleMedTaken,
      isMedTaken,
      session,
      restoring,
      availableProfiles,
      login,
      authenticate,
      accessToken,
      logout,
      selectProfile,
      switchProfile,
      account,
      updateAccount,
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used within AppStoreProvider');
  return store;
}
