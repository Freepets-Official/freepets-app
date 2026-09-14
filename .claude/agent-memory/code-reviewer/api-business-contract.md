---
name: api-business-contract
description: 사업자(verify·claim)·계정·시설 상세 계약에서 코드만 읽어서는 안 보이는 서버 사실 — radiusM 생략=전국, verify 불일치는 4xx, 상세는 confidence를 실제로 내려줌, userId는 문자열
metadata:
  type: reference
---

`freepets-docs/api-specs/business.md`·`facility.md`·`user.md`(2026-09-12 갱신)와 OpenAPI 덤프로 확인(2026-09-14).
라이브 실호출은 못 했다(아래 [[api-calendar-live-host]] 참고).

**`POST /facilities/search`의 `radiusM`은 생략하면 반경 제한이 없다.** (facility.md L62, business.md ②)
상한 100km는 *보낼 때*의 범위 검증일 뿐이다. "서버 상한 때문에 전국 검색 불가"라는 전제로
100km를 보내는 코드가 있으면 계약 오해다 — 매장 찾기·스탬프 추가처럼 거리와 무관한 화면은 생략이 정답.

**`POST /business/verify`는 불일치·휴업·폐업을 4xx로 내린다**(BUSINESS4001/4002, 국세청 장애는 5001/502).
200에서는 `valid`가 항상 true다. 앱이 `valid:false` 분기를 두는 건 무해하지만 실행되지 않는 경로.

**claim은 본인 재등록이면 200(조건만 갱신), 남이 등록한 매장이면 409 BUSINESS4003.**
`requirements`는 전체 교체 — 빈 배열이면 기존 조건이 지워진다. `maxWeightInclusive`는 서버에만 저장되고
`FacilitySummary`/`FacilityDetail` 어디에도 안 내려온다 → 앱은 이하/미만을 되읽을 수 없다.

**`GET /facilities/{id}`는 2026-09-12부터 `confidence`·`confidenceSource`를 실제로 준다.**
서버 판정: ① 확정 이후 거부 제보 → UNVERIFIED/DENIAL_REPORT ② 사업자 확정 → CONFIRMED/OWNER ③ 안내문 → ESTIMATED/PARSED ④ UNVERIFIED/NONE.
①이 ②를 이기고 그때도 `confirmedAt`은 남는다. 앱 `toFacilityDetail`이 `confirmedAt`만 보고 CONFIRMED/SERVER를
만들면 서버가 내린 하향을 무시한다 — 리뷰 때 이 파생이 남아 있는지 본다.

**`/users/account`·로그인 응답의 `userId`는 네 곳 모두 문자열이다**(user.md L33). `typeof === 'number'` 검사는 절대 통과하지 않는다.

**프로필은 파생값**: `profiles`에 OWNER는 `ownedFacilityIds.length > 0`일 때만. 전환 API 없음.
앱은 `settings.tsx`의 `SHOW_BUSINESS=false`(1.0 심사용 게이트)로 사업자 진입점을 숨겨 두었고,
세션 복원은 항상 `activeProfile:'consumer'`라 서버가 기억하는 매장이 있어도 선택 화면은 자동으로 뜨지 않는다.

관련: [[api-courses-contract]] [[docs-02-is-stale]]
