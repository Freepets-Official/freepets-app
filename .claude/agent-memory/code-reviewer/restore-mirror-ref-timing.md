---
name: restore-mirror-ref-timing
description: app-store 세션 복원에서 재발급 콜백이 읽는 미러 ref(restoredEmailRef·providerRef 등)는 첫 await API 호출 전에 채워야 한다 — 늦게 채우면 기기 저장분이 null로 덮인다
metadata:
  type: project
---

세션 복원 이펙트(app-store.tsx `loadSession()` 이후)에서, 토큰 재발급 콜백(`setTokensRefreshedHandler`)이
`saveSession`에 실어 보내는 값은 전부 **미러 ref**로 읽는다(`restoredEmailRef`, `providerRef`).
복원 중 `accountApi.get()`이 401→재발급을 타면 그 콜백이 복원보다 먼저 `saveSession`을 부르므로,
ref를 `accountApi.get()` **뒤에서** 채우면 기기 저장분이 null로 덮인다.

**Why:** 이메일은 이 문제를 이미 한 번 겪어 `restoredEmailRef`를 `loadSession` 직후에 채우게 돼 있다.
PR #60(로그인 제공자)은 같은 패턴을 따르지 않고 `providerRef`를 get 성공 뒤에 채워 재발 가능성이 있었다.

**How to apply:** 세션 저장분에 필드를 추가하는 PR은 (1) `authenticate`, (2) 복원 2곳(성공·서버장애), (3) 재발급 콜백,
(4) `expireSession`/`finishLogout` 네 군데를 대조하고, 복원에서는 ref 채우는 위치가 첫 await 앞인지 본다.
