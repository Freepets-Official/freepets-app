import '@/global.css';

/**
 * 프리펫스 디자인 토큰 — 화이트 그라운드 + 파스텔 로즈핑크.
 * 앱은 라이트 테마로 고정한다(항상 화이트 배경).
 * 판별 결과는 의미색으로 인코딩: 가능(진한 초록 글씨) / 조건부(앰버) / 불가(빨강 채운 배경).
 */
export const Palette = {
  light: {
    bg: '#FFFFFF',
    surface: '#FFF6FA', // 살짝 핑크빛 도는 면 — 회색보다 따뜻하고 귀엽게
    card: '#FFFFFF',
    ink: '#2A2530', // 핑크 기운의 웜 블랙
    muted: '#8C8591',
    line: '#F1E6EC', // 핑크빛 보더
    accent: '#E86397', // 로즈핑크 — 흰 배경에서 읽히는 파스텔
    accentDark: '#CE4E80',
    accentSoft: '#FDEAF2', // 배지·칠 배경
    onAccent: '#FFFFFF',
    // 동반 가능 — 진한 초록 볼드 글씨 + 연초록 배경
    success: '#0F7D45',
    successSoft: '#E4F4EA',
    // 조건부 — 앰버
    warn: '#B07714',
    warnSoft: '#FBEFD6',
    // 동반 불가 — 빨강 채운 배경 + 흰 볼드 글씨
    danger: '#D6342E',
    dangerSolid: '#E23B36',
    dangerSoft: '#FCE7E6',
    unknown: '#8C8591',
    unknownSoft: '#F3EEF1',
  },
  // 라이트 테마로 고정하므로 dark는 light와 동일하게 둔다(다크모드에서도 화이트 유지)
  get dark() {
    return this.light;
  },
} as const;

export type PaletteColors = { [K in keyof typeof Palette.light]: string };

export const Radius = { sm: 12, md: 16, lg: 20, xl: 26, full: 999 } as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** 카드 그림자 — 핑크 기운의 아주 옅은 소프트 섀도우 */
export const CardShadow = { boxShadow: '0 8px 22px rgba(232, 99, 151, 0.08)' } as const;

export const MaxContentWidth = 620;
