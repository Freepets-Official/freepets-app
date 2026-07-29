/**
 * F6 반려동물 동반 음식점 등록 지원 — 도메인 데이터·로직.
 * 2026-03 시행 음식점 반려동물 동반 신고제(식약처 매뉴얼, 완화 기준) 기반.
 * 설계 문서: freepets-docs/docs/08-음식점-반려동물-동반등록.md
 *
 * 요건·수치는 지자체별로 다를 수 있으므로, 화면에서 "최종 확인은 관할 구청"을 병기한다.
 */

/** 요건 체크리스트 항목 */
export interface ReqItem {
  key: string;
  label: string;
  /** 필수(신고 가능 판정에 반영) / 권장 */
  mandatory: boolean;
  help: string;
}

export const F6_REQUIREMENTS: ReqItem[] = [
  { key: 'PARTITION', label: '조리장 칸막이', mandatory: true, help: '반려동물이 식품 취급 공간에 못 들어가게 차단. 이동형·접이식도 OK, 재질·크기 제한 없음' },
  { key: 'RESTRAINT', label: '반려동물 고정장치', mandatory: true, help: '목줄 고정장치·케이지·의자 중 1개만 구비하면 됨(일반 의자 가능)' },
  { key: 'TABLE_GAP', label: '식탁 간격', mandatory: true, help: '케이지·안고 있으면 조정 불필요. 목줄 사용 시 이동 거리보다 넓게' },
  { key: 'VACC_CHECK', label: '예방접종 확인 수단', mandatory: true, help: '증명서·수기대장·QR·사진·앱 인증(프리펫스 출입증) 중 하나' },
  { key: 'SIGNAGE', label: '‘반려동물 동반 영업장’ 안내문', mandatory: true, help: '출입문·외부에 게시' },
  { key: 'HYGIENE_COVER', label: '음식 뚜껑·덮개', mandatory: true, help: '진열·제공 시 덮개 사용' },
  { key: 'WASTE_BIN', label: '반려동물 전용 쓰레기통', mandatory: true, help: '' },
  { key: 'SANITIZER', label: '입구 손 소독제', mandatory: true, help: '' },
  { key: 'VENTILATION', label: '환기 / 공기청정기', mandatory: true, help: '정기 환기 또는 공기청정기' },
  { key: 'PET_DISH', label: '반려동물용 식기', mandatory: false, help: '의무 아님. 제공 시 손님용과 구분·표시' },
  { key: 'INSURANCE', label: '반려동물 배상책임보험', mandatory: false, help: '가입 권장' },
];

export const MANDATORY_KEYS = F6_REQUIREMENTS.filter((r) => r.mandatory).map((r) => r.key);

/** Step 0 도입 자가진단 질문 */
export interface DecisionQ {
  key: 'demand' | 'structure' | 'risk';
  q: string;
  hint: string;
}

export const F6_DECISION: DecisionQ[] = [
  { key: 'demand', q: '반려인 고객 수요가 있는 상권·업종인가요?', hint: '카페·브런치는 수요가 높고, 고회전 업종은 신중히' },
  { key: 'structure', q: '지금 매장 구조에서 칸막이·간격 확보가 가능한가요?', hint: '주방이 완전 오픈형이면 칸막이 부담이 큼' },
  { key: 'risk', q: '기준 미준수 시 영업정지(1차 5일 → 10일 → 20일) 리스크를 감수할 수 있나요?', hint: '기준을 지키지 않은 운영은 위험' },
];

export type DecisionAnswers = Record<DecisionQ['key'], boolean>;

/** 자가진단 종합 코멘트 (강요하지 않고 판단을 돕는다) */
export function decisionVerdict(a: Partial<DecisionAnswers>): {
  tone: 'go' | 'careful' | 'hold';
  message: string;
} {
  const { demand, structure, risk } = a;
  if (demand && structure && risk) {
    return { tone: 'go', message: '수요·구조·리스크 모두 긍정적이에요. 요건만 갖추면 신고할 수 있어요.' };
  }
  if (risk === false) {
    return { tone: 'hold', message: '리스크 감수가 어렵다면 지금은 보류를 권해요. 기준 미준수 운영은 영업정지 위험이 커요.' };
  }
  if (structure === false) {
    return { tone: 'careful', message: '매장 구조가 관건이에요. 칸막이·간격을 확보할 수 있을지 먼저 점검해 보세요.' };
  }
  return { tone: 'careful', message: '수요가 불확실하면 반려인 상권·요일별 수요를 먼저 살펴보는 걸 추천해요.' };
}

/** 필수 요건 충족 판정 */
export function selfCheck(checklist: Record<string, boolean>): {
  eligible: boolean;
  missing: ReqItem[];
} {
  const missing = F6_REQUIREMENTS.filter((r) => r.mandatory && !checklist[r.key]);
  return { eligible: missing.length === 0, missing };
}
