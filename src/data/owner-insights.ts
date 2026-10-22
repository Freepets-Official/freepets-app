/**
 * 사장님 반려 손님 리포트(무료판) — 지금 있는 사장님 API만으로 만든다.
 *
 * 서버 인사이트 API(`GET /owner/facilities/{id}/insights`, api-specs/owner-plus.md)가 생기기 전까지:
 * - 이번 주 숫자는 매장 목록 응답의 `stats`·리뷰 통계의 관심도·조건 문의 수
 * - "지난주보다"는 앱이 주마다 남겨 둔 스냅샷으로 비교한다(처음 2주는 비교가 없다)
 * - 매장 완성도·확정 배지·망설이는 이유는 매장 정보에서 바로 계산
 *
 * **숫자는 건수다.** 같은 손님이 여러 번 판별·문의할 수 있다 — "명"으로 쓰지 않는다(docs #64 원칙).
 */
import type { OwnerFacility } from '@/lib/api';

/* ───────── 주 단위 스냅샷 ───────── */

export interface WeekSnap {
  /** ISO 주 — '2026-W43' */
  week: string;
  checks: number;
  interest: number;
  inquiries: number;
  reviews: number;
}

/** ISO 8601 주 번호(월요일 시작). KST 날짜 문자열을 받는다 */
export function isoWeek(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // 월=0
  d.setUTCDate(d.getUTCDate() - day + 3); // 그 주 목요일
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** 이번 주 값을 넣는다(같은 주면 덮어쓴다). 최근 12주만 남긴다 */
export function upsertWeek(list: WeekSnap[], snap: WeekSnap): WeekSnap[] {
  const rest = list.filter((w) => w.week !== snap.week);
  return [...rest, snap].sort((a, b) => a.week.localeCompare(b.week)).slice(-12);
}

/** 지난주 대비 증감(없으면 null) */
export function weekChange(list: WeekSnap[], week: string, key: keyof Omit<WeekSnap, 'week'>): number | null {
  const i = list.findIndex((w) => w.week === week);
  if (i <= 0) return null;
  const prev = list[i - 1][key];
  const cur = list[i][key];
  if (prev === 0) return cur === 0 ? 0 : null;
  return (cur - prev) / prev;
}

/* ───────── 확정 배지 ───────── */

/** 확정은 90일 유효(api-specs/monetization-foundation.md 3번과 같은 기준) */
export const CONFIRM_VALID_DAYS = 90;

export type BadgeState =
  | { state: 'none' }
  | { state: 'active' | 'expiring'; daysLeft: number }
  | { state: 'expired'; daysAgo: number };

export function confirmBadge(confirmedAt: string | null, today: string): BadgeState {
  if (!confirmedAt) return { state: 'none' };
  const start = Date.parse(confirmedAt.length <= 10 ? `${confirmedAt}T00:00:00+09:00` : confirmedAt);
  if (Number.isNaN(start)) return { state: 'none' };
  const now = Date.parse(`${today}T00:00:00+09:00`);
  const left = CONFIRM_VALID_DAYS - Math.floor((now - start) / 86_400_000);
  if (left < 0) return { state: 'expired', daysAgo: -left };
  return { state: left <= 14 ? 'expiring' : 'active', daysLeft: left };
}

/* ───────── 매장 완성도 ───────── */

export interface CompletenessItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  /** 고치러 갈 화면 */
  to: '/owner/conditions' | '/owner/promotion' | '/owner/benefits' | '/owner/denials';
  /** 손님에게 얼마나 중요한가 — 점수 가중치 */
  weight: number;
}

/**
 * 손님이 "이 매장 믿고 가도 되겠다"고 느끼는 데 필요한 것들. 무게는 판별·신뢰에 직접 닿는 것(조건 확정·
 * 구체적 조건·거부 제보 해결)을 크게, 꾸밈(소개·태그·혜택)을 작게 둔다.
 */
