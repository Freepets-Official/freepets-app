/**
 * 집사 레벨 · 발바닥 티어 — 서버(`GET /me/gamification`)가 정한 규칙을 앱에서 쓰는 형태로.
 *
 * XP는 계정 단위다. 판별·리뷰·제보·만족도·코스 공개/복사로 쌓이고 반려동물별로 나뉘지 않는다.
 * 레벨 곡선과 티어 구성은 **서버가 확정한 값**이라 여기서 바꾸면 화면과 서버가 어긋난다.
 */

/**
 * 발바닥 티어 동물 — **개·고양이 2종**(서버 재설계 2026-09-18).
 * 앱이 지원하지 않는 종(도마뱀·페럿 등)이 레벨 배지에 나오던 위화감을 없앴다.
 * 레벨 1~35는 개, 36~70은 고양이 — 사용자가 고르는 값이 아니라 레벨에서 나온다.
 */
export type TierAnimal = 'DOG' | 'CAT';

/**
 * 발바닥 선명도 — 같은 발바닥이 레벨이 오를수록 진해진다(7레벨마다 한 단계).
 * 흐릿함(투명도 80%)에서 시작해 홀로그램(투명도 0%)에서 완전히 선명해진다.
 */
export type TierFinish = 'DIM' | 'CLEAR' | 'GLOSSY' | 'SPARKLE' | 'HOLOGRAPHIC';

/** 발바닥 색 7종 — 무지개 순서로 레벨마다 한 칸씩 바뀐다. */
export type TierColor = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'INDIGO' | 'VIOLET';

export const TIER_ANIMAL_LABEL: Record<TierAnimal, string> = {
  DOG: '개',
  CAT: '고양이',
};

export const TIER_FINISH_LABEL: Record<TierFinish, string> = {
  DIM: '흐릿함',
  CLEAR: '또렷함',
  GLOSSY: '빛남',
  SPARKLE: '반짝임',
  HOLOGRAPHIC: '홀로그램',
};

/**
 * 선명도별 발바닥 불투명도. 흐릿함 0.2 → 홀로그램 1.0.
 * 0.2는 정말 옅어서 배경에 묻히므로, 그리는 쪽에서 같은 색의 옅은 원을 깔아 자리를 잡아준다.
 */
export const TIER_FINISH_OPACITY: Record<TierFinish, number> = {
  DIM: 0.2,
  CLEAR: 0.4,
  GLOSSY: 0.6,
  SPARKLE: 0.8,
  HOLOGRAPHIC: 1,
};

export const TIER_FINISHES: TierFinish[] = ['DIM', 'CLEAR', 'GLOSSY', 'SPARKLE', 'HOLOGRAPHIC'];

export const TIER_COLOR_LABEL: Record<TierColor, string> = {
  RED: '빨강',
  ORANGE: '주황',
  YELLOW: '노랑',
  GREEN: '초록',
  BLUE: '파랑',
  INDIGO: '남색',
  VIOLET: '보라',
};

/**
 * 티어 색의 실제 값.
 *
 * 순수 무지개색을 그대로 쓰면 노랑이 흰 배경에서 안 보이고 남색이 다크에서 묻는다.
 * 양쪽 배경에서 다 읽히도록 채도를 조금 낮춘 값이다.
 */
export const TIER_COLOR_HEX: Record<TierColor, string> = {
  RED: '#E5484D',
  ORANGE: '#EF7C1B',
  YELLOW: '#E0A800',
  GREEN: '#3FA66A',
  BLUE: '#2F7BD6',
  INDIGO: '#5257C9',
  VIOLET: '#8B4FC4',
};

export const MAX_LEVEL = 70;

export type GamificationBadge = {
  code: string;
  label: string;
  description: string;
  /** 서버가 못 주면 null. 날짜 없이도 "받았다"는 사실은 유효하다 */
  earnedAt: string | null;
};

export type Gamification = {
  level: number;
  totalXp: number;
  /** 서버가 계산한 "다음 레벨까지 남은 XP". 값이 이상하면 아래 levelProgress가 무시한다 */
  xpToNextLevel: number;
  tierAnimal: TierAnimal;
  /** 선명도 5단계(서버 신규 필드). 옛 서버 응답이면 레벨에서 계산해 채운다 */
  tierFinish: TierFinish;
  tierColor: TierColor;
  /** 서버가 만든 표시용 이름(예: "개 · 빨강"). 비어 있으면 앱이 동물·색으로 만든다 */
  tierLabel: string;
  tierBadgeImageUrl: string | null;
  levelUpNotificationEnabled: boolean;
  badges: GamificationBadge[];
  /** 도메인별 누적 횟수와 단계별 달성 여부. 옛 서버 응답이면 빈 배열 */
  progress: BadgeProgress[];
};

export type BadgeProgress = {
  family: string;
  label: string;
  count: number;
  tiers: { tier: string; threshold: number; earnedAt: string | null }[];
};

