---
name: deeplink-before-session-restore
description: 화면 mount effect가 세션 복원보다 먼저 돈다 — 딥링크(`?share=` 등) 파라미터를 mount 시 곧바로 auth API로 보내면 프로덕션에서 토큰 없이 나간다. __DEV__의 DEV_TOKEN이 이를 가린다
metadata:
  type: project
---

`AppStoreProvider`의 세션 복원은 `await loadSession()` → `setAuthToken()` → `accountApi.get()` 순의
**비동기** effect다. 반면 라우트 화면(`course.tsx` 등)은 자식이라 그 effect가 **부모보다 먼저** 돈다.
그래서 cold start로 `/course?share=X` 같은 딥링크에 들어오면, 화면 mount effect가 부르는 `auth: true`
요청은 `currentToken()`이 null인 채로 나간다 → `hadToken=false` → 서버 401(`COMMON401`) →
`ApiError('로그인이 필요해요.', 'NO_SESSION')`. 로그인돼 있어도 그렇다.

**Why:** `__DEV__`에서는 `DEV_TOKEN`이 대신 붙어 재현이 안 된다. Vercel 프로덕션 웹과 실기기 빌드에서만 난다.
PR #58(코스 공유 링크)이 정확히 이 모양이었고, 한 번만 담으려는 ref 가드까지 있어 실패 뒤 재시도도 없었다.

**How to apply:** mount 시점에 인증 API를 자동 호출하는 코드(딥링크·푸시 파라미터 처리)를 보면
`restoring`이 끝나고 `session.authed`일 때까지 미루는지 확인한다. "한 번만" ref는 **성공 후**에 찍어야 한다.
게이트(`useAuthGate`)는 restoring 동안 아무것도 안 하므로 화면은 그동안 정상 mount돼 있다.

관련: [[web-parity-picker-uri]] (RN-web `Share.share`는 `navigator.share` 없으면 `Error`로 reject — ApiError만 잡으면 무음)
