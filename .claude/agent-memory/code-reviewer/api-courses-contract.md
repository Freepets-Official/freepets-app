---
name: api-courses-contract
description: 라이브 Swagger로 확인한 courses 도메인 계약의 함정 — public 목록은 무인증이라 내 코스도 섞이고, SaveRequest는 public/isPublic 두 이름을 노출한다
metadata:
  type: reference
---

라이브 Swagger(`https://54.116.37.26/v3/api-docs`)와 실호출로 확인한 것들(2026-09-08).
코드만 읽어서는 안 보이는 서버 쪽 사실이라 리뷰 때마다 다시 파지 말 것.

**`GET /api/v1/courses/public`은 인증이 없다.** 토큰을 받지 않으므로 서버가 호출자를 모르고,
따라서 **내가 공개한 코스도 그대로 목록에 들어온다.** 실측: dev 계정(닉네임 `Freepets`)이
소유한 courseId 3이 `/courses/public`에 그대로 나온다. 화면에서 "다른 사람의 코스"라고
부르려면 프론트가 내 `savedCourses`와 대조해 걸러야 한다. 응답은 `{items, total}`.

**`PUT /api/v1/courses/{id}`의 `SaveRequest`에는 `public`과 `isPublic`이 둘 다 있다.**
Lombok/Jackson의 boolean 게터 네이밍(`isPublic()` → `public`) 때문이다. 현재는 `isPublic`으로
보내면 동작하지만(왕복 검증됨), 백엔드가 record로 바꾸거나 `@JsonProperty`를 붙이면 조용히
무시될 수 있는 자리다 — 200이 오는데 공개가 안 되는 형태로 깨진다.

응답 DTO `MyCourse`는 `isPublic` 하나만 준다(`public` 없음). `PublicCourse`에는 `isPublic`이 없다.

`PUT`은 전체 교체이고 바디는 `name`(필수)·`description`·`stopIds`(필수, 0~10)·`isPublic`이 전부다.
`distance-options`와 `optimize-order`는 **2026-09-08 기준 무인증으로 열려 있다**(백엔드 PR #65).

관련: [[docs-02-is-stale]]
