/**
 * 집사 레벨 · 발바닥 티어 — 서버(`GET /me/gamification`)가 정한 규칙을 앱에서 쓰는 형태로.
 *
 * XP는 계정 단위다. 판별·리뷰·제보·만족도·코스 공개/복사로 쌓이고 반려동물별로 나뉘지 않는다.
 * 레벨 곡선과 티어 구성은 **서버가 확정한 값**이라 여기서 바꾸면 화면과 서버가 어긋난다.
 */

/** 발바닥 티어 동물 10종. 레벨 7칸을 채우면 다음 동물로 넘어간다(7색 × 10종 = 70레벨). */
export type TierAnimal =
  | 'DOG'
  | 'CAT'
  | 'RABBIT'
  | 'HAMSTER'
  | 'GUINEA_PIG'
  | 'HEDGEHOG'
  | 'FERRET'
  | 'PARROT'
  | 'TURTLE'
  | 'LIZARD';

/** 발바닥 색 7종 — 무지개 순서로 레벨마다 한 칸씩 바뀐다. */
export type TierColor = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'INDIGO' | 'VIOLET';

export const TIER_ANIMAL_LABEL: Record<TierAnimal, string> = {
  DOG: '개',
  CAT: '고양이',
  RABBIT: '토끼',
  HAMSTER: '햄스터',
  GUINEA_PIG: '기니피그',
  HEDGEHOG: '고슴도치',
  FERRET: '페럿',
  PARROT: '앵무새',
  TURTLE: '거북이',
  LIZARD: '도마뱀',
};

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
  tierColor: TierColor;
  /** 서버가 만든 표시용 이름(예: "개 · 빨강"). 비어 있으면 앱이 동물·색으로 만든다 */
  tierLabel: string;
  tierBadgeImageUrl: string | null;
  levelUpNotificationEnabled: boolean;
  badges: GamificationBadge[];
};

/** 레벨 L에 도달하는 데 필요한 누적 XP — 서버 공식 `100 × L × (L−1) / 2`. */
export const levelBaseXp = (level: number) => (100 * level * (level - 1)) / 2;

/** 레벨 L 안에서 다음 레벨까지 필요한 XP — 위 식의 차분이라 `100 × L`이다. */
export const levelStepXp = (level: number) => 100 * level;

/** 서버가 tierLabel을 비워 보내도 화면에 빈칸이 남지 않게 한다. */
export function tierName(g: Pick<Gamification, 'tierAnimal' | 'tierColor' | 'tierLabel'>): string {
  if (g.tierLabel) return g.tierLabel;
  return `${TIER_ANIMAL_LABEL[g.tierAnimal]} · ${TIER_COLOR_LABEL[g.tierColor]}`;
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
