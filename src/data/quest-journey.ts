import type { DailyQuest, QuestSource } from '@/lib/api';

/**
 * 오늘의 퀘스트 2.0 — "지치지 않게, 매일 조금씩".
 *
 * 예전 퀘스트 화면은 경험치를 주는 여섯 행동의 **하루 상한**(판별 10회, 리뷰 5회…)을 진행률로
 * 보여줬다. "판별 0/10"은 할 일 목록이 아니라 숙제처럼 읽히고, 다 채울 사람도 없다. 게다가
 * 「현장 거부 제보」가 매일 할 일로 뜨면 겪지도 않은 거부를 제보하라는 신호가 된다.
 *
 * 그래서 앱에서 이렇게 다시 짠다(서버 계약은 그대로 — 같은 `quests[]`를 다르게 읽을 뿐이다).
 * 1. **오늘의 세 가지** — 행동마다 목표는 **딱 1번**. 판별은 매일, 나머지 둘은 날마다 돌아간다.
 *    제보·"내 코스가 담기면"은 내가 할 수 있는 일이 아니라 빼고, 보너스 경험치로만 보여준다.
 * 2. **연속 기록** — 하나만 해도 그날은 지킨 것. 7일마다 「쉬는 날 이용권」을 하나 받고(최대 2장),
 *    하루 빠뜨리면 자동으로 쓴다 — 한 번 빠졌다고 0으로 떨어지면 다시 시작할 마음이 사라진다.
 * 3. **간식 상자** — 세 가지를 다 하면 그날 상자 하나. 열면 꼬리 친구 꾸미기 아이템이 나온다.
 * 4. **꾸미기** — 상자·연속 기록 고비마다 모은 소품을 홈의 강아지·고양이에게 씌운다.
 *
 * 경험치·레벨은 서버가 준다. 연속 기록·상자·꾸미기는 서버 API가 없어 **기기에** 남는다
 * (서버 저장은 freepets-docs 제안 문서 참고). 이 파일은 그 규칙만 담은 순수 함수다.
 */

/**
 * "오늘"은 **한국 시간** 날짜다. 서버 퀘스트가 KST 자정에 0으로 돌아가므로 기기 시계(해외 여행·
 * 웹 해외 접속)로 날짜를 세면 어제 한 일이 오늘로 잡히거나 상자를 두 번 열 수 있다.
 */
export const kstYmd = (now = new Date()) => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

/* ───────── 오늘의 세 가지 ───────── */

export interface TrioMeta {
  source: QuestSource;
  title: string;
  hint: string;
  icon: string;
  route: '/(tabs)/explore' | '/course';
  xp: number;
}

export const TRIO_META: Partial<Record<QuestSource, TrioMeta>> = {
  PETCHECK: { source: 'PETCHECK', title: '갈 곳 하나 판별하기', hint: '가고 싶은 곳을 우리 아이 기준으로 확인해요', icon: 'shield-checkmark', route: '/(tabs)/explore', xp: 5 },
  SATISFACTION: { source: 'SATISFACTION', title: '아이 만족도 남기기', hint: '다녀온 곳을 아이가 얼마나 좋아했는지 콕', icon: 'happy', route: '/(tabs)/explore', xp: 10 },
  REVIEW: { source: 'REVIEW', title: '리뷰 한 줄 남기기', hint: '다녀온 곳의 출입 경험을 다른 집사에게', icon: 'create', route: '/(tabs)/explore', xp: 20 },
  COURSE_PUBLISHED: { source: 'COURSE_PUBLISHED', title: '내 여행 코스 공개하기', hint: '판별해 둔 코스를 다른 집사와 나눠요', icon: 'map', route: '/course', xp: 20 },
};

/** 판별은 매일 고정, 나머지 두 자리는 사흘 주기로 돌아간다(코스 공개는 무거워서 사흘에 한 번만) */
const ROTATION: QuestSource[][] = [
  ['SATISFACTION', 'REVIEW'],
  ['REVIEW', 'COURSE_PUBLISHED'],
  ['SATISFACTION', 'REVIEW'],
];

export interface TrioItem extends TrioMeta {
  done: boolean;
}

const dayNumber = (ymd: string) => Math.floor(new Date(`${ymd}T00:00:00Z`).getTime() / 86400000);

export function pickTrio(today: string, quests: DailyQuest[]): TrioItem[] {
  const by = new Map(quests.map((q) => [q.sourceType, q]));
  const picks: QuestSource[] = ['PETCHECK', ...ROTATION[((dayNumber(today) % 3) + 3) % 3]];
  return picks
    .filter((s) => by.has(s) && TRIO_META[s])
    .map((s) => ({ ...(TRIO_META[s] as TrioMeta), done: (by.get(s)?.completed ?? 0) >= 1 }));
}

/** 오늘 경험치를 준 행동이 하나라도 있나 — 연속 기록은 "세 가지 중 하나"가 아니라 이걸로 센다 */
export const activeToday = (quests: DailyQuest[]) => quests.some((q) => q.completed > 0);

/* ───────── 꾸미기 소품 ───────── */

