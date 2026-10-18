import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { parseDiary, withDay, type DiaryDay, type DiaryMap } from '@/data/day-diary';
import { deleteDiaryPhoto, loadDiaryRaw, saveDiaryRaw, storeDiaryPhoto } from '@/lib/diary-store';
import { useAppStore } from '@/store/app-store';

/**
 * 캘린더 하루 기록을 캘린더 화면과 하루 기록 화면이 **같은 값으로** 본다(모듈에 하나).
 * 상세에서 사진을 넣고 돌아오면 달력 칸에 바로 보여야 한다.
 */
type Snap = { account: string | null; map: DiaryMap };
let snap: Snap = { account: null, map: {} };
const subs = new Set<() => void>();
const set = (next: Snap) => {
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
  set({ account, map: {} });
  void loadDiaryRaw(account).then((raw) => {
    if (loaded === account) set({ account, map: parseDiary(raw) });
  });
}

export function useDayDiary() {
  const { session, myUserId } = useAppStore();
  // 퀘스트 여정과 같은 규칙 — 서버 userId, 없으면 이메일, 그것도 없으면 남기지 않는다
  const account = session.authed ? (myUserId != null ? `u${myUserId}` : session.email ? `e${session.email}` : '') : null;
  const s = useSyncExternalStore(subscribe, () => snap, () => snap);
  useEffect(() => {
    if (account) ensure(account);
  }, [account]);
  const mine = !!account && s.account === account;
  const map = mine ? s.map : {};

  /** 하루를 저장한다. 저장소가 꽉 찼으면 false — 화면이 알린다 */
  const saveDay = useCallback(
    async (ymd: string, day: Omit<DiaryDay, 'updatedAt'>): Promise<boolean> => {
      if (!account || snap.account !== account) return false;
      const prev = snap.map[ymd];
      const next = withDay(snap.map, ymd, day);
      const ok = await saveDiaryRaw(account, next);
      if (!ok) return false;
      // 빠진 사진 파일은 저장이 끝난 뒤에 지운다 — 먼저 지우고 저장이 실패하면 기록만 남고 사진이 깨진다
      prev?.photos.filter((p) => !day.photos.includes(p)).forEach(deleteDiaryPhoto);
      set({ account, map: next });
      return true;
    },
    [account],
  );
  const addPhoto = useCallback((src: string) => (account ? storeDiaryPhoto(account, src) : Promise.resolve(null)), [account]);

  return { enabled: !!account, map, day: (ymd: string): DiaryDay | undefined => map[ymd], saveDay, addPhoto, discardPhoto: deleteDiaryPhoto };
}
