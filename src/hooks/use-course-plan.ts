import { useCallback, useEffect, useRef, useState } from 'react';

import { BUILDER_PLAN_KEY, type CoursePlan, type CoursePlans } from '@/data/course-plan';
import { loadCoursePlans, saveCoursePlans } from '@/lib/course-plan-store';

/**
 * 스톱별 시간을 기기에서 읽고 쓴다.
 *
 * 저장은 **디바운스한다.** 시간 칸은 글자를 칠 때마다 값이 바뀌는데, 그때마다 SecureStore에
 * 쓰면 키체인 접근이 쌓여 입력이 끊긴다. 화면에는 즉시 반영하고 디스크는 뒤따라간다.
 */
const SAVE_DEBOUNCE_MS = 500;

export function useCoursePlan() {
  const [plans, setPlans] = useState<CoursePlans>({});
  /** 첫 로드가 끝나기 전에는 저장하지 않는다 — 빈 값으로 디스크를 덮어쓴다 */
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    loadCoursePlans().then((stored) => {
      if (!alive) return;
      /**
       * 디스크에서 온 값을 **덮어쓰지 않고 밑에 깐다.**
       *
       * 로드는 비동기라, 그 사이에 사용자가 시간을 정할 수 있다. `setPlans(stored)`로 그냥
       * 갈아끼우면 방금 입력한 시간이 사라진다 — 화면에 떴다가 없어지므로 사용자는 앱이
       * 먹었다고 느낀다. 이미 만진 코스는 화면 값이 이긴다.
       */
      setPlans((cur) => ({ ...stored, ...cur }));
      loaded.current = true;
    });
    return () => {
      alive = false;
    };
  }, []);

  /** 저장 대기 중인 최신 값. 화면을 나갈 때 마지막으로 한 번 더 쓰려고 들고 있는다 */
  const latest = useRef(plans);
  latest.current = plans;

  useEffect(() => {
    if (!loaded.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveCoursePlans(plans), SAVE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [plans]);

  /**
   * 화면을 나갈 때 **마지막 한 번을 더 쓴다.**
   *
   * 디바운스가 500ms라, 시간을 고치고 바로 뒤로가기를 누르면 위 effect의 cleanup이 타이머를
   * 취소한 채 끝난다. 그 뒤로 저장할 사람이 없어 **마지막 수정이 그대로 사라진다.**
   * 언마운트에만 도는 effect라 의존성은 비워 둔다.
   */
  useEffect(
    () => () => {
      if (loaded.current) void saveCoursePlans(latest.current);
    },
    [],
  );

  /**
   * 한 스톱의 시간을 정한다. `null`을 주면 지운다.
   *
   * 만진 코스를 **객체 맨 앞으로 올린다.** 저장소가 2KB를 넘길 때 뒤에서부터 떨구므로,
   * 방금 만진 코스가 가장 나중에 버려지게 된다.
   */
  const setStopTime = useCallback((courseKey: string, facilityId: number, time: string | null) => {
    setPlans((prev) => {
      const cur: CoursePlan = { ...(prev[courseKey] ?? {}) };
      if (time) cur[String(facilityId)] = time;
      else delete cur[String(facilityId)];
      const { [courseKey]: _moved, ...rest } = prev;
      return { [courseKey]: cur, ...rest };
    });
  }, []);

  /**
   * 짜둔 일정을 새로 저장된 코스로 **복사한다.**
   *
   * 코스를 저장하면 그때서야 `courseId`가 생긴다. 옮기지 않으면 저장하는 순간 시간이
   * 사라진 것처럼 보인다 — 옛 키에는 남아 있지만 화면은 새 코스 키를 보기 때문이다.
   *
   * 빌더에서 짠 것(`from`이 빌더 키)이면 **옮기고**, 담아둔 코스를 고쳐 새로 담은 것이면
   * **복사한다.** 후자에서 원본 코스의 시간까지 지우면, 목록에 그대로 남아 있는 원본을
   * 다시 열었을 때 시간만 사라져 있다.
   */
  const adoptPlan = useCallback((fromKey: string, courseId: number) => {
    setPlans((prev) => {
      const src = prev[fromKey];
      if (!src || Object.keys(src).length === 0) return prev;
      if (fromKey === BUILDER_PLAN_KEY) {
        const { [BUILDER_PLAN_KEY]: _moved, ...rest } = prev;
        return { [String(courseId)]: src, ...rest };
      }
      return { [String(courseId)]: { ...src }, ...prev };
    });
  }, []);

  const planOf = useCallback((courseKey: string): CoursePlan => plans[courseKey] ?? {}, [plans]);

  return { planOf, setStopTime, adoptPlan };
}
