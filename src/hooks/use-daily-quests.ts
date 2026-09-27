import { useEffect, useState } from 'react';

import { questsApi, type DailyQuests } from '@/lib/api';

/**
 * 오늘의 퀘스트 — 홈과 퀘스트 화면이 같은 값을 본다.
 *
 * 홈에서도 필요한 이유는 **돌아올 이유**를 숫자로 보여주기 위해서다. 퀘스트 화면은 아이콘
 * 뒤에 숨어 있어서, 들어가 보기 전에는 오늘 할 일이 남았는지 알 수 없었다.
 *
 * 목록은 앱이 사는 동안 **모듈에 들고 있는다.** 홈과 퀘스트 화면을 오갈 때마다 다시 받으면
 * 같은 값을 위해 서버를 두 번 부른다. 대신 **하루가 넘어가면 버린다** — 자정(KST)에 초기화되는
 * 값이라, 앱을 켜 둔 채로 날짜가 바뀌면 어제 진행률이 남는다.
 */
let cached: { data: DailyQuests; at: number } | null = null;
let inFlight: Promise<DailyQuests | null> | null = null;

/** 캐시가 이 시각을 넘겼으면 버린다 — 서버가 준 초기화 시각, 없으면 5분 */
function stale(entry: { data: DailyQuests; at: number }): boolean {
  const reset = entry.data.resetsAt ? new Date(entry.data.resetsAt).getTime() : NaN;
  if (Number.isFinite(reset)) return Date.now() >= reset;
  return Date.now() - entry.at > 5 * 60_000;
}

function load(): Promise<DailyQuests | null> {
  if (cached && !stale(cached)) return Promise.resolve(cached.data);
  if (!inFlight) {
    inFlight = questsApi
      .today()
      .then((d) => {
        cached = { data: d, at: Date.now() };
        return d;
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** 계정이 바뀌면 남의 진행률을 보여주면 안 된다 */
export function resetDailyQuests() {
  cached = null;
  inFlight = null;
}

/**
 * 오늘 아직 안 끝낸 퀘스트 수. 받아오기 전이거나 실패하면 `null`.
 *
 * `0`과 `null`을 구분해야 한다 — 0은 "오늘 다 했다"는 뿌듯한 상태고, null은 "모른다"다.
 * 모르는데 0을 보여주면 다 한 것처럼 읽힌다.
 */
export function useQuestsLeft(enabled: boolean): number | null {
  const [left, setLeft] = useState<number | null>(() =>
    cached && !stale(cached) ? countLeft(cached.data) : null,
  );

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void load().then((d) => {
      if (alive && d) setLeft(countLeft(d));
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return left;
}

function countLeft(d: DailyQuests): number {
  return d.quests.filter((q) => q.completed < q.target).length;
}
