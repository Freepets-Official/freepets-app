import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  activeToday,
  chestReady,
  EMPTY_JOURNEY,
  markActive,
  openChest,
  parseJourney,
  pickTrio,
  toggleItem,
  visibleStreak,
  type ItemId,
  type JourneyEvent,
  type JourneyState,
} from '@/data/quest-journey';
import { ymd } from '@/data/types';
import { loadDailyQuests } from '@/hooks/use-daily-quests';
import type { DailyQuests } from '@/lib/api';
import { loadJourney, saveJourney } from '@/lib/journey-store';
import { askReminderPermission, cancelQuestReminders, planQuestReminders } from '@/lib/quest-reminder';
import { useAppStore } from '@/store/app-store';

/**
 * 퀘스트 여정(연속 기록·간식 상자·꾸미기)을 홈과 퀘스트 화면이 **같은 값으로** 본다.
 *
 * 모듈에 하나만 들고 있다. 홈에서 상자를 열었는데 퀘스트 화면은 아직 닫힌 상자를 보여주면
 * 안 된다. 서버 퀘스트(`quests[]`)를 받을 때마다 "오늘 뭔가 했나"를 보고 연속 기록을 센다.
 */
type Snap = {
  account: string | null;
  journey: JourneyState;
  quests: DailyQuests | null;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** 방금 생긴 일(연속 +1, 이용권, 소품) — 화면이 축하를 한 번 보여주고 비운다 */
  events: JourneyEvent[];
};

let snap: Snap = { account: null, journey: EMPTY_JOURNEY, quests: null, status: 'idle', events: [] };
const subs = new Set<() => void>();
const set = (patch: Partial<Snap>) => {
  snap = { ...snap, ...patch };
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

let loadedAccount: string | null = null;

function persist(journey: JourneyState) {
  if (snap.account) void saveJourney(snap.account, journey);
}

async function ensureAccount(account: string) {
  if (loadedAccount === account) return;
  loadedAccount = account;
  set({ account, journey: EMPTY_JOURNEY, quests: null, status: 'idle', events: [] });
  const raw = await loadJourney(account);
  if (loadedAccount === account) set({ journey: parseJourney(raw) });
}

/** 서버 퀘스트를 받아 오늘 활동을 반영한다. 화면을 열 때(`fresh`)는 캐시를 건너뛴다 */
async function refresh(fresh: boolean) {
  const account = loadedAccount;
  if (snap.status !== 'ready') set({ status: 'loading' });
  const d = await loadDailyQuests(fresh);
  if (loadedAccount !== account) return;
  if (!d) {
    set({ status: snap.quests ? 'ready' : 'failed' });
    return;
  }
  const today = ymd(new Date());
  let journey = snap.journey;
  let events = snap.events;
  if (activeToday(d.quests)) {
    const r = markActive(journey, today);
    if (r.state !== journey) {
      journey = r.state;
      events = [...events, ...r.events];
      persist(journey);
    }
  }
  set({ quests: d, status: 'ready', journey, events });
  if (journey.reminder) {
    void planQuestReminders({ doneToday: journey.lastActive === today, streak: visibleStreak(journey, today).count });
  }
}

const update = (next: JourneyState) => {
  set({ journey: next });
  persist(next);
};

export function useQuestJourney(enabled: boolean, opts?: { fresh?: boolean }) {
  const { session } = useAppStore();
  const account = enabled && session.authed ? session.email ?? 'me' : null;
  const s = useSyncExternalStore(subscribe, () => snap, () => snap);
  const fresh = !!opts?.fresh;

  useEffect(() => {
    if (!account) return;
    let alive = true;
    void ensureAccount(account).then(() => {
      if (alive) void refresh(fresh);
    });
    return () => {
      alive = false;
    };
  }, [account, fresh]);

  const today = ymd(new Date());
  const trio = s.quests ? pickTrio(today, s.quests.quests) : [];
  const streak = visibleStreak(s.journey, today);

  const open = useCallback((): ItemId | null => {
    const r = openChest(snap.journey, ymd(new Date()));
    update(r.state);
    return r.item;
  }, []);
  const toggle = useCallback((who: 'dog' | 'cat', id: ItemId) => update(toggleItem(snap.journey, who, id)), []);
  const consumeEvents = useCallback(() => {
    if (snap.events.length) set({ events: [] });
  }, []);
  /** 저녁 알림 켜기·끄기. 켤 때 권한을 못 받으면 false — 화면이 이유를 말한다 */
  const setReminder = useCallback(async (on: boolean): Promise<boolean> => {
    if (on && !(await askReminderPermission())) return false;
    const next = { ...snap.journey, reminder: on };
    update(next);
    const t = ymd(new Date());
    if (on) await planQuestReminders({ doneToday: next.lastActive === t, streak: visibleStreak(next, t).count });
    else await cancelQuestReminders();
    return true;
  }, []);
  const reload = useCallback(() => refresh(true), []);

  return {
    status: account ? s.status : 'idle',
    quests: s.quests,
    journey: s.journey,
    events: s.events,
    today,
    trio,
    trioDone: trio.filter((t) => t.done).length,
    streak,
    chestReady: chestReady(s.journey, today, trio),
    openChest: open,
    toggleItem: toggle,
    consumeEvents,
    setReminder,
    reload,
  };
}
