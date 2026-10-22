/**
 * 여행 안심 키트 — 떠나기 전에 "우리 아이가 이번 여행을 무사히 갈 수 있나"를 한 화면에서 본다.
 *
 * 무료로 둔다(docs/19 꼬리패스 표: 출발 전 체크는 무료, 근처 동물병원 서버 검색만 유료).
 * 출입 판별이 "그곳에 들어갈 수 있나"라면 키트는 "이 아이가 떠날 준비가 됐나"다.
 * 규칙은 순수 함수로 두어 화면·알림·홈 말풍선이 같은 답을 낸다.
 */
import type { CalendarEvent, Pet } from '@/data/types';

export interface TripWindow {
  start: string;
  end: string;
  /** 박 수(당일치기 0) */
  nights: number;
  /** 오늘 기준 출발까지 남은 날. 여행 중이면 0, 끝났으면 음수 */
  dday: number;
  ongoing: boolean;
}

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function tripWindow(e: Pick<CalendarEvent, 'date' | 'endDate'>, today: string): TripWindow {
  const start = e.date;
  const end = e.endDate && e.endDate > e.date ? e.endDate : e.date;
  const ongoing = start <= today && today <= end;
  return { start, end, nights: dayDiff(start, end), dday: ongoing ? 0 : dayDiff(today, start), ongoing };
}

/** 키트를 권할 여행 — 진행 중이거나 14일 안에 떠나는 가장 가까운 여행 */
export const KIT_HORIZON = 14;

export function nextTrip(eventsOn: (date: string) => CalendarEvent[], today: string): CalendarEvent | null {
  for (let i = 0; i <= KIT_HORIZON; i++) {
    const t = eventsOn(addDays(today, i)).find((e) => e.type === 'TRAVEL');
    if (t) return t;
  }
  return null;
}

/* ───────── 건강 체크 ───────── */

export type CheckStatus = 'ok' | 'warn' | 'bad' | 'info';

export interface HealthItem {
  id: string;
  petId: number;
  status: CheckStatus;
  title: string;
  detail: string;
  /** 화면이 붙일 버튼 */
  fix?: 'pet' | 'add-vaccine' | 'add-preventive';
}

/** 예방약으로 보는 복용 일정 제목 — 사용자가 직접 적은 이름이라 낱말로 찾는다 */
const PREVENTIVE = /심장사상충|하트가드|넥스가드|브라벡토|레볼루션|구충|진드기|외부\s*기생충|내부\s*기생충|애드보킷|프론트라인/;
const VACCINATED_KINDS = new Set(['DOG', 'CAT']);

export interface HealthContext {
  /** 그날 일정(반복 반영) */
  eventsOn: (date: string) => CalendarEvent[];
  isMedTaken: (eventId: number, date: string) => boolean;
  today: string;
}

export function healthChecks(pets: Pet[], trip: TripWindow, ctx: HealthContext): HealthItem[] {
  const out: HealthItem[] = [];
  for (const p of pets) {
    if (VACCINATED_KINDS.has(p.kind)) {
      const next = p.nextVaccinationDate;
      if (!p.vaccinated && !next) {
        out.push({ id: `vax-${p.petId}`, petId: p.petId, status: 'bad', title: '접종 기록이 없어요', detail: '접종을 마쳤다면 기록해 두세요. 숙소·카페에서 물어보는 곳이 있어요.', fix: 'pet' });
      } else if (next && next < trip.start) {
        out.push({ id: `vax-${p.petId}`, petId: p.petId, status: 'bad', title: '접종 기한이 지났어요', detail: `${md(next)}이 예정일이었어요. 떠나기 전에 병원에 들러 주세요.`, fix: 'add-vaccine' });
      } else if (next && next <= trip.end) {
        out.push({ id: `vax-${p.petId}`, petId: p.petId, status: 'warn', title: '여행 중에 접종일이 와요', detail: `${md(next)} 예정이에요. 떠나기 전에 맞히면 마음 편해요.`, fix: 'add-vaccine' });
      } else {
        out.push({ id: `vax-${p.petId}`, petId: p.petId, status: 'ok', title: '접종 괜찮아요', detail: next ? `다음 접종은 ${md(next)}` : '접종 완료로 기록돼 있어요' });
      }

      // 최근 35일 안 예방약 — 숲·바다 여행에서 진드기·모기를 만나기 쉽다
      let found = false;
      let taken = false;
      for (let i = 0; i <= 35 && !taken; i++) {
        const d = addDays(ctx.today, -i);
        for (const e of ctx.eventsOn(d)) {
          if (e.type !== 'MED' || !PREVENTIVE.test(e.title) || (e.petId !== null && e.petId !== p.petId)) continue;
          found = true;
          if (ctx.isMedTaken(e.eventId, d)) taken = true;
        }
      }
      out.push(
        taken
          ? { id: `prev-${p.petId}`, petId: p.petId, status: 'ok', title: '예방약 챙겼어요', detail: '최근 한 달 안에 먹은 기록이 있어요' }
          : found
            ? { id: `prev-${p.petId}`, petId: p.petId, status: 'warn', title: '예방약 체크가 비어 있어요', detail: '일정은 있는데 최근 한 달 먹은 체크가 없어요. 먹였다면 캘린더에서 체크해 주세요.' }
            : { id: `prev-${p.petId}`, petId: p.petId, status: 'info', title: '예방약 일정이 없어요', detail: '심장사상충·진드기 예방약을 먹고 있다면 캘린더에 넣어 두면 챙겨 드려요.', fix: 'add-preventive' },
      );
    }
    if (!p.weight || p.weight <= 0) {
      out.push({ id: `w-${p.petId}`, petId: p.petId, status: 'warn', title: '몸무게가 비어 있어요', detail: '체중 제한이 있는 곳이 많아 판별이 부정확해져요.', fix: 'pet' });
    }
  }
  return out;
}

