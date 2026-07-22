import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { judgeGroup } from '@/data/judge';
import { FACILITIES, INITIAL_PETS, INITIAL_REPORTS, INITIAL_SATISFACTIONS, REVIEWS } from '@/data/mock';
import type {
  Confidence,
  ConfidenceSource,
  Facility,
  Pet,
  PetCheck,
  PetSatisfaction,
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
const DENIAL_ALERT_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  /** 최근 24시간 내 남이 보낸 현장 거부 제보 — 그 시설로 향하는 사용자에게 경고로 쓴다 */
  recentDenialOf: (facilityId: number) => Report | undefined;
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
}

const MY_USER_ID = 1;
const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [pets, setPets] = useState<Pet[]>(INITIAL_PETS);
  const [checks, setChecks] = useState<PetCheck[]>([]);
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
  const nextPetId = useRef(INITIAL_PETS.length + 1);
  const nextCheckId = useRef(1);
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
      const facility = FACILITIES.find((f) => f.facilityId === facilityId);
      const chosen = pets.filter((p) => petIds.includes(p.petId));
      if (!facility || chosen.length === 0) return null;

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
    [pets],
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

  const recentDenialOf = useCallback(
    (facilityId: number) =>
      reports.find(
        (r) =>
          r.facilityId === facilityId &&
          r.type === 'DENIED' &&
          r.realtime &&
          !r.mine &&
          Date.now() - new Date(r.createdAt).getTime() < DENIAL_ALERT_WINDOW_MS,
      ),
    [reports],
  );

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

  const confidenceOf = useCallback(
    (f: Facility): { confidence: Confidence; source: ConfidenceSource; confirmedAt: string | null } => {
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
    [userConfirmedIds, downgradedIds],
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
      reportDenial,
      recentDenialOf,
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
      recentDenialOf,
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
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used within AppStoreProvider');
  return store;
}
