import type { AuthLogEntry } from '@/lib/auth-log';

/** 인증 기록의 저장소(웹). 키체인이 없어 localStorage에 배열 하나로 둔다. 크기 제한이 넉넉하다 */
const KEY = 'freepets.authlog';
const MAX = 40;

function read(): AuthLogEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? (parsed as AuthLogEntry[]) : [];
  } catch {
    return [];
  }
}

export async function appendEntry(entry: AuthLogEntry): Promise<void> {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...read(), entry].slice(-MAX)));
  } catch {
    // 진단 기록이다. 못 남겨도 앱 동작에는 영향이 없다
  }
}

export async function readEntries(): Promise<AuthLogEntry[]> {
  return read();
}

export async function clearEntries(): Promise<void> {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 이미 없으면 그만이다
  }
}
