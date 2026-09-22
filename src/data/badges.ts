/**
 * 행동 배지 카탈로그 — 서버가 정한 **9개 도메인 52종**.
 *
 * 서버는 **받은 배지만** 내려준다(`badges[].code`). 잠긴 배지까지 그리려면 앱이 카탈로그를
 * 알아야 해서 여기 둔다. code는 `{도메인}_{단계}`라 파싱으로 자리를 찾는다. 서버가 도메인을
 * 더 늘리면 모르는 접두사는 "그 외"로 모아 그린다 — 화면이 깨지지 않게.
 *
 * 2026-09-22 실호출(`GET /me/gamification`의 `progress[]`)로 맞췄다. 그전에는 7개만 알아서
 * **여권 도장·정복자 배지가 배지 벽에 아예 안 그려졌다** — 서버는 주고 있었는데 "그 외"로도
 * 안 갔다(받기 전에는 `badges[]`에 없으니 모르는 코드로도 안 잡혔다).
 */
export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'RUBY' | 'CRYSTAL' | 'DIAMOND';

export const BADGE_TIERS: { tier: BadgeTier; label: string; threshold: number; color: string }[] = [
  { tier: 'BRONZE', label: '동', threshold: 1, color: '#B87333' },
  { tier: 'SILVER', label: '은', threshold: 5, color: '#8E9AA7' },
  { tier: 'GOLD', label: '금', threshold: 10, color: '#D4A017' },
  { tier: 'RUBY', label: '루비', threshold: 50, color: '#C2185B' },
  { tier: 'CRYSTAL', label: '크리스탈', threshold: 100, color: '#4FB3D9' },
  { tier: 'DIAMOND', label: '다이아', threshold: 500, color: '#6C63FF' },
];

export type BadgeDomain = {
  prefix: string;
  label: string;
  /** "{n}번" 자리에 기준 횟수가 들어간다 */
  unit: string;
  icon: string;
  /** 어디서 쌓는지 — 잠긴 배지 아래 한 줄 */
  how: string;
  /**
   * 이 도메인만 단계가 다르면 적는다. 없으면 `BADGE_TIERS`(6단계)를 쓴다.
   *
   * 정복자만 4단계다 — 도장 찍은 **시·군·구 수**라 다른 도메인처럼 500까지 갈 수 없다
   * (전국이 229개다). 서버도 1/5/15/30으로 따로 잡았다.
   */
  tiers?: { tier: BadgeTier; label: string; threshold: number; color: string }[];
};

export const BADGE_DOMAINS: BadgeDomain[] = [
  { prefix: 'PETCHECK', label: '판별', unit: '번 판별', icon: 'search', how: '시설 상세에서 AI 판별' },
  { prefix: 'REVIEW', label: '리뷰', unit: '개 작성', icon: 'create', how: '다녀온 시설에 리뷰 남기기' },
  { prefix: 'REPORT', label: '제보', unit: '번 제보', icon: 'megaphone', how: '현장 거부·조건 변경 제보' },
  { prefix: 'SATISFACTION', label: '만족도', unit: '번 기록', icon: 'happy', how: '시설 상세에서 아이 만족도 남기기' },
  { prefix: 'COURSE_PUBLISHED', label: '공개 코스', unit: '개 공개', icon: 'earth', how: '내 코스를 공개로 전환' },
  { prefix: 'COURSE_SHARED', label: '인기 코스', unit: '번 담김', icon: 'share-social', how: '내 공유 코스를 다른 집사가 담기' },
  { prefix: 'HELPFUL', label: '구원자', unit: '번 도움', icon: 'heart', how: '내 리뷰가 「도움됐어요」 받기' },
  { prefix: 'STAMP', label: '여권 도장', unit: '개 수집', icon: 'ribbon', how: '다녀온 시설에서 도장 찍기' },
  {
    prefix: 'REGION',
    label: '정복자',
    unit: '개 지역',
    icon: 'map',
    how: '여러 시·군·구에서 도장 찍기',
    tiers: [
      { tier: 'BRONZE', label: '동', threshold: 1, color: '#B87333' },
      { tier: 'SILVER', label: '은', threshold: 5, color: '#8E9AA7' },
      { tier: 'GOLD', label: '금', threshold: 15, color: '#D4A017' },
      { tier: 'RUBY', label: '루비', threshold: 30, color: '#C2185B' },
    ],
  },
];

/** 이 도메인의 단계들. 따로 정한 게 없으면 공통 6단계 */
export const tiersOf = (d: BadgeDomain) => d.tiers ?? BADGE_TIERS;

/** `REVIEW_GOLD` → { domain: REVIEW, tier: GOLD }. 모르는 코드는 null */
export function parseBadgeCode(code: string): { prefix: string; tier: BadgeTier } | null {
  const m = /^(.+)_(BRONZE|SILVER|GOLD|RUBY|CRYSTAL|DIAMOND)$/.exec(code);
  return m ? { prefix: m[1], tier: m[2] as BadgeTier } : null;
}