export function completeness(f: OwnerFacility, benefits: number, today: string): { items: CompletenessItem[]; score: number } {
  const c = f.entryCondition;
  const badge = confirmBadge(c.confirmedAt, today);
  const items: CompletenessItem[] = [
    {
      id: 'confirmed',
      label: '출입 조건 확정',
      hint: badge.state === 'expired' ? '확정한 지 90일이 지났어요. 그대로면 다시 확인만 눌러 주세요' : '사장님이 확정하면 손님 화면에 "확정" 배지가 붙어요',
      done: badge.state === 'active' || badge.state === 'expiring',
      to: '/owner/conditions',
      weight: 3,
    },
    {
      id: 'specific',
      label: '조건을 구체적으로',
      hint: '체중 제한·목줄·케이지 같은 조건이 있어야 손님이 판별을 믿어요',
      done: c.petAllowed === 'DENIED' || c.maxWeight != null || c.requirements.length > 0,
      to: '/owner/conditions',
      weight: 2,
    },
    {
      id: 'denials',
      label: '거부 제보 해결',
      hint: '최근 거부 제보가 있으면 확정이어도 배지가 내려가요',
      done: f.denialAlerts.count === 0,
      to: '/owner/denials',
      weight: 2,
    },
    {
      id: 'intro',
      label: '매장 소개글',
      hint: '반려동물과 오기 좋은 점을 두세 줄로',
      done: (f.profile.introduction ?? '').trim().length >= 20,
      to: '/owner/promotion',
      weight: 1,
    },
    {
      id: 'amenity',
      label: '편의시설 2개 이상',
      hint: '물그릇·펫존·주차처럼 손님이 찾는 것',
      done: f.profile.amenityTags.length >= 2,
      to: '/owner/promotion',
      weight: 1,
    },
    {
      id: 'benefit',
      label: '방문 혜택',
      hint: '출입증 보여 주면 작은 혜택 — 다시 오게 하는 가장 쉬운 방법',
      done: benefits > 0,
      to: '/owner/benefits',
      weight: 1,
    },
  ];
  const total = items.reduce((s, i) => s + i.weight, 0);
  const got = items.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);
  return { items, score: Math.round((got / total) * 100) / 100 };
}

/* ───────── 손님이 망설이는 이유 ───────── */

const ADVICE: Record<string, { title: string; body: string }> = {
  WEIGHT: { title: '체중 기준이 헷갈려요', body: '"7kg 이하"처럼 숫자로, 이하/미만까지 적어 두면 문 앞 거부가 줄어요.' },
  BREED: { title: '견종 제한을 몰랐어요', body: '제한하는 견종이 있으면 조건에 적어 주세요. 손님이 미리 걸러져요.' },
  INDOOR: { title: '실내·실외 구분이 없었어요', body: '"테라스만 가능"처럼 들어갈 수 있는 자리를 적어 주세요.' },
  POLICY_CHANGED: { title: '규정이 바뀌었어요', body: '바뀐 규정을 조건 관리에 반영하면 손님 화면도 바로 바뀌어요.' },
  CROWDED: { title: '붐벼서 못 들어갔어요', body: '반려동물 동반이 어려운 시간대가 있으면 소개글에 적어 주세요.' },
  OTHER: { title: '기타 이유', body: '제보 내용을 확인하고 조건을 한 번 더 살펴 주세요.' },
};

export function hesitations(reasons: string[], inquiries: number): { key: string; count: number; title: string; body: string }[] {
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  const out = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count, ...(ADVICE[key] ?? ADVICE.OTHER) }));
  if (inquiries > 0)
    out.push({
      key: 'INQUIRY',
      count: inquiries,
      title: '조건을 물어본 손님',
      body: '조건이 애매해서 직접 물어본 거예요. 조건을 구체적으로 적고 확정하면 문의가 줄어요.',
    });
  return out;
}
