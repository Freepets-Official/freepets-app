import * as SecureStore from 'expo-secure-store';

import type { AuthLogEntry } from '@/lib/auth-log';

/**
 * 인증 기록의 저장소(네이티브). 웹은 `.web.ts`가 받는다.
 *
 * **한 줄에 한 칸**씩, 40칸을 돌려 쓴다. 기록 전체를 값 하나에 담으면 한글 40줄이 수 KB가
 * 되는데, 키체인 값은 작게 두는 게 안전하고(오래된 플랫폼은 2KB 언저리에서 거부했다),
 * 저장이 실패하면 재시작 구간 — 이 기록이 가장 필요한 곳 — 이 통째로 사라진다. 칸으로
 * 나누면 값 하나가 수백 바이트를 넘지 않고, 한 번에 한 칸만 쓴다.
 *
 * 세션 저장소와 달리 **첫 잠금 해제 이후**면 읽고 쓸 수 있게 둔다. 이 기록의 목적 하나가
 * "기기가 잠긴 채 앱이 깨어나 세션을 못 읽었는가"를 잡는 것이라, 기록마저 잠금에 막히면
 * 정작 그 순간이 남지 않는다.
 */
const SLOTS = 40;
const SEQ_KEY = 'freepets.authlog.seq';
const slotKey = (i: number) => `freepets.authlog.${i}`;
const OPTS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** 다음에 쓸 일련번호. 처음 한 번만 읽고 이후엔 메모리로 센다 */
let seq: number | null = null;

async function nextSeq(): Promise<number> {
  if (seq === null) {
    try {
      seq = Number(await SecureStore.getItemAsync(SEQ_KEY, OPTS)) || 0;
    } catch {
      seq = 0;
    }
  }
  return seq;
}

export async function appendEntry(entry: AuthLogEntry): Promise<void> {
  try {
    const n = await nextSeq();
    await SecureStore.setItemAsync(slotKey(n % SLOTS), JSON.stringify({ ...entry, n }), OPTS);
    seq = n + 1;
    await SecureStore.setItemAsync(SEQ_KEY, String(seq), OPTS);
  } catch {
    // 진단 기록이다. 못 남겨도 앱 동작에는 영향이 없다
  }
}

/** 오래된 것부터 */
export async function readEntries(): Promise<AuthLogEntry[]> {
  const rows: (AuthLogEntry & { n: number })[] = [];
  for (let i = 0; i < SLOTS; i++) {
    try {
      const raw = await SecureStore.getItemAsync(slotKey(i), OPTS);
      if (!raw) continue;
      const row = JSON.parse(raw) as AuthLogEntry & { n: number };
      if (typeof row?.n === 'number' && typeof row.e === 'string') rows.push(row);
    } catch {
      // 한 칸이 깨져도 나머지는 보여 준다
    }
  }
  return rows.sort((a, b) => a.n - b.n).map(({ t, e }) => ({ t, e }));
}

export async function clearEntries(): Promise<void> {
  for (let i = 0; i < SLOTS; i++) {
    try {
      await SecureStore.deleteItemAsync(slotKey(i), OPTS);
    } catch {
      // 이미 없으면 그만이다
    }
  }
  try {
    await SecureStore.deleteItemAsync(SEQ_KEY, OPTS);
  } catch {
    // 이미 없으면 그만이다
  }
  seq = 0;
}
