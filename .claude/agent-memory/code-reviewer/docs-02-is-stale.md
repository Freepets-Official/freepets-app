---
name: docs-02-is-stale
description: freepets-docs의 docs/02-api-design.md는 2026-08 설계 시점 그대로라 실계약과 다르다 — 어긋남을 PR 결함으로 올리기 전에 확인할 것
metadata:
  type: project
---

`freepets-docs/docs/02-api-design.md`의 courses 절은 **설계 초안 그대로**다 —
`stopFacilityIds`, `GET /courses/presets`, `GET /courses/recommended?mode=` 같은
지금은 존재하지 않는 필드·경로가 적혀 있다. `docs/09-화면별-기능명세.md`도 07절이
프리셋/추천 시절 화면 기준이다.

**Why:** 실계약의 단일 소스는 `api-specs/*.md`와 라이브 Swagger로 옮겨갔고,
02·09는 그 뒤로 전수 갱신되지 않았다. `docs/11-구현-현황.md`도 "본문은 2026-08-27 시점
그대로"라고 스스로 밝히고 있다.

**How to apply:** API를 건드린 PR을 리뷰할 때 02·09와의 불일치를 곧바로 "이 PR이 문서를
안 고쳤다"로 올리지 말 것. 먼저 그 항목이 원래부터 어긋나 있었는지 보고, 그렇다면
**이 PR이 만든 결함이 아니라 누적 부채**로 구분해 보고한다. 반대로 `api-specs/`와의
불일치는 실제 계약 위반이므로 그대로 올린다.

관련: [[api-courses-contract]]
