import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { subscriptionApi, type EntitlementResult } from '@/lib/api';
import { loadWaitlist, saveWaitlist, type WaitlistRecord } from '@/lib/waitlist-store';
import { useAppStore } from '@/store/app-store';

/**
 * 꼬리패스 권한과 사전 신청.
 *
 * 앱은 요금제 이름이 아니라 **기능별 권한**만 본다(docs/19 원칙 4). 서버 API(`GET /me/entitlements`)가
 * 아직 없거나 실패하면 모두 무료로 본다 — 권한을 모른다고 기능을 열어 주지는 않는다.
 */
const FREE: EntitlementResult = { plan: 'FREE', expiresAt: null, features: {} };

type Snap = { account: string | null; ent: EntitlementResult; waitlist: WaitlistRecord | null; loaded: boolean };
let snap: Snap = { account: null, ent: FREE, waitlist: null, loaded: false };
const subs = new Set<() => void>();
const set = (patch: Partial<Snap>) => {
  snap = { ...snap, ...patch };
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
let loadedFor: string | null = null;

async function trySync(account: string, rec: WaitlistRecord) {
  try {
    await subscriptionApi.joinWaitlist(rec.product, rec.interests);
    const next = { ...rec, synced: true };
    await saveWaitlist(account, next);
    if (snap.account === account) set({ waitlist: next });
  } catch {
    // 서버가 아직 없으면 기기 기록만 남는다 — 다음에 앱을 열 때 다시 보낸다
  }
}

function ensure(account: string) {
  if (loadedFor === account) return;
  loadedFor = account;
  set({ account, ent: FREE, waitlist: null, loaded: false });
  void Promise.all([subscriptionApi.entitlements().catch(() => FREE), loadWaitlist(account)]).then(([ent, wl]) => {
    if (loadedFor !== account) return;
    set({ ent, waitlist: wl, loaded: true });
    if (wl && !wl.synced) void trySync(account, wl);
  });
}

export function usePass() {
  const { session, myUserId } = useAppStore();
  const account = session.authed ? (myUserId != null ? `u${myUserId}` : session.email ? `e${session.email}` : '') : null;
  const s = useSyncExternalStore(subscribe, () => snap, () => snap);
  useEffect(() => {
    if (account) ensure(account);
  }, [account]);
  const mine = !!account && s.account === account;

  const join = useCallback(
    async (interests: string[]) => {
      if (!account) return false;
      const rec: WaitlistRecord = { product: 'PASS', interests, joinedAt: new Date().toISOString(), synced: false };
      await saveWaitlist(account, rec);
      set({ waitlist: rec });
      void trySync(account, rec);
      return true;
    },
    [account],
  );

  const ent = mine ? s.ent : FREE;
  return {
    ready: mine && s.loaded,
    plan: ent.plan,
    /** 이 기능을 쓸 수 있나. 모르면 false */
    can: (feature: string) => ent.plan === 'PASS' || !!ent.features[feature]?.enabled,
    waitlist: mine ? s.waitlist : null,
    join,
  };
}
