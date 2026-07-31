import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { judgeGroup } from '@/data/judge';
import { FACILITIES, INITIAL_CHECKS, INITIAL_PETS, INITIAL_REPORTS, INITIAL_SATISFACTIONS, REVIEWS } from '@/data/mock';
import type {
  Confidence,
  ConfidenceSource,
  Facility,
  Pet,
  PetCheck,
  PetSatisfaction,
  Requirement,
  Review,
  ReviewTag,
} from '@/data/types';

export interface AppSettings {
  /** 주변 검색 반경(km) */
  searchRadiusKm: number;
  /** 동반 불가 시설 숨기기 */
  hideDenied: boolean;
  /** 체크리스트에 계절 맞춤 팁 표시 */
  seasonalTips: boolean;
  notifPush: boolean;
  notifReport: boolean;
  notifNearby: boolean;
  notifMarketing: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  searchRadiusKm: 3,
  hideDenied: false,
  seasonalTips: true,
  notifPush: true,
  notifReport: true,
  notifNearby: true,
  notifMarketing: false,
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
  petId: number | null;
  ratingSpace: number;
  ratingStaff: number;
  ratingAmenity: number;
  content: string | null;
  tags: ReviewTag[];
}

interface AppStore {
  pets: Pet[];
  addPet: (input: Omit<Pet, 'petId'>) => void;
  removePet: (petId: number) => void;

  checks: PetCheck[];
  /** 선택한 여러 마리를 한 번에 판별한다 */
  runCheck: (facilityId: number, petIds: number[]) => PetCheck | null;

  reviews: Review[];
  reviewsOf: (facilityId: number) => Review[];
  addReview: (input: NewReview) => void;
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
  reportDenial: (facilityId: number, reason: DenialReason) => void;
  /** 최근 1주 내 남이 보낸 현장 거부 제보 — 최신순 최대 3건 (시설 상세 토글) */
  recentDenialsOf: (facilityId: number) => Report[];
  /** 그중 가장 최신 1건 — 홈 알림·목록 카드용 */
  recentDenialOf: (facilityId: number) => Report | undefined;
  /** 내가 판별받은 시설 중 최근 1주 내 거부가 뜬 곳 — 홈 알림에 쓴다 */
  plannedDenialAlerts: () => { facility: Facility; report: Report }[];
  /** 내가 이 시설에 보낸 현장 거부 제보 */
  myDenialOf: (facilityId: number) => Report | undefined;

  /** 신고된 리뷰 id — 등급 산정에서만 제외되고 화면에는 계속 표시된다 */
  reportedReviewIds: Set<number>;
  reportReview: (reviewId: number, reason: ReviewReportReason) => void;

  /** 반려동물 개인 만족도 (사업자 리뷰와 분리, 본인만 조회) */
  satisfactions: PetSatisfaction[];
  satisfactionOf: (petId: number, facilityId: number) => number | null;
  setSatisfaction: (petId: number, facilityId: number, score: number) => void;
  /** 그 아이가 좋아한 곳 TOP N (만족도 높은 순) */
  topPlacesForPet: (petId: number, n?: number) => { facility: Facility; score: number }[];

  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;

  /** 사용자가 전화 등으로 직접 확인한 시설 — 신뢰도를 '확정'으로 끌어올린다 */
  userConfirmedIds: Set<number>;
  confirmFacility: (facilityId: number) => void;
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

  /** 로그인 세션 (계정 하나 + 활성 프로필) */
  session: Session;
  /** 이 계정이 가진 프로필들 — 소비자는 항상, 사업자는 매장을 등록했을 때 생긴다 */
  availableProfiles: ProfileKind[];
  /** 데모 로그인 — 프로필이 하나면 자동 진입, 둘이면 프로필 선택으로 */
  login: (email: string) => void;
  logout: () => void;
  /** 프로필 선택(넷플릭스식) — 고른 프로필로 화면 세트가 바뀐다 */
  selectProfile: (kind: ProfileKind) => void;
  /** 다시 프로필 선택 화면으로 (다중 프로필일 때 전환용) */
  switchProfile: () => void;
}

