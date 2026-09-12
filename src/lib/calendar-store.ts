import * as SecureStore from 'expo-secure-store';

/**
 * 캘린더 일정과 복용 기록을 기기에 남긴다.
 *
 * 서버 API는 이미 있지만(일정 7종) 앱이 아직 연동하지 않았다 — 1.1 작업이다. 그때까지
 * 상태로만 들고 있으면 **앱을 끄는 순간 전부 사라진다.** 일정을 만든 사람은 그게
 * 어디에도 저장되지 않았다는 걸 알 방법이 없다.
 *
 * 기기 저장이라 다른 기기와 공유되지 않는다. 서버 연동이 붙으면 이 파일은 지운다.
 */
const EVENTS_KEY = 'freepets.calendarEvents';
const MEDLOG_KEY = 'freepets.medLog';

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
