import type { CoursePlans } from '@/data/course-plan';

/**
 * 웹은 SecureStore가 없다. localStorage를 쓴다.
 *
 * 일정은 비밀이 아니라 저장 위치에 따른 절충이 없고, 네이티브와 달리 2KB 제한도 없어
 * 잘라낼 일이 없다. 나머지 계약(빈 일정 버리기·읽을 때 모양 검사)은 네이티브와 같다.
 */
const KEY = 'freepets.coursePlans';

function prune(plans: CoursePlans): CoursePlans {
  const out: CoursePlans = {};
  for (const [courseKey, plan] of Object.entries(plans)) {
    const kept = Object.fromEntries(Object.entries(plan).filter(([, t]) => !!t));
    if (Object.keys(kept).length > 0) out[courseKey] = kept;
  }
  return out;
}

export async function saveCoursePlans(plans: CoursePlans): Promise<boolean> {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prune(plans)));
    return true;
  } catch {
    return false;
  }
}

export async function loadCoursePlans(): Promise<CoursePlans> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
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
