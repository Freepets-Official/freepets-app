import '@/global.css';

/**
 * 반갑꼬리 디자인 토큰 — 라이트(따뜻한 흰 바탕 + 파스텔 살구) / 다크(웜 다크 + 살구).
 *
 * 2026-10 메인 색을 로즈핑크에서 살구로 바꿨다. 사용자가 "파스텔톤의 부드럽고 따뜻한 색"을
 * 원했고, 살구 `#DB7850`은 흰 바탕 대비가 3.0으로 예전 핑크(3.15)와 거의 같아 핑크가 쓰이던
 * 자리(글자·아이콘·흰 글씨 버튼)에 그대로 들어간다. 더 연한 살구는 글자로 읽히지 않는다.
 * 판별 의미색(초록·앰버·빨강)과 헷갈리지 않게 칠 배경(`accentSoft`)은 노랑기가 아니라
 * 분홍기 도는 살구로 뒀다 — 조건부의 `warnSoft`(노란 크림)와 나란히 놓여도 구분된다.
 * 실제 적용 팔레트는 설정의 화면 모드(라이트·다크·자동)로 결정된다(`hooks/use-theme`).
 * 판별 결과는 의미색으로 인코딩: 가능(초록) / 조건부(앰버) / 불가(빨강 채운 배경).
 */
export const Palette = {
  light: {
    bg: '#FFFFFF',
    surface: '#FFF6EF', // 살구빛 도는 면 — 회색보다 따뜻하고 귀엽게
    card: '#FFFFFF',
    ink: '#2D2622', // 갈색 기운의 웜 블랙
    muted: '#8C8079',
    line: '#F1E4DA', // 살구빛 보더
    accent: '#DB7850', // 살구 — 흰 배경에서 읽히는 가장 연한 값
    accentDark: '#BC5F38', // 작은 글씨용. 흰 바탕 대비 4.3
    accentSoft: '#FDE8DE', // 배지·칠 배경
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
  // 다크 테마 — 웜 다크(갈색 기운) 그라운드에 살구 액센트.
  // 더 밝히면 어두운 바탕에선 예쁘지만 흰 글씨 버튼이 안 읽힌다(#E8906A는 2.4). 그래서 흰 글씨
  // 대비 3.2(예전 핑크 3.15 이상)를 지키는 값으로 두고, 바탕 위 대비는 5.9로 충분하다.
  // 의미색은 어두운 배경에서 읽히도록 톤을 올렸다.
  dark: {
    bg: '#15110E',
    surface: '#221B16', // 면 — bg보다 한 톤 밝게
    card: '#1D1713',
    ink: '#F5EEE8', // 웜 화이트
    muted: '#A3978E',
    line: '#3A2F27',
    accent: '#D9744B',
    accentDark: '#F0A584', // 다크에서는 "진한" 쪽이 더 밝아야 읽힌다
    accentSoft: '#3D271C', // 배지·칠(다크 살구 틴트)
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
 * 여권(`companion/passport-book`, `passport-card`)과 스플래시·로고는 이 사다리를 쓰지 않는다.
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

/** 카드 그림자 — 살구 기운의 아주 옅은 소프트 섀도우 */
export const CardShadow = { boxShadow: '0 8px 22px rgba(219, 120, 80, 0.10)' } as const;

export const MaxContentWidth = 620;

/**
 * 레벨업 「발도장 콩콩」 연출 색.
 *
 * 막 없이 지금 화면 위에 바로 찍히는 도장이라 **양 테마 동일**하다. 다크에서도 도장은 종이색
 * 원판이고, 글자는 흰 외곽선을 둘러 어느 배경에서든 읽힌다. 시안(`stamp-reference.html`)의
 * 값을 그대로 옮겼다.
 */
export const LevelUpColors = {
  // 이름은 예전 그대로 둔다(`pink`). 메인 색이 살구로 바뀌어 값만 살구 계열로 옮겼다
  pink: '#F29A72', // 도장 테두리·원형 글자·퍼지는 고리
  peach: '#FFC48A', // 발자국·하트의 짝 색, 도장 속 발바닥
  stampInk: '#E8825A', // 도장 가운데 "Lv.N"
  stampPaper: '#FFF8F2',
  dotted: '#FFD3BE', // 안쪽 점선 원
  title: '#5A3D34',
  subtitle: '#8A6A5E',
  outline: '#FFFFFF',
  shadow: 'rgba(232,130,90,0.28)',
} as const;

/** 레벨업 연출 글꼴 — `assets/fonts`에 번들(OFL). 이름은 폰트의 PostScript 이름과 같게 맞췄다 */
export const LevelUpFonts = { ko: 'Jua-Regular', latin: 'Fredoka-Bold' } as const;

/**
 * 홈 「꼬리 친구」(강아지·고양이 손그림) 색.
 *
 * **다크에서도 몸은 밝게 둔다.** 테마대로 몸을 어둡게, 선을 밝게 뒤집으면 눈·코가 흰 구멍처럼
 * 보여 무섭다는 말을 들었다(2026-10-17). 다크는 베이지 털에 짙은 갈색 선 — 어두운 방에
 * 놓인 인형처럼 보이게 한다. 흰색 그대로면 화면에서 너무 튄다.
 */
export const CompanionColors = {
  light: {
    fill: '#FFFFFF',
    // 털 아래쪽 그늘(2.5D 명암) — 위는 fill, 아래로 갈수록 이 색
    shade: '#EADBCF',
    ink: '#2D2622',
    shadow: 'rgba(45,38,34,0.07)',
    blush: '#FFC9B0',
    tongue: '#F7A58A',
    scarf: '#F4B08F',
    umbrella: '#FFD8C4',
    rain: '#8EC3E8',
    sun: '#F5B83D',
  },
  dark: {
    fill: '#EADCC8',
    shade: '#CDB698',
    ink: '#3A2D24',
    shadow: 'rgba(0,0,0,0.35)',
    blush: '#F1AE93',
    tongue: '#E48C72',
    scarf: '#D98A66',
    umbrella: '#F0CDB6',
    rain: '#7FB2D9',
    sun: '#F2C14E',
  },
} as const;

/**
 * 홈 타일·말풍선의 말랑한 점토(클레이) 질감.
 *
 * 위쪽 안 그림자는 볼록하게 솟은 면, 아래 바깥 그림자는 바닥에서 뜬 느낌을 만든다.
 * 다크에서 흰 안 그림자를 그대로 두면 테두리가 번쩍여서, 아주 옅게만 남긴다.
 * 누르는 순간(`pressed`)에는 바깥 그림자를 줄여 바닥에 닿은 것처럼 보이게 한다.
 */
export const ClayShadow = {
  light: {
    rest: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -4px 0 rgba(219,120,80,0.07), 0 16px 26px -18px rgba(150,80,50,0.38), 0 2px 6px -3px rgba(45,38,34,0.10)',
    pressed: 'inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(219,120,80,0.06), 0 8px 14px -12px rgba(150,80,50,0.36)',
  },
  dark: {
    rest: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -4px 0 rgba(0,0,0,0.25), 0 16px 26px -18px rgba(0,0,0,0.7), 0 2px 6px -3px rgba(0,0,0,0.4)',
    pressed: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 14px -12px rgba(0,0,0,0.6)',
  },
} as const;
