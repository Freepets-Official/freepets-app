import { readRaw, writeRaw } from '@/lib/auth-log-storage';
import { DEBUG_TOOLS } from '@/lib/config';

/**
 * 로그인·재발급·로그아웃이 **언제, 왜** 일어났는지 기기에 남기는 진단 기록.
 *
 * 2026-10-02, 재발급을 고친 Ad Hoc 빌드로 확인했는데도 실기기에서 로그아웃돼 있었다.
 * 서버는 실측으로 정상(액세스 2시간·리프레시 14일·재발급 200)이었고, 시뮬레이션도 통과했다.
 * 실기기에서 무슨 일이 있었는지 볼 길이 없어서 만들었다 — 설정 › 개발자에서 읽는다.
 *
 * - **개발·Ad Hoc 빌드에서만** 남긴다(`DEBUG_TOOLS`). 스토어 빌드는 아무것도 하지 않는다
 * - **토큰 값은 절대 남기지 않는다.** 만료 시각(exp)처럼 비밀이 아닌 것만 남긴다
 * - 앱을 다시 켜도 남아야 해서(재시작 복원이 핵심 구간) 기기에 저장한다. 최근 것만 둔다
 */
export type AuthLogEntry = { t: string; e: string };

const MAX = 40;
let cache: AuthLogEntry[] | null = null;
// 읽고-붙이고-쓰기가 겹치면 기록이 서로 덮인다. 한 줄로 세운다
let chain: Promise<void> = Promise.resolve();

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function load(): Promise<AuthLogEntry[]> {
  if (cache) return cache;
  try {
    const raw = await readRaw();
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cache = Array.isArray(parsed) ? (parsed as AuthLogEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

/** 한 줄 남긴다. 기다리지 않아도 된다 — 순서는 내부에서 지킨다 */
export function logAuth(event: string): void {
  if (!DEBUG_TOOLS) return;
  const entry = { t: stamp(), e: event };
  chain = chain
    .then(async () => {
      const list = await load();
      list.push(entry);
      cache = list.slice(-MAX);
      await writeRaw(JSON.stringify(cache));
    })
    .catch(() => {});
}

export async function readAuthLog(): Promise<AuthLogEntry[]> {
  await chain;
  return [...(await load())];
}

export async function clearAuthLog(): Promise<void> {
  await chain;
  cache = [];
  await writeRaw(null);
}

/**
 * 토큰의 발급·만료 시각만 꺼낸다(예: "iat 15:50 → exp 17:50"). 서명·내용은 보지 않는다.
 * JWT의 가운데 조각은 서명 없이도 읽히는 공개 정보라 기록해도 된다.
 */
export function tokenTimes(token: string | null | undefined): string {
  if (!token) return '없음';
  try {
    const part = token.split('.')[1] ?? '';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
    const json = JSON.parse(globalThis.atob(b64)) as { iat?: number; exp?: number };
    const f = (s?: number) => (typeof s === 'number' ? stamp(new Date(s * 1000)) : '?');
    return `${f(json.iat)} → ${f(json.exp)}`;
  } catch {
    return '해석 불가';
  }
}
