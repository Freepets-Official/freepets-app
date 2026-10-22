import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { deleteDiaryPhoto, storeDiaryPhoto } from '@/lib/diary-store';
import { loadKitRaw, saveKitRaw } from '@/lib/kit-store';
import { useAppStore } from '@/store/app-store';

/**
 * 여행 안심 키트의 기기 기록 — 여행별 준비물 체크와 아이별 서류 사진.
 * 홈 말풍선(남은 준비물 수)과 키트 화면이 같은 값을 본다(모듈에 하나).
 */
export interface KitState {
  trips: Record<string, { checked: string[]; custom: { id: string; label: string }[] }>;
  /** petId → 서류 사진(접종증명서·동물등록증), 최대 4장 */
  docs: Record<string, string[]>;
}
const EMPTY: KitState = { trips: {}, docs: {} };
export const DOC_MAX = 4;

function parse(raw: unknown): KitState {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const r = raw as Partial<KitState>;
  const trips: KitState['trips'] = {};
  for (const [k, v] of Object.entries(r.trips ?? {})) {
    if (!v || typeof v !== 'object') continue;
    trips[k] = {
      checked: Array.isArray(v.checked) ? v.checked.filter((x): x is string => typeof x === 'string') : [],
      custom: Array.isArray(v.custom)
        ? v.custom.filter((c): c is { id: string; label: string } => typeof c?.id === 'string' && typeof c?.label === 'string').slice(0, 20)
        : [],
    };
  }
  const docs: KitState['docs'] = {};
  for (const [k, v] of Object.entries(r.docs ?? {})) {
    if (Array.isArray(v)) docs[k] = v.filter((x): x is string => typeof x === 'string').slice(0, DOC_MAX);
  }
  return { trips, docs };
}

let snap: { account: string | null; state: KitState } = { account: null, state: EMPTY };
const subs = new Set<() => void>();
const set = (next: typeof snap) => {
  snap = next;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
let loaded: string | null = null;

function ensure(account: string) {
  if (loaded === account) return;
  loaded = account;
  set({ account, state: EMPTY });
  void loadKitRaw(account).then((raw) => {
    if (loaded === account) set({ account, state: parse(raw) });
  });
}

function commit(account: string, next: KitState) {
  set({ account, state: next });
  void saveKitRaw(account, next);
}

export function useTripKit() {
  const { session, myUserId } = useAppStore();
  // 하루 기록·퀘스트와 같은 계정 규칙
  const account = session.authed ? (myUserId != null ? `u${myUserId}` : session.email ? `e${session.email}` : '') : null;
  const s = useSyncExternalStore(subscribe, () => snap, () => snap);
  useEffect(() => {
    if (account) ensure(account);
  }, [account]);
  const mine = !!account && s.account === account;
  const state = mine ? s.state : EMPTY;

  const trip = useCallback((eventId: number) => state.trips[String(eventId)] ?? { checked: [], custom: [] }, [state]);

  const toggle = useCallback(
    (eventId: number, itemId: string) => {
      if (!account || snap.account !== account) return;
      const cur = snap.state.trips[String(eventId)] ?? { checked: [], custom: [] };
      const checked = cur.checked.includes(itemId) ? cur.checked.filter((x) => x !== itemId) : [...cur.checked, itemId];
      commit(account, { ...snap.state, trips: { ...snap.state.trips, [String(eventId)]: { ...cur, checked } } });
    },
    [account],
  );

  const addCustom = useCallback(
    (eventId: number, label: string) => {
      const text = label.trim().slice(0, 30);
      if (!text || !account || snap.account !== account) return;
      const cur = snap.state.trips[String(eventId)] ?? { checked: [], custom: [] };
      if (cur.custom.length >= 20) return;
      const id = `c-${Date.now().toString(36)}`;
      commit(account, { ...snap.state, trips: { ...snap.state.trips, [String(eventId)]: { ...cur, custom: [...cur.custom, { id, label: text }] } } });
    },
    [account],
  );

  const removeCustom = useCallback(
    (eventId: number, id: string) => {
      if (!account || snap.account !== account) return;
      const cur = snap.state.trips[String(eventId)];
      if (!cur) return;
      commit(account, {
        ...snap.state,
        trips: { ...snap.state.trips, [String(eventId)]: { checked: cur.checked.filter((x) => x !== id), custom: cur.custom.filter((c) => c.id !== id) } },
      });
    },
    [account],
  );

  /** 서류 사진을 넣는다. 기기에 못 남기면 false */
  const addDoc = useCallback(
    async (petId: number, src: string): Promise<boolean> => {
      if (!account) return false;
      const uri = await storeDiaryPhoto(account, src);
      if (!uri || snap.account !== account) return false;
      const list = snap.state.docs[String(petId)] ?? [];
      if (list.length >= DOC_MAX) return false;
      commit(account, { ...snap.state, docs: { ...snap.state.docs, [String(petId)]: [...list, uri] } });
      return true;
    },
    [account],
  );

  const removeDoc = useCallback(
    (petId: number, uri: string) => {
      if (!account || snap.account !== account) return;
      const list = snap.state.docs[String(petId)] ?? [];
      commit(account, { ...snap.state, docs: { ...snap.state.docs, [String(petId)]: list.filter((x) => x !== uri) } });
      deleteDiaryPhoto(uri);
    },
    [account],
  );

  return { enabled: !!account, trip, docs: state.docs, toggle, addCustom, removeCustom, addDoc, removeDoc };
}
