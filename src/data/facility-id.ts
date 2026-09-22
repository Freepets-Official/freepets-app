/**
 * 목 시설 ID 규칙.
 *
 * `mock.ts`에 함께 있던 것을 떼어낸 파일이다. 서버 호출을 건너뛸지 판단하는 이 세 줄을
 * 쓰려고 목 데이터 500줄을 통째로 import 하고 있었다 — 번들에도 그대로 실린다.
 *
 * 목 시설을 전부 걷어내는 날(이슈 #15) `mock.ts`는 사라지지만 이 규칙은 남아야 한다.
 * 예전 기기에 저장된 판별 이력·도장이 900000번대 ID를 그대로 들고 있어서, 그걸 서버에
 * 물으면 404가 아니라 **남의 시설**이 온다.
 */

/** 서버 시설이 48,743건이므로 900000번대는 앞으로도 겹치지 않는다 */
export const MOCK_ID_BASE = 900_000;

/** 목 데이터의 원래 번호를 읽을 수 있게 감싼다 — `mockId(7)` → 900007 */
export const mockId = (n: number) => MOCK_ID_BASE + n;

/** 이 ID로는 서버를 부르지 않는다 */
export const isMockFacilityId = (id: number) => id >= MOCK_ID_BASE;
