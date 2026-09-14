import * as SecureStore from 'expo-secure-store';

/**
 * 캘린더 일정과 복용 기록의 **오프라인 캐시**.
 *
 * 원본은 서버(`/calendar-events`)다. 여기 남기는 건 서버를 못 받을 때(지하철, 서버 장애)
 * 마지막으로 본 일정이라도 보이게 하려는 것이다. 서버 응답이 오면 그 값이 이 캐시를 덮는다.
 */
const EVENTS_KEY = 'freepets.calendarEvents';
const MEDLOG_KEY = 'freepets.medLog';
/** 1.0의 기기 전용 일정을 서버로 한 번 올렸는지 */
const MIGRATED_KEY = 'freepets.calendarMigrated';

async function read(key: string): Promise<unknown> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
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

export async function loadCalendarMigrated(): Promise<boolean> {
  return (await read(MIGRATED_KEY)) === true;
}

export const saveCalendarMigrated = () => write(MIGRATED_KEY, true);
