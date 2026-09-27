/**
 * 스톱별 방문 시각 — 표기와 검사.
 *
 * 값 자체는 **서버가 들고 있다**(`CourseStopRef.visitTime`, `POST·PUT /courses`의 `stops[].visitTime`).
 * 2026-09-25 배포 전까지는 서버에 둘 곳이 없어 기기 SecureStore에 코스별로 남겼는데,
 * 기기를 바꾸면 사라지고 코스를 공유해도 받는 사람에게 시간이 가지 않았다. 이제 코스를
 * 담으면 시간도 같이 담기고, 남이 내 코스를 복사하면 시간까지 따라간다.
 *
 * 남은 것은 순수 함수뿐이라 저장소도 훅도 없다.
 */
import type { CourseStopRef } from './types';

/** `"HH:MM"` 24시간 표기. 안 정했으면 빈 문자열이 아니라 `null`이다 */
export type StopTime = string;

/**
 * `"9"`·`"930"`·`"0930"`·`"9:3"`·`"9시 30분"`을 전부 읽어 `"HH:MM"`으로 맞춘다. 못 읽으면 null.
 *
 * 콜론 없는 숫자를 받는 이유는 여행 중 한 손으로 치는 값이라서다. 세 자리(`930`)와
 * 네 자리(`0930`)를 **따로** 잡는다 — 하나의 규칙으로 묶으면 `930`이 "9시 30분"이 아니라
 * "930분"으로 읽혀 버려진다.
 */
export function normalizeTime(raw: string): StopTime | null {
  const t = raw.trim();
  if (!t) return null;
  const m =
    t.match(/^(\d{1,2})\s*[:시]\s*(\d{1,2})?\s*분?$/) ??
    t.match(/^(\d{2})(\d{2})$/) ??
    t.match(/^(\d)(\d{2})$/) ??
    t.match(/^(\d{1,2})\s*시?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** 표시용 — `"09:05"` → `"오전 9:05"`. 24시간 표기는 여행 일정에서 딱딱하다 */
export function formatTime(t: StopTime): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
}

/**
 * 시간이 앞뒤로 뒤집힌 스톱을 찾는다.
 *
 * 순서를 바꾸거나 시간을 고치다 보면 3번 스톱이 2번보다 이른 시각이 되기 쉽다. 막지는
 * 않는다 — 자정을 넘기는 일정도 있고, 사용자가 일부러 비워둘 수도 있다. 대신 표시해 준다.
 */
export function outOfOrderStops(stops: CourseStopRef[]): Set<number> {
  const bad = new Set<number>();
  let prev: string | null = null;
  let prevId: number | null = null;
  for (const s of stops) {
    if (!s.visitTime) continue;
    if (prev !== null && s.visitTime < prev) {
      bad.add(s.facilityId);
      if (prevId !== null) bad.add(prevId);
    }
    prev = s.visitTime;
    prevId = s.facilityId;
  }
  return bad;
}
