import '@/global.css';

/**
 * 반갑꼬리 디자인 토큰 — 라이트(화이트 + 파스텔 로즈핑크) / 다크(웜 다크 + 로즈핑크).
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
    // 달력의 토요일. 일요일은 danger(빨강)를 쓰는데 토요일만 팔레트 밖 값이 박혀 있었다
    saturday: '#4C8DF5',
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
    // 라이트보다 밝게 — danger가 다크에서 밝아지는 것과 짝을 맞춘다
    saturday: '#6FA3F7',
  },
} as const;

/** 화면 모드 — 라이트/다크/자동(저녁~새벽 다크). 설정에 저장된다. */
export type ThemeMode = 'light' | 'dark' | 'auto';

export type PaletteColors = { [K in keyof typeof Palette.light]: string };

/**
 * 글자 크기 사다리.
 *
 * 토큰을 만들기 전 앱에는 **30가지 크기**가 섞여 있었다. 11.5·12·12.5·13·13.5·14·14.5·15가
 * 각각 40~78회씩 쓰여, 3.5pt 폭에 여덟 단계가 들어차 있었다 — 눈으로 구분되지 않는 차이를
 * 화면마다 다르게 고른 결과지 의도가 아니었다.
 *
 * 그래서 **각 구간에서 가장 많이 쓰이던 값**을 대표로 뽑아 사다리를 만들었다. 가장 많은 쪽을
 * 고른 이유는 실제로 바뀌는 자리를 최소로 줄이기 위해서다.
 *
 * 명함·여권 카드(`pet-id-card`, `passport-card`)와 스플래시·로고는 이 사다리를 쓰지 않는다.
 * 실제 카드 비율에 맞춰 픽셀로 맞춰 둔 고정 디자인이라, 사다리에 맞추면 도리어 깨진다.
 */
export const Type = {
  /** 칩·배지 안의 아주 작은 글씨 */
  micro: 10.5,
  /** 보조 설명·메타 정보 */
  caption: 11.5,
  /** 각주·부연 */
  footnote: 12.5,
  /** 본문 */
  body: 13,
  /** 강조 본문·목록 항목 */
  bodyLg: 14,
  /** 버튼·입력 글씨 */
  callout: 15,
  /** 카드 제목 */
  cardTitle: 16,
  /** 바텀시트 제목·목록 이름 */
  sheetTitle: 17,
  /** 섹션 제목 */
  sectionTitle: 20,
  /** 완료 화면 제목·큰 수치 */
  headline: 22,
  /** 일반 화면 대제목 */
  screenTitle: 26,
  /** 탭 랜딩 대제목 — `Screen`의 title. 푸시된 화면보다 한 단 크게 두는 의도된 위계다 */
  landingTitle: 30,
} as const;

export const Radius = { sm: 12, md: 16, lg: 20, xl: 26, full: 999 } as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** 카드 그림자 — 핑크 기운의 아주 옅은 소프트 섀도우 */
export const CardShadow = { boxShadow: '0 8px 22px rgba(232, 99, 151, 0.08)' } as const;

export const MaxContentWidth = 620;