export type ItemSlot = 'head' | 'neck' | 'face';
export type ItemId =
  | 'ribbon'
  | 'bandana'
  | 'flower'
  | 'bowtie'
  | 'star'
  | 'bell'
  | 'beret'
  | 'knit'
  | 'glasses'
  | 'crown';

export interface ItemDef {
  id: ItemId;
  name: string;
  slot: ItemSlot;
  /** 'chest' = 간식 상자, 숫자 = 그만큼 연속했을 때 */
  unlock: 'chest' | number;
}

/** 상자 아이템은 이 순서로 나온다 — 무작위보다 "다음엔 뭐가 나올까"를 기대하게 하되 중복이 없다 */
export const ITEMS: ItemDef[] = [
  { id: 'ribbon', name: '리본', slot: 'head', unlock: 'chest' },
  { id: 'bandana', name: '반다나', slot: 'neck', unlock: 'chest' },
  { id: 'flower', name: '꽃 핀', slot: 'head', unlock: 'chest' },
  { id: 'bowtie', name: '나비넥타이', slot: 'neck', unlock: 'chest' },
  { id: 'star', name: '별 머리핀', slot: 'head', unlock: 'chest' },
  { id: 'bell', name: '방울 목걸이', slot: 'neck', unlock: 'chest' },
  { id: 'beret', name: '베레모', slot: 'head', unlock: 3 },
  { id: 'knit', name: '털목도리', slot: 'neck', unlock: 7 },
  { id: 'glasses', name: '동그란 안경', slot: 'face', unlock: 14 },
  { id: 'crown', name: '작은 왕관', slot: 'head', unlock: 30 },
];
export const itemById = (id: ItemId) => ITEMS.find((i) => i.id === id)!;

export type Outfit = Partial<Record<ItemSlot, ItemId>>;

/* ───────── 상태 ───────── */

export interface JourneyState {
  /** 지금까지 이어 온 날 수(마지막으로 지킨 날 기준) */
  streak: number;
  best: number;
  /** 마지막으로 활동한 날(YYYY-MM-DD) */
  lastActive: string | null;
  /** 쉬는 날 이용권 */
  passes: number;
  /** 최근 활동한 날들 — 주간 점 표시용(최대 14개) */
  history: string[];
  /** 이용권을 쓴 날들(점 대신 다른 표시) */
  passDays: string[];
  /** 마지막으로 상자를 연 날 */
  chestDay: string | null;
  /** 그날 상자에서 나온 소품(다 모은 뒤엔 null) */
  chestItem: ItemId | null;
  chests: number;
  owned: ItemId[];
  outfit: { dog: Outfit; cat: Outfit };
  /** 새로 생겼는데 아직 안 본 아이템(꾸미기 탭의 점) */
  fresh: ItemId[];
  /** 저녁 알림을 켰나 */
  reminder: boolean;
}

export const EMPTY_JOURNEY: JourneyState = {
  streak: 0,
  best: 0,
  lastActive: null,
  passes: 0,
  history: [],
  passDays: [],
  chestDay: null,
  chestItem: null,
  chests: 0,
  owned: [],
  outfit: { dog: {}, cat: {} },
  fresh: [],
  reminder: false,
};

export const MAX_PASSES = 2;
const addDaysYmd = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const daysBetween = (a: string, b: string) => dayNumber(b) - dayNumber(a);

export type JourneyEvent =
  | { kind: 'started' }
  | { kind: 'continued'; streak: number }
  | { kind: 'saved-by-pass'; used: number; streak: number }
  | { kind: 'restarted'; previous: number }
  | { kind: 'pass-earned'; passes: number }
  | { kind: 'item-unlocked'; item: ItemId };

/**
 * 오늘 처음 활동했을 때 한 번 부른다. 이미 오늘 센 날이면 그대로 돌려준다.
 *
 * 빠진 날이 이용권 수 이하면 이용권을 그만큼 쓰고 이어 간다. 그보다 많이 빠졌으면 1부터 다시.
 */
export function markActive(state: JourneyState, today: string): { state: JourneyState; events: JourneyEvent[] } {
  if (state.lastActive === today) return { state, events: [] };
  const events: JourneyEvent[] = [];
  let { streak, passes } = state;
  const passDays = [...state.passDays];
  if (!state.lastActive) {
    streak = 1;
    events.push({ kind: 'started' });
  } else {
    const gap = daysBetween(state.lastActive, today);
    const missed = gap - 1;
    if (gap <= 0) return { state, events: [] };
    if (missed === 0) {
      streak += 1;
      events.push({ kind: 'continued', streak });
    } else if (missed <= passes) {
      passes -= missed;
      for (let i = 1; i <= missed; i++) passDays.push(addDaysYmd(state.lastActive, i));
      streak += 1;
      events.push({ kind: 'saved-by-pass', used: missed, streak });
    } else {
      events.push({ kind: 'restarted', previous: streak });
      streak = 1;
    }
  }
  // 7일을 채울 때마다 이용권 한 장(최대 2장) — 쉬어도 괜찮다는 안심
  if (streak > 0 && streak % 7 === 0 && passes < MAX_PASSES) {
    passes += 1;
    events.push({ kind: 'pass-earned', passes });
  }
  // 연속 기록 고비에 열리는 소품
  const owned = [...state.owned];
  const fresh = [...state.fresh];
  for (const it of ITEMS) {
    if (typeof it.unlock === 'number' && streak >= it.unlock && !owned.includes(it.id)) {
      owned.push(it.id);
      fresh.push(it.id);
      events.push({ kind: 'item-unlocked', item: it.id });
    }
  }
  return {
    state: {
      ...state,
      streak,
      best: Math.max(state.best, streak),
      lastActive: today,
      passes,
      history: [...state.history.filter((d) => daysBetween(d, today) < 14), today],
      passDays: passDays.filter((d) => daysBetween(d, today) < 14),
      owned,
      fresh,
    },
    events,
  };
}

