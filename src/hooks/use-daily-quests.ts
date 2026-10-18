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

/** `fresh`면 캐시를 건너뛴다 — 퀘스트 화면을 열 때는 방금 한 행동이 반영돼야 한다 */
export function loadDailyQuests(fresh = false): Promise<DailyQuests | null> {
  if (!fresh && cached && !stale(cached)) return Promise.resolve(cached.data);
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
