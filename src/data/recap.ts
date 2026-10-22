/**
 * 계절 리캡 — 한 계절 동안 우리 아이와 한 일을 모은다(순수 함수).
 *
 * 서버 리캡(`GET /me/recaps/{id}`)이 생기기 전까지 앱이 가진 기록으로 만든다.
 * - 판별: 서버 판별 이력
 * - 도장: 기기 도장첩
 * - 사진·글: 기기 하루 기록
 * - 여행: 캘린더 여행 일정
 */
import type { DiaryMap } from '@/data/day-diary';
import type { Stamp } from '@/data/stamps';

export interface RecapCheck {
  facilityId: number;
  overall: string;
  /** ISO — KST 날짜로 자른다 */
  createdAt: string;
}

export interface RecapInput {
  from: string;
  to: string;
  checks: RecapCheck[];
  stamps: Stamp[];
  diary: DiaryMap;
  /** 여행 일정이 걸친 날(YYYY-MM-DD) */
  travelDays: string[];
}

export interface Recap {
  /** FULL 보여 줄 게 충분 · LIGHT 짧은 판 · EMPTY 아무 기록 없음(목록에서 뺀다) */
  size: 'FULL' | 'LIGHT' | 'EMPTY';
  checks: number;
  /** 동반 가능으로 나온 곳(중복 제거) */
  allowedPlaces: number;
  stamps: number;
  /** 도장 찍은 시군구 — 처음 간 순서 */
  regions: string[];
  /** 이 계절 전에는 한 번도 도장이 없던 시도 */
  firstRegion: string | null;
  travelDays: number;
  diaryDays: number;
  /** 대표 사진(하루 한 장 먼저, 최대 9장) */
  photos: { date: string; uri: string }[];
  /** 가장 자주 판별·도장한 곳(2번 이상일 때만) */
  topPlace: { facilityId: number; name: string | null; count: number } | null;
  /** 기록이 가장 많았던 날 */
  bestDay: { date: string; note: string } | null;
}

/** ISO 시각 → KST 날짜 */
export function kstDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  return new Date(t + 9 * 3_600_000).toISOString().slice(0, 10);
}

const inRange = (d: string, from: string, to: string) => d >= from && d <= to;

export function buildRecap(input: RecapInput): Recap {
  const { from, to } = input;
  const checks = input.checks.filter((c) => inRange(kstDate(c.createdAt), from, to));
  const stamps = input.stamps
    .filter((s) => inRange(kstDate(s.createdAt), from, to))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const before = input.stamps.filter((s) => kstDate(s.createdAt) < from);
  const diaryDays = Object.keys(input.diary)
    .filter((d) => inRange(d, from, to))
    .sort();
  const travelDays = new Set(input.travelDays.filter((d) => inRange(d, from, to))).size;

  const allowed = new Set(checks.filter((c) => c.overall === 'ALLOWED').map((c) => c.facilityId));

  const regions: string[] = [];
  for (const s of stamps) {
    const r = [s.sido, s.sigungu].filter(Boolean).join(' ');
    if (r && !regions.includes(r)) regions.push(r);
  }
  const seenSido = new Set(before.map((s) => s.sido));
  const firstRegion = stamps.find((s) => s.sido && !seenSido.has(s.sido));

  // 하루 한 장씩 먼저 고르고, 자리가 남으면 두 번째 사진부터 채운다 — 한 날 사진만 가득하지 않게
  const photos: { date: string; uri: string }[] = [];
  for (let round = 0; round < 6 && photos.length < 9; round++) {
    for (const d of diaryDays) {
      const u = input.diary[d].photos[round];
      if (u && photos.length < 9) photos.push({ date: d, uri: u });
    }
  }

  const counts = new Map<number, number>();
  for (const c of checks) counts.set(c.facilityId, (counts.get(c.facilityId) ?? 0) + 1);
  for (const s of stamps) counts.set(s.facilityId, (counts.get(s.facilityId) ?? 0) + 1);
  let top: Recap['topPlace'] = null;
  for (const [facilityId, count] of counts) {
    if (count >= 2 && (!top || count > top.count)) top = { facilityId, name: null, count };
  }
  if (top) top.name = stamps.find((s) => s.facilityId === top!.facilityId)?.facilityName ?? null;

  let bestDay: Recap['bestDay'] = null;
  let bestScore = 0;
  for (const d of diaryDays) {
    const e = input.diary[d];
    const score = e.photos.length * 2 + (e.note.trim() ? 3 : 0);
    if (score > bestScore && e.note.trim()) {
      bestScore = score;
      bestDay = { date: d, note: e.note.trim() };
    }
  }

  const activity = checks.length + stamps.length + diaryDays.length + travelDays;
  const size: Recap['size'] = activity === 0 ? 'EMPTY' : activity < 4 ? 'LIGHT' : 'FULL';

  return {
    size,
    checks: checks.length,
    allowedPlaces: allowed.size,
    stamps: stamps.length,
    regions,
    firstRegion: firstRegion ? [firstRegion.sido, firstRegion.sigungu].filter(Boolean).join(' ') : null,
    travelDays,
    diaryDays: diaryDays.length,
    photos,
    topPlace: top,
    bestDay,
  };
}
