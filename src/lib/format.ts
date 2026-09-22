/**
 * 화면에 숫자를 적는 방법.
 *
 * `mock.ts`에 얹혀 있던 것을 떼어냈다. 목 데이터와 아무 상관이 없는데 거기 있어서,
 * 실데이터만 쓰는 화면 아홉 곳이 목을 import 하고 있었다.
 */

export function formatDistance(m: number | null): string {
  // 거리를 모르면 지어내지 않는다. 좌표 없이 상세를 열면 서버가 null을 주는데,
  // 이걸 0으로 떨어뜨리면 200km 떨어진 시설이 "0m"로 표시된다.
  if (m == null) return '거리 미상';
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}
