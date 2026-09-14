---
name: api-calendar-live-host
description: 2026-09-14 기준 라이브 실측 불가 — .env DEV 토큰은 현재 API_URL(3.35.195.228.nip.io)에서 TOKEN4001, 옛 호스트 54.116.37.26은 응답 없음. 계약 판정은 api-specs/*.md로
metadata:
  type: reference
---

`src/lib/config.ts`의 기본 `API_URL`은 `https://3.35.195.228.nip.io`다(옛 `54.116.37.26`은 2026-09-14에 curl 타임아웃).
`.env`의 `EXPO_PUBLIC_DEV_TOKEN`은 새 호스트에서 **`TOKEN4001`(유효하지 않은 토큰)** 을 돌려준다 —
사용자 메모리(`dev-token-stale.md`, 08-30 "유효")는 낡았다. `.env.bak.20260907115300`의 토큰도 같은 값이라 대안이 아니다.
토큰 값은 출력하지 말 것 — 스크립트 안에서 읽어 헤더에만 넣는다.

**How to apply:** 리뷰에서 "서버 동작에 따라 달라지는 것"을 실측으로 확정하려 하지 말고, 먼저
`freepets-docs/api-specs/<도메인>.md`를 읽어라. 백엔드가 구현 기준으로 갱신하는 문서라 Swagger보다
의미론(발생일·생략 키·멱등성·에러코드)이 자세하다. 실측이 꼭 필요하면 사용자에게 새 토큰을 요청한다.

관련: [[occurrence-fold-anchor]] [[docs-02-is-stale]] [[api-business-contract]]
