---
name: courses-regions-partial-tree
description: /api/v1/courses/regions는 전체 행정구역이 아니라 "동반 가능 시설이 있는 조합"만 준다 — 분모나 주소 파싱 사전으로 쓰면 안 된다
metadata:
  type: reference
---

`GET /api/v1/courses/regions` (`coursesApi.regions()`, `src/lib/api.ts`)가 주는 `CourseRegion[]`은
**대한민국 전체 시도·시군구 목록이 아니다.** 동반 가능 시설이 실제로 등록된 (시도, 시군구) 조합만 온다.
`sigungus`가 **빈 배열**인 시도도 있다(시도 전체를 아우르는 시설만 있는 경우).

**Why:** 이걸 완전한 행정구역 사전으로 착각하면 두 가지가 조용히 틀어진다 —
(1) 진도 분모(`collected / total`)가 "전체 시군구 수"가 아니라 "시설이 있는 시군구 수"라
    DB에 시설이 추가될수록 분모가 커져 100%였던 사용자가 뒤로 밀린다.
(2) 주소→지역 매칭의 사전으로 쓰면, 시설이 없는 시군구 주소는 매칭에 실패한다.

**How to apply:** 이 응답을 분모·완전성 전제로 쓰는 코드를 보면 지적한다. 지역 문자열은
**축약 표기를 쓰면 안 된다**("강원" ≠ "강원특별자치도") — 응답 값을 그대로 써야 한다.
`facilities/regions`(코드 기반)와 `courses/regions`(이름 문자열 기반)는 다른 API다.

관련: [[web-parity-picker-uri]]
