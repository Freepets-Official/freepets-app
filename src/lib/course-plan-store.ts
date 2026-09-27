import * as SecureStore from 'expo-secure-store';

import type { CoursePlans } from '@/data/course-plan';

/**
 * 코스 일정(스톱별 시간)을 기기에 남긴다.
 *
 * 서버에 시간 필드가 없어 여기 둔다(`data/course-plan.ts` 참고). 계정이 아니라 기기에
 * 속한 값이라 로그아웃해도 지우지 않는다 — 같은 기기에서 다시 로그인하면 짜둔 일정이
 * 그대로 있는 쪽이 자연스럽다.
 *
 * **SecureStore는 값 하나에 2KB 제한이 있다.** 도장이 이 한계에 먼저 부딪혀 7~8건에서
 * 잘렸다. 일정은 한 줄이 `"900007":"09:30"` 정도(약 20바이트)라 100개를 넣어도 2KB 안이지만,
 * 코스를 계속 만들면 언젠가 넘는다. 그래서 저장할 때 **빈 일정은 버리고**, 넘치면 오래된
 * 코스부터 떨군다. 잘린 채로 저장돼 다음 로드에서 JSON 파싱이 통째로 실패하는 것보다 낫다.
 */
const KEY = 'freepets.coursePlans';

/** 2KB 제한에 여유를 둔 값. 넘으면 오래된 코스부터 버린다 */
const MAX_BYTES = 1800;

/** 빈 일정(시간을 하나도 안 정한 코스)은 저장할 이유가 없다 */
function prune(plans: CoursePlans): CoursePlans {
  const out: CoursePlans = {};
  for (const [courseKey, plan] of Object.entries(plans)) {
    const kept = Object.fromEntries(Object.entries(plan).filter(([, t]) => !!t));
    if (Object.keys(kept).length > 0) out[courseKey] = kept;
  }
  return out;
}

/**
 * 저장. 2KB를 넘으면 **뒤에 있는 코스부터** 떨어뜨린다.
 *
 * 객체 키 순서는 삽입 순서라, 최근에 만진 코스를 앞으로 올려 두면 오래된 것이 먼저 잘린다.
 * 호출하는 쪽(`app-store`)이 그렇게 맞춘다.
 */
export async function saveCoursePlans(plans: CoursePlans): Promise<boolean> {
  try {
    let kept = prune(plans);
    let raw = JSON.stringify(kept);
    while (raw.length > MAX_BYTES) {
      const keys = Object.keys(kept);
      if (keys.length <= 1) break; // 하나만 남으면 더 줄일 수 없다 — 그대로 시도한다
      const { [keys[keys.length - 1]]: _dropped, ...rest } = kept;
      kept = rest;
      raw = JSON.stringify(kept);
    }
    await SecureStore.setItemAsync(KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export async function loadCoursePlans(): Promise<CoursePlans> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    // 옛 버전이 남긴 값일 수 있다. 실제로 읽는 모양(문자열 시각)만 남기고 나머지는 버린다
    const out: CoursePlans = {};
    for (const [courseKey, plan] of Object.entries(parsed as Record<string, unknown>)) {
      if (!plan || typeof plan !== 'object' || Array.isArray(plan)) continue;
      const kept: Record<string, string> = {};
      for (const [facilityId, t] of Object.entries(plan as Record<string, unknown>)) {
        if (typeof t === 'string' && /^\d{2}:\d{2}$/.test(t)) kept[facilityId] = t;
      }
      if (Object.keys(kept).length > 0) out[courseKey] = kept;
    }
    return out;
  } catch {
    return {};
  }
}
