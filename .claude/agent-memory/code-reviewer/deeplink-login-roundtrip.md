---
name: deeplink-login-roundtrip
description: 딥링크→로그인→복귀 흐름 리뷰 확인점 — 웹 네이버 로그인은 전체 페이지 리다이렉트라 모듈 변수·React 상태가 죽는다 · AASA는 iOS 14+ CDN이 /.well-known/만 읽는다 · Android는 intentFilters+assetlinks가 없으면 웹으로 간다
metadata:
  type: project
---

딥링크(유니버설 링크·`?share=`)와 로그인 게이트가 얽힌 변경은 아래를 반드시 본다.

**Why:** PR #59(유니버설 링크, 2026-09-14) 리뷰에서 실제로 걸렸다.
1. 웹 네이버 로그인(`src/hooks/social-provider.web.ts`)은 SDK `isPopup: false` + `anchor.click()`으로
   **페이지가 네이버로 떠났다가 `/login#access_token`으로 돌아온다** — 전체 리로드다. 로그인 전후로
   이어야 할 상태(예: `_layout.tsx`의 `let pendingHref`)를 모듈 변수·React 상태에 두면 웹에서 사라진다.
   `sessionStorage`류에 두고 소비 후 지워야 한다.
2. 애플 AASA는 iOS 14+에서 Apple CDN이 **`https://<domain>/.well-known/apple-app-site-association`만**
   가져간다(공식 문서 명시, 리다이렉트 금지). 루트 사본은 죽은 파일이다. Vercel `headers.source`의
   `(.well-known/)?` 선택 그룹은 루트 경로에 매칭되지 않았다(실측: 루트는 `application/octet-stream`).
3. `app.json`에 `ios.associatedDomains`만 있고 `android.intentFilters(autoVerify)` + `assetlinks.json`이
   없으면 카톡 안드로이드에서는 웹으로 열린다. 그때는 웹 로그인 리로드(1번)까지 겹친다.

**How to apply:** 딥링크·게이트·로그인 화면을 건드린 PR이면 (a) 웹 로그인 리로드를 견디는 저장소인지,
(b) 마운트 즉시 나가는 인증 요청이 복원을 기다리는지([[deeplink-before-session-restore]] — main의
`course.tsx`에 아직 그대로 남아 있다), (c) Android 짝이 같이 왔는지를 재현 시나리오로 확인한다.

관련: [[web-parity-picker-uri]] · [[deeplink-before-session-restore]]
