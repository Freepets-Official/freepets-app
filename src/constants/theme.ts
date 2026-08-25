import '@/global.css';

/**
 * 프리펫스 디자인 토큰 — 라이트(화이트 + 파스텔 로즈핑크) / 다크(웜 다크 + 로즈핑크).
 * 실제 적용 팔레트는 설정의 화면 모드(라이트·다크·자동)로 결정된다(`hooks/use-theme`).
 * 판별 결과는 의미색으로 인코딩: 가능(초록) / 조건부(앰버) / 불가(빨강 채운 배경).
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
  // 다크 테마 — 웜 다크(살짝 보라·핑크 기운) 그라운드에 같은 로즈핑크 액센트.
  // 의미색은 어두운 배경에서 읽히도록 톤을 올렸다.
  dark: {
    bg: '#15121A',
    surface: '#211C28', // 면 — bg보다 한 톤 밝게
    card: '#1D1824',
    ink: '#F3EEF5', // 웜 화이트
    muted: '#9C94A4',
    line: '#342C3C',
    accent: '#E86397', // 라이트와 동일 — 흰 글씨 버튼 대비 유지
    accentDark: '#CE4E80',
    accentSoft: '#3A2130', // 배지·칠(다크 핑크 틴트)
    onAccent: '#FFFFFF',
    success: '#46C978',
    successSoft: '#16311F',
    warn: '#E6A63A',
    warnSoft: '#33280F',
    danger: '#EF5B54',
    dangerSolid: '#E23B36',
    dangerSoft: '#3A1D1C',
    unknown: '#9C94A4',
    unknownSoft: '#29232F',
  },
} as const;

/** 화면 모드 — 라이트/다크/자동(저녁~새벽 다크). 설정에 저장된다. */
export type ThemeMode = 'light' | 'dark' | 'auto';

export type PaletteColors = { [K in keyof typeof Palette.light]: string };

export const Radius = { sm: 12, md: 16, lg: 20, xl: 26, full: 999 } as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** 카드 그림자 — 핑크 기운의 아주 옅은 소프트 섀도우 */
export const CardShadow = { boxShadow: '0 8px 22px rgba(232, 99, 151, 0.08)' } as const;

export const MaxContentWidth = 620;