/** 레벨 L에 도달하는 데 필요한 누적 XP — 서버 공식 `100 × L × (L−1) / 2`. */
export const levelBaseXp = (level: number) => (100 * level * (level - 1)) / 2;

/** 레벨 L 안에서 다음 레벨까지 필요한 XP — 위 식의 차분이라 `100 × L`이다. */
export const levelStepXp = (level: number) => 100 * level;

/**
 * 배지 이름.
 *
 * `animal`을 넘기면 그 모양 기준으로 문장을 만든다 — 사용자가 발바닥을 고르면 서버의
 * `tierLabel`("고양이 발바닥 …")과 화면에 그려진 모양이 어긋나기 때문이다.
 * 고른 적이 없으면 서버 문장을 그대로 쓴다(서버가 문구를 바꿔도 따라간다).
 */
export function tierName(
  g: Pick<Gamification, 'tierAnimal' | 'tierFinish' | 'tierColor' | 'tierLabel'>,
  animal?: TierAnimal,
): string {
  if (!animal && g.tierLabel) return g.tierLabel;
  const a = animal ?? g.tierAnimal;
  return `${TIER_ANIMAL_LABEL[a]} 발바닥 · ${TIER_FINISH_LABEL[g.tierFinish]} · ${TIER_COLOR_LABEL[g.tierColor]}`;
}

/**
 * 두 번째 바퀴(레벨 36~70)인가.
 *
 * 서버는 동물로 이 구간을 구분했다(1~35 개, 36~70 고양이). 발바닥 **모양을 사용자가 고르면서
 * 그 축이 사라져** 7색 × 5선명도 = 35가지만 남았고, 레벨 1과 36이 똑같이 보였다.
 * 그래서 모양 대신 **테두리 링**으로 같은 정보를 준다 — 색·선명도는 그대로 두고 70단계를 되살린다.
 */
export function isSecondCycle(g: Pick<Gamification, 'level' | 'tierAnimal'>): boolean {
  // 레벨이 우선이고, 서버가 레벨을 못 줬을 때만 동물로 판단한다
  return g.level >= 36 || g.tierAnimal === 'CAT';
}

/**
 * 히든 — 마지막 칸(보라 · 홀로그램 = 최대 레벨)을 뚫으면 무지개 발바닥이 된다.
 * 서버에 별도 필드가 없다. 마지막 조합이 곧 최대 레벨이라 레벨로 판정한다.
 */
export function isRainbowTier(g: Pick<Gamification, 'level'>): boolean {
  return g.level >= MAX_LEVEL;
}

/**
 * 진행바에 필요한 값.
 *
 * 서버는 누적 XP와 현재 레벨을 주므로 "이 레벨 안에서 얼마나 왔는지"는 앱이 센다.
 * 누적 XP를 기준으로 삼는 이유는 그게 서버의 원본 값이기 때문이다 — `xpToNextLevel`은
 * 남은 양인지 다음 레벨의 누적인지 계약이 명시돼 있지 않아, 범위를 벗어나면 버린다.
 */
export function levelProgress(g: Gamification) {
  const level = Math.min(Math.max(g.level, 1), MAX_LEVEL);
  const step = levelStepXp(level);
  const into = Math.min(Math.max(g.totalXp - levelBaseXp(level), 0), step);
  const serverRemain = g.xpToNextLevel;
  const remain =
    Number.isFinite(serverRemain) && serverRemain > 0 && serverRemain <= step
      ? serverRemain
      : step - into;
  // 최대 레벨에서는 다음 레벨이 없다. 진행바를 꽉 채우고 남은 XP는 감춘다
  const maxed = level >= MAX_LEVEL;
  return {
    level,
    step,
    into: maxed ? step : into,
    remain: maxed ? 0 : remain,
    ratio: maxed ? 1 : step === 0 ? 0 : into / step,
    maxed,
  };
}

/**
 * 경험치 규칙 — 서버(`api-specs/gamification.md`)가 정한 값의 사본. 화면의 「경험치 얻는 법」이 쓴다.
 * 서버가 바꾸면 여기도 바꿔야 한다. 앱이 계산에 쓰지는 않는다(지급은 서버가 한다).
 */
export const XP_RULES: { title: string; xp: number; cap: number | null; note?: string; route: string }[] = [
  { title: 'AI 판별 요청하기', xp: 5, cap: 10, route: '/(tabs)/explore' },
  { title: '다녀온 시설에 리뷰 쓰기', xp: 20, cap: 5, note: '시설당 1개', route: '/(tabs)/explore' },
  { title: '현장 거부 제보하기', xp: 15, cap: 5, route: '/(tabs)/explore' },
  { title: '아이 만족도 남기기', xp: 10, cap: 5, note: '시설·아이당 처음 1회', route: '/(tabs)/explore' },
  { title: '내 코스 공개하기', xp: 20, cap: 5, note: '+ 스톱 수 × 5, 코스당 1회', route: '/course' },
  { title: '내 공유 코스가 담기면', xp: 15, cap: 10, note: '담은 사람이 아니라 나에게', route: '/course' },
];
