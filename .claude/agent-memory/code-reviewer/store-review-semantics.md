---
name: store-review-semantics
description: expo-store-review(SDK 57) 실제 동작 — hasAction()은 isAvailableAsync()의 상위집합이라 폴백 판별에 못 쓴다 · 애플은 버튼 탭에서 requestReview 호출 금지 · 웹 Linking.openURL은 _blank
metadata:
  type: project
---

`expo-store-review` 관련 변경(앱 평가하기, PR #61 계열)을 리뷰할 때 확인된 사실.

**Why:** PR #61이 "hasAction()이 false면 스토어로 보낸다"는 전제로 짜였는데, 실제 구현은 그렇지 않았다.
`node_modules/expo-store-review/build/StoreReview.js`:
- `hasAction() = !!storeUrl() || isAvailableAsync()` — **`isAvailableAsync()`가 true면 항상 true.** 인앱 창을 "띄울 수 있는지"와 무관.
- iOS `isAvailableAsync()`는 TestFlight(sandboxReceipt && embedded.mobileprovision 없음)에서만 false. 시뮬레이터·Xcode·앱스토어 빌드는 true.
- iOS `requestReview()`는 foreground scene이 없으면 throw, 그 외엔 **표시 여부를 알려주지 않고 resolve**(OS가 1년 3회 한도로 결정).
- Android `isAvailableAsync()` = Play 스토어 패키지 설치 여부. `requestReview()`는 ReviewManager 실패 시 reject.
- `storeUrl()`은 `app.json`의 `ios.appStoreUrl` / `android.playStoreUrl`에서만 읽는다. 없으면 null.
- 애플 StoreKit 문서 원문: "Because this method may not present an alert, don't call requestReview() or requestReview(in:) in response to a button tap or other user action." Expo 문서도 같은 말. 사용자 버튼은 `apps.apple.com/app/idN?action=write-review` 링크가 정석.
- react-native-web `Linking.openURL(url)`은 인자 1개면 `window.open(url, '_blank', 'noopener')` — 새 탭. SPA 상태는 안 잃는다.

**How to apply:** 평가 버튼 → `requestReview()` 직접 호출은 정책 위반으로 지적. 폴백 판별은 `hasAction`이 아니라 플랫폼/TestFlight 분기로. Android에서 apps.apple.com URL로 떨어지는 폴백이 없는지 본다. 앱스토어 ID 진실은 `eas.json`의 `submit.*.ios.ascAppId`.

관련: [[web-parity-picker-uri]]