/** 화면에 보일 연속 일수 — 오늘 아직 안 했어도 어제까지 이어졌으면(또는 이용권으로 지킬 수 있으면) 그 수 */
export function visibleStreak(state: JourneyState, today: string): { count: number; atRisk: boolean; doneToday: boolean } {
  if (!state.lastActive) return { count: 0, atRisk: false, doneToday: false };
  const gap = daysBetween(state.lastActive, today);
  if (gap <= 0) return { count: state.streak, atRisk: false, doneToday: true };
  const alive = gap - 1 <= state.passes;
  return { count: alive ? state.streak : 0, atRisk: alive, doneToday: false };
}

/** 오늘 상자를 열 수 있나 */
export const chestReady = (state: JourneyState, today: string, trio: TrioItem[]) =>
  trio.length > 0 && trio.every((t) => t.done) && state.chestDay !== today;

/** 상자를 연다 — 아직 없는 상자 아이템을 순서대로 하나. 다 모았으면 아이템 없이 연 기록만 */
export function openChest(state: JourneyState, today: string): { state: JourneyState; item: ItemId | null } {
  if (state.chestDay === today) return { state, item: null };
  const next = ITEMS.find((i) => i.unlock === 'chest' && !state.owned.includes(i.id));
  return {
    state: {
      ...state,
      chestDay: today,
      chestItem: next?.id ?? null,
      chests: state.chests + 1,
      owned: next ? [...state.owned, next.id] : state.owned,
      fresh: next ? [...state.fresh, next.id] : state.fresh,
    },
    item: next?.id ?? null,
  };
}

/** 입히기·벗기기 — 같은 자리(머리·목·얼굴)는 하나만 */
export function toggleItem(state: JourneyState, who: 'dog' | 'cat', id: ItemId): JourneyState {
  if (!state.owned.includes(id)) return state;
  const slot = itemById(id).slot;
  const cur = state.outfit[who];
  const nextOutfit: Outfit = { ...cur, [slot]: cur[slot] === id ? undefined : id };
  return { ...state, outfit: { ...state.outfit, [who]: nextOutfit }, fresh: state.fresh.filter((f) => f !== id) };
}

/** 저장된 값 검증 — 옛 버전·깨진 값이면 빈 상태 */
export function parseJourney(raw: unknown): JourneyState {
  if (!raw || typeof raw !== 'object') return EMPTY_JOURNEY;
  const r = raw as Partial<JourneyState>;
  const ids = new Set(ITEMS.map((i) => i.id));
  const isYmd = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const items = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is ItemId => ids.has(x)) : []);
  const outfit = (o: unknown): Outfit => {
    if (!o || typeof o !== 'object') return {};
    const out: Outfit = {};
    for (const [slot, id] of Object.entries(o as Record<string, unknown>)) {
      if ((slot === 'head' || slot === 'neck' || slot === 'face') && typeof id === 'string' && ids.has(id as ItemId)) {
        out[slot] = id as ItemId;
      }
    }
    return out;
  };
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const owned = items(r.owned);
  // 가진 적 없는 소품을 입고 있으면 벗긴다(저장값이 깨졌거나 손댄 경우)
  const wearing = (o: unknown): Outfit =>
    Object.fromEntries(Object.entries(outfit(o)).filter(([, id]) => owned.includes(id as ItemId))) as Outfit;
  return {
    streak: num(r.streak),
    best: num(r.best),
    lastActive: isYmd(r.lastActive) ? r.lastActive : null,
    passes: Math.min(MAX_PASSES, num(r.passes)),
    history: Array.isArray(r.history) ? r.history.filter(isYmd).slice(-14) : [],
    passDays: Array.isArray(r.passDays) ? r.passDays.filter(isYmd).slice(-14) : [],
    chestDay: isYmd(r.chestDay) ? r.chestDay : null,
    chestItem: typeof r.chestItem === 'string' && owned.includes(r.chestItem as ItemId) ? (r.chestItem as ItemId) : null,
    chests: num(r.chests),
    owned,
    outfit: { dog: wearing(r.outfit?.dog), cat: wearing(r.outfit?.cat) },
    fresh: items(r.fresh),
    reminder: r.reminder === true,
  };
}
