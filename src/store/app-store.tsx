import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { judgeGroup } from '@/data/judge';
import { FACILITIES, INITIAL_PETS, INITIAL_SATISFACTIONS, REVIEWS } from '@/data/mock';
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

export type ReportType = 'ENTERED' | 'DENIED' | 'CONDITION_CHANGED';

export interface Report {
  reportId: number;
  facilityId: number;
  type: ReportType;
  content: string;
  /** 증거 사진·AI 검증 여부를 반영한 신뢰도 가중치 (docs/04 4-1) */
  weight: number;
  hasEvidence: boolean;
  status: 'PENDING' | 'APPLIED' | 'REJECTED';
  createdAt: string;
}

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
}

const MY_USER_ID = 1;
const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [pets, setPets] = useState<Pet[]>(INITIAL_PETS);
  const [checks, setChecks] = useState<PetCheck[]>([]);
  const [reviews, setReviews] = useState<Review[]>(REVIEWS);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportedReviewIds, setReportedReviewIds] = useState<Set<number>>(new Set());
  const [satisfactions, setSatisfactions] = useState<PetSatisfaction[]>(INITIAL_SATISFACTIONS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [userConfirmedIds, setUserConfirmedIds] = useState<Set<number>>(new Set());
  const [downgradedIds, setDowngradedIds] = useState<Set<number>>(new Set());
  const [businessRegs, setBusinessRegs] = useState<Record<number, BusinessReg>>({});
  const nextPetId = useRef(INITIAL_PETS.length + 1);
  const nextCheckId = useRef(1);
  const nextReviewId = useRef(900000);
  const nextReportId = useRef(1);

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
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [],
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
      // 현장 거부 제보 반영 → 미확인으로 하향 (정보를 믿지 말라는 신호)
      if (downgradedIds.has(f.facilityId)) {
        return { confidence: 'UNVERIFIED', source: 'CROWD', confirmedAt: f.confirmedAt };
      }
      return { confidence: f.confidence, source: f.confidenceSource, confirmedAt: f.confirmedAt };
    },
    [businessRegs, userConfirmedIds, downgradedIds],
  );

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
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used within AppStoreProvider');
  return store;
}
