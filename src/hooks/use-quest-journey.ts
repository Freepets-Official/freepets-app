import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  activeToday,
  chestReady,
  EMPTY_JOURNEY,
  kstYmd,
  markActive,
  openChest,
  unlockByStamps,
  parseJourney,
  pickTrio,
  toggleItem,
  visibleStreak,
  type ItemId,
  type JourneyEvent,
  type JourneyState,
} from '@/data/quest-journey';
import { loadDailyQuests } from '@/hooks/use-daily-quests';
import { seasonNow } from '@/hooks/use-season-recap';
import type { DailyQuests } from '@/lib/api';
import { loadJourney, saveJourney } from '@/lib/journey-store';
import { askReminderPermission, cancelQuestReminders, planQuestReminders } from '@/lib/quest-reminder';
import { useAppStore } from '@/store/app-store';

/**
 * 퀘스트 여정(연속 기록·간식 상자·꾸미기)을 홈과 퀘스트 화면이 **같은 값으로** 본다.
 *
 * 모듈에 하나만 들고 있다. 홈에서 상자를 열었는데 퀘스트 화면은 아직 닫힌 상자를 보여주면
 * 안 된다. 서버 퀘스트(`quests[]`)를 받을 때마다 "오늘 뭔가 했나"를 보고 연속 기록을 센다.
 *
 * **언제 다시 받나.** 홈 탭은 앱이 사는 동안 다시 마운트되지 않는다. 마운트할 때만 받으면 앱을
 * 연 뒤에 한 판별이 연속 기록에 안 잡히고, 다음 날 서버 값이 자정에 0이 되면 그날은 영영
 * 빠진다(독립 리뷰 지적). 그래서 화면에 돌아올 때 · 앱으로 돌아올 때 · 경험치가 바뀔 때마다 받는다.
 */
