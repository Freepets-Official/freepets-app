import type { PetCheck, PetSatisfaction } from '@/data/types';
import type { Stamp } from '@/data/stamps';

/**
 * 아이와 **함께한 발자국** — 그 아이가 실제로 낀 활동의 횟수.
 *
 * 레벨이 아니다. XP는 계정(집사) 하나뿐이고, 코스 공개·코스 복사처럼 아이와 무관한 행동까지
 * 섞여 있어 아이별로 쪼갤 수 없다. 대신 **아이가 참여한 기록만** 세서 "이 아이와 얼마나
 * 다녔는지"를 보여준다. 상한이 없다 — 다닐수록 계속 늘어난다.
 *
 * 지금은 기기에 있는 기록으로 센다(판별 이력·도장·만족도). 그래서 **기기를 바꾸면 줄어든다** —
 * 서버가 아이별 합계를 주면(`GET /pets/{id}/stats` 요청 예정) 그 값으로 바꾼다.
 */
export type Footprints = {
  total: number;
  checks: number;
  stamps: number;
  satisfactions: number;
};

export function footprintsOf(
  petId: number,
  source: { checks: PetCheck[]; stamps: Stamp[]; satisfactions: PetSatisfaction[] },
): Footprints {
  const checks = source.checks.filter((c) => c.petIds.includes(petId)).length;
  const stamps = source.stamps.filter((s) => s.petIds.includes(petId)).length;
  // 만족도는 시설·아이당 한 번이라 그대로 센다
  const satisfactions = source.satisfactions.filter((s) => s.petId === petId).length;
  return { total: checks + stamps + satisfactions, checks, stamps, satisfactions };
}
