/**
 * 코스 일정 — 스톱마다 몇 시에 갈지.
 *
 * **서버에는 이 값을 둘 곳이 없다.** `POST /courses`의 요청 스키마는 `name`·`description`·
 * `stopIds`·`isPublic`뿐이고(라이브 Swagger 2026-09-22 확인), 판별 응답의 `time`은
 * "첫 스톱 10:00에서 90분씩"으로 계산한 **데모용 고정값**이다. 그래서 기기에 남긴다.
 *
 * 기기에 남기는 것의 한계를 분명히 해 둔다 — 기기를 바꾸면 사라지고, 코스를 공유해도
 * 받는 사람에게는 시간이 가지 않는다. 서버에 시간 필드가 생기면 이 파일이 그쪽으로 옮겨간다.
 */

/** `"HH:MM"` 24시간 표기. 빈 문자열이 아니라 키 자체가 없으면 "정하지 않음"이다 */
export type StopTime = string;

/** 코스 하나의 일정 — 시설 ID를 키로 둔다. 순서가 바뀌어도 그 곳의 시간은 따라간다 */
export type CoursePlan = Record<string, StopTime>;

/** 코스별 일정. 키는 `courseId`(저장된 코스) 또는 `'builder'`(아직 저장 안 한 빌더) */
export type CoursePlans = Record<string, CoursePlan>;

/** 저장 안 한 빌더 코스의 일정이 들어가는 자리 */
export const BUILDER_PLAN_KEY = 'builder';

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
export function outOfOrderStops(stopIds: number[], plan: CoursePlan): Set<number> {
  const bad = new Set<number>();
  let prev: string | null = null;
  let prevId: number | null = null;
  for (const id of stopIds) {
    const t = plan[String(id)];
    if (!t) continue;
    if (prev !== null && t < prev) {
      bad.add(id);
      if (prevId !== null) bad.add(prevId);
    }
    prev = t;
    prevId = id;
  }
  return bad;
}