type Snap = {
  /** 저장 키. `''`면 로그인은 했지만 계정을 가를 값을 아직 모른다 — 퀘스트만 보이고 저장하지 않는다 */
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
/**
 * 계정 기록을 읽는 중인 약속. 홈과 퀘스트 화면이 거의 동시에 뜨면 둘째가 읽기를 기다리지 않고
 * 빈 기록으로 오늘을 세서 저장된 연속 기록을 덮어쓸 수 있었다 — 같은 계정이면 같은 약속을 기다린다.
 */
let loading: Promise<void> = Promise.resolve();
let lastFetchAt = 0;

const persistable = () => !!snap.account;
function persist(journey: JourneyState) {
  if (snap.account) void saveJourney(snap.account, journey);
}

function ensureAccount(account: string): Promise<void> {
  if (loadedAccount === account) return loading;
  loadedAccount = account;
  set({ account, journey: EMPTY_JOURNEY, quests: null, status: 'idle', events: [] });
  loading = (async () => {
    if (!account) return;
    const raw = await loadJourney(account);
    if (loadedAccount === account) set({ journey: parseJourney(raw) });
  })();
  return loading;
}

function syncReminders(journey: JourneyState, today: string) {
  if (!persistable()) return;
  if (journey.reminder) {
    void planQuestReminders({
      doneToday: journey.lastActive === today,
      streak: visibleStreak(journey, today).count,
      stillWanted: () => snap.journey.reminder,
    });
  } else {
    void cancelQuestReminders();
  }
}

/** 서버 퀘스트를 받아 오늘 활동을 반영한다. `fresh`면 캐시를 건너뛴다(짧은 간격의 반복은 캐시) */
async function refresh(fresh: boolean) {
  const account = loadedAccount;
  await loading;
  if (loadedAccount !== account) return;
  if (snap.status !== 'ready') set({ status: 'loading' });
  const useFresh = fresh && Date.now() - lastFetchAt > 15_000;
  if (useFresh) lastFetchAt = Date.now();
  const d = await loadDailyQuests(useFresh);
  if (loadedAccount !== account) return;
  if (!d) {
    set({ status: snap.quests ? 'ready' : 'failed' });
    return;
  }
  const today = kstYmd();
  let journey = snap.journey;
  let events = snap.events;
  if (persistable() && activeToday(d.quests)) {
    const r = markActive(journey, today);
    if (r.state !== journey) {
      journey = r.state;
      events = [...events, ...r.events];
      persist(journey);
    }
  }
  set({ quests: d, status: 'ready', journey, events });
  syncReminders(journey, today);
}

const update = (next: JourneyState) => {
  set({ journey: next });
  persist(next);
};

export function useQuestJourney(enabled: boolean, opts?: { fresh?: boolean }) {
  const { session, myUserId, gamification, stamps } = useAppStore();
  /**
   * 계정을 가르는 키는 **서버 userId**다. 이메일은 애플 재로그인·이메일 동의를 안 한 카카오에서
   * 빈 문자열로 와서, 그걸 키로 쓰면 퀘스트가 영영 로딩이거나 그런 계정끼리 기록이 섞였다.
   * userId를 아직 모르면 이메일, 그것도 없으면 `''` — 퀘스트는 보여주되 기록은 남기지 않는다.
   */
  const account =
    enabled && session.authed ? (myUserId != null ? `u${myUserId}` : session.email ? `e${session.email}` : '') : null;
  const s = useSyncExternalStore(subscribe, () => snap, () => snap);
  const fresh = !!opts?.fresh;

  useEffect(() => {
    if (account === null) return;
    let alive = true;
    void ensureAccount(account).then(() => {
      if (alive) void refresh(fresh);
    });
    return () => {
      alive = false;
    };
  }, [account, fresh]);

  // 화면에 돌아올 때 · 앱으로 돌아올 때
  const on = account !== null;
  useFocusEffect(
    useCallback(() => {
      if (on) void refresh(true);
    }, [on]),
  );
  useEffect(() => {
    if (!on) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void refresh(true);
    });
    return () => sub.remove();
  }, [on]);
  // 여권 도장이 쌓이면 여행 세트 소품이 열린다(도장 3개 배낭 · 10개 카메라)
  const stampCount = stamps.length;
  useEffect(() => {
    if (account === null) return;
    void loading.then(() => {
      if (!snap.account || loadedAccount !== account) return;
      const r = unlockByStamps(snap.journey, stampCount);
      if (r.state === snap.journey) return;
      set({ journey: r.state, events: [...snap.events, ...r.events] });
      persist(r.state);
    });
  }, [account, stampCount]);

  // 판별·리뷰 같은 행동 뒤 스토어가 경험치를 다시 받는다 — 그때 퀘스트도 다시 센다
  const seenGami = useRef(gamification);
  useEffect(() => {
    if (seenGami.current === gamification) return;
    seenGami.current = gamification;
    if (on) void refresh(true);
  }, [gamification, on]);

  const today = kstYmd();
  const mine = account !== null && s.account === account;
  const journey = mine ? s.journey : EMPTY_JOURNEY;
  const quests = mine ? s.quests : null;
  const trio = quests ? pickTrio(today, quests.quests) : [];
  const streak = visibleStreak(journey, today);

  const open = useCallback((): ItemId | null => {
    if (!snap.account) return null;
    // 지금 계절의 한정 소품이 남아 있으면 상자에서 나올 수 있다
    const r = openChest(snap.journey, kstYmd(), seasonNow());
    update(r.state);
    return r.item;
  }, []);
  const toggle = useCallback((who: 'dog' | 'cat', id: ItemId) => update(toggleItem(snap.journey, who, id)), []);
  const consumeEvents = useCallback(() => {
    if (snap.events.length) set({ events: [] });
  }, []);
  /** 저녁 알림 켜기·끄기. 켤 때 권한을 못 받으면 false — 화면이 이유를 말한다 */
  const setReminder = useCallback(async (next: boolean): Promise<boolean> => {
    if (next && !(await askReminderPermission())) return false;
    const j = { ...snap.journey, reminder: next };
    update(j);
    syncReminders(j, kstYmd());
    return true;
  }, []);
  const reload = useCallback(() => refresh(true), []);

  return {
    status: mine ? s.status : 'idle',
    quests,
    journey,
    events: mine ? s.events : [],
    /** 기기에 기록을 남길 수 있나(계정을 가를 값을 아는가) */
    canKeep: mine && !!s.account,
    today,
    trio,
    trioDone: trio.filter((t) => t.done).length,
    streak,
    chestReady: mine && !!s.account && chestReady(journey, today, trio),
    openChest: open,
    toggleItem: toggle,
    consumeEvents,
    setReminder,
    reload,
  };
}
