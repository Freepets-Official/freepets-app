#!/usr/bin/env node
/**
 * 배포 확인 — 라이브 Swagger(`/v3/api-docs`)에 앱이 쓰는 엔드포인트·필드가 올라왔는지 본다.
 *
 * 백엔드가 "배포했다"고 해도 어느 배치까지 올라갔는지는 응답을 봐야 안다. 앱은 필드가 없으면
 * 조용히 이전 동작으로 떨어지도록 만들어져 있어서, **화면만 보고는 미배포를 구분할 수 없다.**
 *
 *   node scripts/check-live-api.mjs
 *   node scripts/check-live-api.mjs https://다른서버
 */
const BASE = process.argv[2] ?? 'https://3.35.195.228.nip.io';

/** [표시 이름, path 또는 (스키마, 필드)] — 앱이 실제로 호출·사용하는 것만 */
const PATHS = [
  ['사업자 대시보드 · 내 매장', '/api/v1/owner/facilities'],
  ['사업자 대시보드 · 거부 제보', '/api/v1/owner/facilities/{facilityId}/denial-alerts'],
  ['사업자 대시보드 · 출입 조건', '/api/v1/owner/facilities/{facilityId}/conditions'],
  ['사업자 대시보드 · 소개', '/api/v1/owner/facilities/{facilityId}/profile'],
  ['사업자 대시보드 · 리뷰 통계', '/api/v1/owner/facilities/{facilityId}/review-stats'],
  ['사업자 대시보드 · 혜택', '/api/v1/owner/facilities/{facilityId}/benefits'],
  ['신규 매장 · 중복 확인', '/api/v1/business/facilities/duplicate-check'],
  ['신규 매장 · 등록', '/api/v1/business/facilities'],
  ['오늘의 퀘스트', '/api/v1/me/gamification/quests'],
  ['도움됐어요 취소(DELETE)', '/api/v1/reviews/{reviewId}/helpful'],
];

/** 스키마 안에 있어야 하는 필드 — path만으로는 배포 여부를 못 가리는 것들 */
const FIELDS = [
  ['시설 상세 · 사장님 소개', 'FacilityDetail', 'ownerIntroduction'],
  ['시설 상세 · 방문 혜택', 'FacilityDetail', 'visitBenefits'],
  ['시설 상세 · 체중 이하/미만', 'FacilityDetail', 'maxWeightInclusive'],
  ['리뷰 · 사진 URL', 'Review', 'photoUrl'],
  ['게이미피케이션 · 배지 진행도', 'MyStatus', 'progress'],
  ['게이미피케이션 · 선명도', 'MyStatus', 'tierFinish'],
  ['내 신청 · 반려 사유', 'MyClaim', 'reviewReason'],
  ['캘린더 · 반복 시작일', 'EventOccurrence', 'startDate'],
];

const res = await fetch(`${BASE}/v3/api-docs`, { signal: AbortSignal.timeout(20_000) });
if (!res.ok) {
  console.error(`Swagger를 못 받았다 (${res.status}) — 서버가 내려갔거나 주소가 다르다`);
  process.exit(2);
}
const doc = await res.json();
const paths = Object.keys(doc.paths ?? {});
const schemas = doc.components?.schemas ?? {};

/** 스키마 이름은 FQCN이라 끝부분으로 찾는다. 같은 이름이 여럿이면 필드가 있는 쪽을 택한다 */
const findField = (suffix, field) =>
  Object.entries(schemas).some(([name, s]) => name.endsWith(suffix) && s?.properties?.[field]);

let missing = 0;
const line = (ok, label, detail) => {
  if (!ok) missing += 1;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? `  ${detail}` : ''}`);
};

console.log(`\n${BASE} — path ${paths.length}개\n`);
console.log('── 엔드포인트 ──');
for (const [label, path] of PATHS) line(paths.includes(path), label, path);
console.log('\n── 응답 필드 ──');
for (const [label, schema, field] of FIELDS) line(findField(schema, field), label, `${schema}.${field}`);

console.log(
  missing === 0
    ? '\n전부 배포됐다. 앱 연동 확인을 시작해도 된다.\n'
    : `\n${missing}건 미배포 — 그 기능은 앱에서 이전 동작(빈 화면·숨김)으로 떨어진다.\n`,
);
process.exit(missing === 0 ? 0 : 1);