const MY_USER_ID = 1;
const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [pets, setPets] = useState<Pet[]>(INITIAL_PETS);
  const [checks, setChecks] = useState<PetCheck[]>(INITIAL_CHECKS);
  const [reviews, setReviews] = useState<Review[]>(REVIEWS);
  const [reports, setReports] = useState<Report[]>(INITIAL_REPORTS);
  const [reportedReviewIds, setReportedReviewIds] = useState<Set<number>>(new Set());
  const [satisfactions, setSatisfactions] = useState<PetSatisfaction[]>(INITIAL_SATISFACTIONS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [userConfirmedIds, setUserConfirmedIds] = useState<Set<number>>(new Set());
  // 씨드 거부 제보도 신뢰도에 반영돼 있어야 앱을 켜자마자 하향된 상태로 보인다
  const [downgradedIds, setDowngradedIds] = useState<Set<number>>(
    () => new Set(INITIAL_REPORTS.filter((r) => r.realtime).map((r) => r.facilityId)),
  );
  const [businessRegs, setBusinessRegs] = useState<Record<number, BusinessReg>>({});
  const [promotions, setPromotions] = useState<Record<number, Promotion>>({});
  const [benefits, setBenefits] = useState<Record<number, Benefit[]>>({});
  const [session, setSession] = useState<Session>({ authed: false, email: null, activeProfile: null });
  const nextBenefitId = useRef(1);
  const nextPetId = useRef(INITIAL_PETS.length + 1);
  const nextCheckId = useRef(INITIAL_CHECKS.length + 1);
  const nextReviewId = useRef(900000);
  const nextReportId = useRef(INITIAL_REPORTS.length + 1);

  const addPet = useCallback((input: Omit<Pet, 'petId'>) => {
    setPets((prev) => [...prev, { ...input, petId: nextPetId.current++ }]);
  }, []);

  const removePet = useCallback((petId: number) => {
    setPets((prev) => prev.filter((p) => p.petId !== petId));
  }, []);

  const runCheck = useCallback(
    (facilityId: number, petIds: number[]): PetCheck | null => {
      const base = FACILITIES.find((f) => f.facilityId === facilityId);
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

      const { verdicts, overall, checklist, tips } = judgeGroup(chosen, facility);
      const check: PetCheck = {
        checkId: nextCheckId.current++,
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
    },
    [pets, businessRegs],
  );

  const reviewsOf = useCallback(
    (facilityId: number) => reviews.filter((r) => r.facilityId === facilityId),
    [reviews],
  );

  const canReview = useCallback(
    (facilityId: number) => checks.some((c) => c.facilityId === facilityId),
    [checks],
  );

  const myReviewFor = useCallback(
    (facilityId: number) =>
      reviews.find((r) => r.facilityId === facilityId && r.userId === MY_USER_ID),
    [reviews],
  );

  const addReview = useCallback(
    (input: NewReview) => {
      const pet = pets.find((p) => p.petId === input.petId);
      const review: Review = {
        reviewId: nextReviewId.current++,
        facilityId: input.facilityId,
        userId: MY_USER_ID,
        nickname: '나',
        petName: pet?.name ?? null,
        ratingSpace: input.ratingSpace,
        ratingStaff: input.ratingStaff,
        ratingAmenity: input.ratingAmenity,
        content: input.content,
        tags: input.tags,
        visitedAt: new Date().toISOString().slice(0, 10),
      };
      // 시설당 1인 1리뷰 — 기존 내 리뷰가 있으면 교체한다
      setReviews((prev) => [
        review,
        ...prev.filter((r) => !(r.facilityId === input.facilityId && r.userId === MY_USER_ID)),
      ]);
    },
    [pets],
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
  const recentDenialsOf = useCallback(
    (facilityId: number): Report[] =>
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
    [reports],
  );

  // 가장 최신 1건 (홈 알림·목록 카드용) — 목록의 첫 번째
  const recentDenialOf = useCallback(
    (facilityId: number): Report | undefined => recentDenialsOf(facilityId)[0],
    [recentDenialsOf],
  );

  // 내가 판별받은(=가려던) 시설 중, 남의 현장 거부가 1주 내 들어온 곳.
  // 위치(GPS)가 아니라 "판별 이력"으로 '가려던 곳'을 판단한다.
  const plannedDenialAlerts = useCallback((): { facility: Facility; report: Report }[] => {
    const seen = new Set<number>();
    const out: { facility: Facility; report: Report }[] = [];
    for (const c of checks) {
      if (seen.has(c.facilityId)) continue;
      const report = recentDenialOf(c.facilityId);
      if (!report) continue;
      const facility = FACILITIES.find((f) => f.facilityId === c.facilityId);
      if (!facility) continue;
      seen.add(c.facilityId);
      out.push({ facility, report });
    }
    return out;
  }, [checks, recentDenialOf]);

  const myDenialOf = useCallback(
    (facilityId: number) =>
      reports.find((r) => r.facilityId === facilityId && r.type === 'DENIED' && r.realtime && r.mine),
    [reports],
  );

  const reportReview = useCallback((reviewId: number, _reason: ReviewReportReason) => {
    // 데모: 신고 즉시 등급 산정에서만 제외한다. 실제로는 신고자 신뢰도를 반영한
    // 가중 합계가 3.0을 넘을 때만 제외되고, 숨김·삭제는 관리자 확인 후에 이뤄진다.
    setReportedReviewIds((prev) => {
      const next = new Set(prev);
      next.add(reviewId);
      return next;
    });
  }, []);

  const satisfactionOf = useCallback(
    (petId: number, facilityId: number) =>
      satisfactions.find((s) => s.petId === petId && s.facilityId === facilityId)?.score ?? null,
    [satisfactions],
  );

  const setSatisfaction = useCallback((petId: number, facilityId: number, score: number) => {
    setSatisfactions((prev) => {
      const rest = prev.filter((s) => !(s.petId === petId && s.facilityId === facilityId));
      return [...rest, { petId, facilityId, score }];
    });
  }, []);

  const topPlacesForPet = useCallback(
    (petId: number, n = 3) =>
      satisfactions
        .filter((s) => s.petId === petId)
        .map((s) => ({ facility: FACILITIES.find((f) => f.facilityId === s.facilityId)!, score: s.score }))
        .filter((x) => x.facility)
        .sort((a, b) => b.score - a.score)
        .slice(0, n),
    [satisfactions],
  );

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

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
    (facilityId: number, reason: DenialReason) => {
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

  const logout = useCallback(() => {
    setSession({ authed: false, email: null, activeProfile: null });
  }, []);

  const selectProfile = useCallback((kind: ProfileKind) => {
    setSession((s) => ({ ...s, activeProfile: kind }));
  }, []);

  const switchProfile = useCallback(() => {
    setSession((s) => ({ ...s, activeProfile: null }));
  }, []);

  const value = useMemo(
    () => ({
      pets,
      addPet,
      removePet,
      checks,
      runCheck,
      reviews,
      reviewsOf,
      addReview,
      canReview,
      myReviewFor,
      reports,
      addReport,
      reportDenial,
      recentDenialsOf,
      recentDenialOf,
      plannedDenialAlerts,
      myDenialOf,
      reportedReviewIds,
      reportReview,
      satisfactions,
      satisfactionOf,
      setSatisfaction,
      topPlacesForPet,
      settings,
      updateSettings,
      userConfirmedIds,
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
      session,
      availableProfiles,
      login,
      logout,
      selectProfile,
      switchProfile,
    }),
    [
      pets,
      addPet,
      removePet,
      checks,
      runCheck,
      reviews,
      reviewsOf,
      addReview,
      canReview,
      myReviewFor,
      reports,
      addReport,
      reportDenial,
      recentDenialsOf,
      recentDenialOf,
      plannedDenialAlerts,
      myDenialOf,
      reportedReviewIds,
      reportReview,
      satisfactions,
      satisfactionOf,
      setSatisfaction,
      topPlacesForPet,
      settings,
      updateSettings,
      userConfirmedIds,
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
      session,
      availableProfiles,
      login,
      logout,
      selectProfile,
      switchProfile,
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used within AppStoreProvider');
  return store;
}
