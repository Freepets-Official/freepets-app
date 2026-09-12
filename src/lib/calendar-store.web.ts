/**
 * 웹은 SecureStore가 없다. localStorage를 쓴다(네이티브 구현과 같은 계약).
 * 자세한 배경은 `calendar-store.ts` 주석 참고.
 */
const EVENTS_KEY = 'freepets.calendarEvents';
const MEDLOG_KEY = 'freepets.medLog';

async function read(key: string): Promise<unknown> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장에 실패해도 이번 세션에는 남는다. 일정 추가 자체를 막지 않는다.
  }
}

export async function loadCalendarEvents<T>(): Promise<T[] | null> {
  const parsed = await read(EVENTS_KEY);
  return Array.isArray(parsed) ? (parsed as T[]) : null;
}

export const saveCalendarEvents = (events: unknown[]) => write(EVENTS_KEY, events);

export async function loadMedLog(): Promise<string[]> {
  const parsed = await read(MEDLOG_KEY);
  return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
}

export const saveMedLog = (keys: string[]) => write(MEDLOG_KEY, keys);
