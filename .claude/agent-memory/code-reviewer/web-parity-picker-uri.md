---
name: web-parity-picker-uri
description: 웹이 실배포 타깃이므로 리뷰 때 네이티브/웹 짝을 함께 본다 — expo-image-picker 웹은 새로고침하면 죽는 blob: URI를 준다
metadata:
  type: feedback
---

`.web.ts` 짝이 있는 모듈이나 `Platform.OS` 분기를 건드린 변경은 **웹 쪽 런타임 차이를 반드시 함께 검증한다.**

**Why:** freepets-app은 main을 Vercel 웹으로도 배포한다(웹이 데모·심사에서 실제로 보이는 화면이다).
그래서 "네이티브에서 되니까 됐다"는 절반만 맞다.

**How to apply:** 리뷰에서 실제로 확인된 웹/네이티브 갈림길:
- `expo-image-picker`(SDK 57) 웹 구현은 `node_modules/expo-image-picker/src/ExponentImagePicker.web.ts`에서
  `uri: URL.createObjectURL(file)` — **blob: URL이다. 새로고침하면 죽는다.** 영속 저장(localStorage·DB)에
  그 URI를 넣으면 다음 방문에 깨진 이미지가 된다. 네이티브는 `file://` 캐시 경로라 당장은 살지만 iOS가
  Caches를 비우면 같이 사라진다. 영속하려면 documentDirectory로 복사해야 한다.
- 웹 저장소는 `localStorage`라 **사용자가 직접 편집할 수 있고 쿼터(약 5MB)가 있다.** 역직렬화 검증은
  "화면이 실제로 참조하는 필드"를 전부 덮어야 한다(빠진 필드 하나가 화면 크래시가 된다).
- 네이티브 `SecureStore`는 값 하나가 **2048바이트를 넘으면 경고·실패**한다. 배열 전체를 한 키에 넣는
  구조는 항목이 쌓이면 웹은 멀쩡한데 네이티브만 조용히 저장에 실패한다.

관련: [[courses-regions-partial-tree]]
