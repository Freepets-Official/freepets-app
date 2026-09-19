/**
 * 집사 레벨 · 발바닥 티어 — 서버(`GET /me/gamification`)가 정한 규칙을 앱에서 쓰는 형태로.
 *
 * XP는 계정 단위다. 판별·리뷰·제보·만족도·코스 공개/복사로 쌓이고 반려동물별로 나뉘지 않는다.
 * 레벨 곡선과 티어 구성은 **서버가 확정한 값**이라 여기서 바꾸면 화면과 서버가 어긋난다.
 */

/**
 * 발바닥 티어 동물 — 개·고양이 2종. **레벨이 아니라 사용자가 고른다**(퀘스트 화면 첫 진입).
 * 모양은 취향이고, 레벨은 색과 투명도로 나타낸다.
 */
export type TierAnimal = 'DOG' | 'CAT';

/** 발바닥 색 7종 — 무지개 순서. 다섯 단계를 채우면 다음 색으로 넘어간다 */
export type TierColor = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'INDIGO' | 'VIOLET';

export const TIER_ANIMAL_LABEL: Record<TierAnimal, string> = {
  DOG: '개',
  CAT: '고양이',
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

export const TIER_COLOR_ORDER: TierColor[] = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'INDIGO', 'VIOLET'];

/**
 * 한 색 안에서 다섯 단계로 진해진다 — **투명도 80 → 60 → 40 → 20 → 0(%)**.
 * 다 채우면 다음 색으로 넘어간다. 색 7 × 단계 5 = 35레벨.
 */
export const TIER_TRANSPARENCY_STEPS = [80, 60, 40, 20, 0];

/** 36~40레벨은 일곱 색을 다 모은 보상 — **무지개 발바닥**이 같은 다섯 단계로 진해진다 */
export const RAINBOW_START_LEVEL = 36;

export type TierLook = {
  /** 무지개 구간이면 null */
  color: TierColor | null;
  /** 투명도(%) — 80·60·40·20·0 */
  transparency: number;
  /** 실제로 칠할 불투명도 0.2~1 */
  opacity: number;
  rainbow: boolean;
};

/**
 * 레벨 → 발바닥 모습. **레벨 하나로 전부 정해진다** — 서버의 `tierColor`/`tierFinish`는 쓰지 않는다.
 *
 * 색이 바깥 축, 투명도가 안쪽 축이다: 빨강 80%→60%→40%→20%→0% → 주황 80% → … → 보라 0%(35레벨).
 * 36~40은 무지개가 같은 방식으로 진해져 40에서 완전히 선명해진다.
 */
export function tierLook(level: number): TierLook {
  const lv = Math.min(Math.max(Math.trunc(level) || 1, 1), MAX_LEVEL);
  if (lv >= RAINBOW_START_LEVEL) {
    const transparency = TIER_TRANSPARENCY_STEPS[lv - RAINBOW_START_LEVEL] ?? 0;
    return { color: null, transparency, opacity: (100 - transparency) / 100, rainbow: true };
  }
  const color = TIER_COLOR_ORDER[Math.floor((lv - 1) / TIER_TRANSPARENCY_STEPS.length)] ?? 'VIOLET';
  const transparency = TIER_TRANSPARENCY_STEPS[(lv - 1) % TIER_TRANSPARENCY_STEPS.length];
  return { color, transparency, opacity: (100 - transparency) / 100, rainbow: false };
}

/**
 * 만렙 40 — 색 7 × 투명도 5 = 35에 무지개 5단계를 더한 값.
 * ⚠️ 서버는 아직 70을 최대로 계산한다(`gamification.md`). 규칙 변경을 요청해 둔 상태라,
 * 그전까지 앱은 40으로 잘라 보여준다.
 */
export const MAX_LEVEL = 40;

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
  /** 서버가 레벨로 정한 동물. 화면은 사용자가 고른 값을 우선하지만, 안 골랐으면 이걸 쓴다 */
  tierAnimal: TierAnimal;
  /** 서버가 계산한 색. 앱은 `tierLook(level)`로 직접 정하므로 표시에는 쓰지 않는다 */
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
 * 배지 이름 — `"고양이 발바닥 노랑 20%"`처럼 **색과 투명도를 그대로 읽어준다.**
 *
 * 서버 `tierLabel`은 쓰지 않는다. 모양은 사용자가 고르고 색·투명도는 앱이 레벨에서 계산하므로,
 * 서버 문장("고양이 발바닥 · 반짝임 · 노랑")을 쓰면 화면과 어긋난다.
 */
export function tierName(g: Pick<Gamification, 'level'>, animal: TierAnimal = 'DOG'): string {
  const look = tierLook(g.level);
  if (look.rainbow) return `무지개 발바닥 ${look.transparency}%`;
  return `${TIER_ANIMAL_LABEL[animal]} 발바닥 ${TIER_COLOR_LABEL[look.color ?? 'RED']} ${look.transparency}%`;
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
