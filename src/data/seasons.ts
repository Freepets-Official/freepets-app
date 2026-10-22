/**
 * 계절 — 달력이 아니라 **날씨**로 정한다(기상청 기후학적 계절).
 *
 * 일평균기온 9일 이동평균이 5℃ 이상으로 올라 내려가지 않으면 봄, 20℃ 이상이면 여름,
 * 20℃ 아래로 내려가면 가을, 5℃ 아래면 겨울. 그래서 "가을 리캡"은 9월 1일이 아니라
 * 실제로 추워져 겨울이 시작되는 날 열린다(docs/19 · api-specs/season-recap.md).
 *
 * 서버 계절 판정(`GET /seasons/current`)이 생기기 전까지는 앱이 한다.
 * - 지난 계절 시작일은 서울 일평균기온 과거 자료로 미리 계산해 둔 표(`KNOWN_STARTS`)
 * - 다음 계절은 최근 기온으로 앱이 판정한다(`detectNextStart`)
 */
export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';

export const SEASON_LABEL: Record<Season, string> = { SPRING: '봄', SUMMER: '여름', AUTUMN: '가을', WINTER: '겨울' };
export const NEXT_SEASON: Record<Season, Season> = { SPRING: 'SUMMER', SUMMER: 'AUTUMN', AUTUMN: 'WINTER', WINTER: 'SPRING' };

export interface SeasonStart {
  season: Season;
  /** 겨울은 시작한 해(2025 겨울 = 2025-11 ~ 2026-03) */
  year: number;
  startsOn: string;
}

export interface SeasonSpan extends SeasonStart {
  /** 마지막 날. 아직 진행 중이면 null */
  endsOn: string | null;
}

/**
 * 서울(37.57, 126.97) 일평균기온 9일 중심 이동평균으로 계산한 시작일. 재분석 격자 자료라
 * 기상청 서울 관측소(108) 값과 하루 이틀 다를 수 있다 — 서버 판정이 생기면 그걸 따른다.
 */
export const KNOWN_STARTS: SeasonStart[] = [
  { season: 'AUTUMN', year: 2025, startsOn: '2025-10-02' },
  { season: 'WINTER', year: 2025, startsOn: '2025-11-29' },
  { season: 'SPRING', year: 2026, startsOn: '2026-03-16' },
  { season: 'SUMMER', year: 2026, startsOn: '2026-05-25' },
  { season: 'AUTUMN', year: 2026, startsOn: '2026-09-29' },
];

/** 리캡을 여는 첫 계절 — 기능이 생기기 전 계절까지 한꺼번에 열면 시끄럽다 */
export const RECAP_SINCE = '2026-05-25';

/** 이 계절이 끝났다고 보는 기온 조건(9일 평균) */
const CROSSED: Record<Season, (avg: number) => boolean> = {
  WINTER: (v) => v >= 5, // 겨울이 끝나고 봄
  SPRING: (v) => v >= 20, // 봄이 끝나고 여름
  SUMMER: (v) => v < 20, // 여름이 끝나고 가을
  AUTUMN: (v) => v < 5, // 가을이 끝나고 겨울
};

/** 다음 계절로 확정하려면 문턱을 넘은 채 며칠 버텨야 하나 — 꽃샘추위·늦더위에 속지 않게 */
export const CONFIRM_DAYS = 7;

/**
 * 최근 일평균기온으로 다음 계절 시작일을 판정한다. 아직이면 null.
 *
 * 기상청 정의("다시 돌아오지 않는 첫날")는 지나 봐야 안다. 그래서 **뒤쪽 9일 평균**이 문턱을
 * 넘은 날을 후보로 보고, 그 뒤 `CONFIRM_DAYS`일 동안 계속 넘어 있으면 그 후보일을 시작일로 확정한다.
 */
export function detectNextStart(current: SeasonStart, daily: { date: string; mean: number }[]): string | null {
  const sorted = daily.filter((d) => d.date > current.startsOn).sort((a, b) => a.date.localeCompare(b.date));
  const avg: { date: string; v: number }[] = [];
  for (let i = 8; i < sorted.length; i++) {
    const w = sorted.slice(i - 8, i + 1);
    avg.push({ date: sorted[i].date, v: w.reduce((s, d) => s + d.mean, 0) / 9 });
  }
  const crossed = CROSSED[current.season];
  for (let i = 0; i + CONFIRM_DAYS <= avg.length; i++) {
    if (avg.slice(i, i + CONFIRM_DAYS).every((a) => crossed(a.v))) return avg[i].date;
  }
  return null;
}

/** 시작일 목록 → 계절 구간. 마지막 계절은 진행 중(endsOn null) */
export function toSpans(starts: SeasonStart[]): SeasonSpan[] {
  const s = [...starts].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return s.map((x, i) => ({ ...x, endsOn: s[i + 1] ? addDays(s[i + 1].startsOn, -1) : null }));
}

/** 판정한 다음 계절 시작일을 표에 붙인다 */
export function withDetected(starts: SeasonStart[], next: string | null): SeasonStart[] {
  if (!next) return starts;
  const last = [...starts].sort((a, b) => a.startsOn.localeCompare(b.startsOn)).at(-1)!;
  const season = NEXT_SEASON[last.season];
  // 겨울은 시작한 해, 나머지는 시작일의 해
  const year = Number(next.slice(0, 4));
  return [...starts, { season, year, startsOn: next }];
}

export const recapId = (s: SeasonStart) => `${s.year}-${s.season}`;

export function parseRecapId(id: string): { year: number; season: Season } | null {
  const m = /^(\d{4})-(SPRING|SUMMER|AUTUMN|WINTER)$/.exec(id);
  return m ? { year: Number(m[1]), season: m[2] as Season } : null;
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