/* ───────── 준비물 ───────── */

export interface PackItem {
  id: string;
  label: string;
  /** 왜 필요한지 / 몇 개 */
  hint?: string;
}
export interface PackSection {
  key: string;
  title: string;
  items: PackItem[];
}

/**
 * 아이 종류·크기·박 수로 준비물을 만든다. **많이 나열하지 않는다** — 다 챙기라고 하면 하나도 안 본다.
 * 꼭 필요한 것 위주로, 박 수에 따라 양만 바꾼다.
 */
export function packingList(pets: Pet[], nights: number): PackSection[] {
  const has = (k: Pet['kind']) => pets.some((p) => p.kind === k);
  const dog = has('DOG');
  const cat = has('CAT');
  const small = pets.some((p) => !VACCINATED_KINDS.has(p.kind));
  const big = pets.some((p) => p.breedSize === 'LARGE');
  const days = nights + 1;

  const must: PackItem[] = [];
  if (dog) must.push({ id: 'leash', label: '목줄·하네스', hint: '대부분의 동반 시설이 목줄을 요구해요' });
  if (cat || small) must.push({ id: 'carrier', label: '이동장', hint: '고양이·작은 동물은 이동장 안에서만 들어가는 곳이 많아요' });
  else must.push({ id: 'carrier', label: '이동장·켄넬', hint: '카페·식당에서 "케이지 안에서"만 허용하는 곳이 있어요' });
  must.push({ id: 'tag', label: '인식표', hint: '낯선 곳에서 잃어버리면 가장 먼저 찾는 단서예요' });

  const food: PackItem[] = [
    { id: 'food', label: `사료 ${days + 1}일치`, hint: `${days}일 + 하루 여유. 평소 먹던 걸로` },
    { id: 'water', label: '물·휴대용 물그릇' },
    { id: 'treat', label: '간식', hint: '낯선 곳에서 진정시키는 데 좋아요' },
  ];

  const clean: PackItem[] = [];
  if (dog) clean.push({ id: 'poop', label: '배변봉투', hint: `산책 횟수 × ${days}일` });
  if (dog) clean.push({ id: 'pad', label: '배변패드', hint: '숙소마다 제공 여부가 달라요' });
  if (cat) clean.push({ id: 'litter', label: '휴대용 화장실·모래' });
  clean.push({ id: 'towel', label: '수건·물티슈' });
  if (dog && pets.some((p) => p.kind === 'DOG' && p.gender === 'MALE')) clean.push({ id: 'belt', label: '매너벨트', hint: '실내 마킹이 걱정되면' });

  const comfort: PackItem[] = [
    { id: 'blanket', label: '쓰던 담요·방석', hint: '집 냄새가 나는 물건이 낯선 숙소에서 안정을 줘요' },
    { id: 'meds', label: '상비약·먹는 약' },
  ];
  if (big) comfort.push({ id: 'seat', label: '차량용 시트 커버' });
  if (nights >= 2) comfort.push({ id: 'brush', label: '빗·목욕용품' });

  const docs: PackItem[] = [
    { id: 'vaxdoc', label: '접종증명서', hint: '아래 서류함에 사진으로 넣어 두면 돼요' },
  ];
  if (dog) docs.push({ id: 'regdoc', label: '동물등록증', hint: '2개월 이상 반려견은 등록이 의무예요' });

  return [
    { key: 'must', title: '꼭 챙겨요', items: must },
    { key: 'food', title: '먹을 것', items: food },
    { key: 'clean', title: '위생', items: clean },
    { key: 'comfort', title: '편안하게', items: comfort },
    { key: 'docs', title: '서류', items: docs },
  ];
}

/** 준비 정도(0~1) — 건강 체크 절반, 준비물 절반. 알림·홈 말풍선이 같은 값을 쓴다 */
export function readiness(health: HealthItem[], packIds: string[], checked: string[]): number {
  const hScore = health.length ? health.filter((h) => h.status === 'ok' || h.status === 'info').length / health.length : 1;
  const pScore = packIds.length ? packIds.filter((id) => checked.includes(id)).length / packIds.length : 1;
  return Math.round((hScore * 0.5 + pScore * 0.5) * 100) / 100;
}

const md = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;
