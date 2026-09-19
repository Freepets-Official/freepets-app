# 프리펫스 — 에이전트 작업 규칙

이 파일은 Claude Code · Codex 같은 코딩 에이전트가 자동으로 읽습니다.
**모든 프리펫스 저장소에 같은 내용을 두세요** (`freepets-app`, `freepets-api`, `freepets-docs`).
Claude Code용으로는 같은 폴더에 `CLAUDE.md`를 만들고 `@AGENTS.md` 한 줄만 넣으면 됩니다.

---

## 프로젝트

2026 관광데이터 활용 공모전 ②-2 웹·앱 구현 부문 / 지정과제 6번 —
*모호한 반려동물 출입 조건으로 인한 현장 입장 거부·헛걸음 문제* 출품작입니다.

한국관광공사 OpenAPI 활용이 **필수 조건**입니다(1차 심사 배점 20점, 미충족 시 심사 제외 가능).

| 저장소 | 내용 |
|---|---|
| `freepets-app` | Expo 앱 |
| `freepets-api` | 백엔드 (Spring · Node) |
| `freepets-docs` | 기능 설계 문서 · DB 스키마 · 협업 규칙 |

---

## 깃 워크플로 — 반드시 지킬 것

### `main`에 직접 커밋하거나 푸시하지 않는다

작업은 항상 브랜치에서 하고 PR로 합칩니다. 깨진 코드가 `main`에 올라가면 전원이 pull받는 순간 막힙니다.

### 작업 시작

```bash
git switch main
git pull                       # 최신 상태부터 시작 — 이걸 빼면 충돌이 납니다
git switch -c feat/작업이름      # 새 브랜치
```

브랜치 접두어: `feat/` 새 기능 · `fix/` 버그 수정 · `docs/` 문서 · `db/` 스키마 · `chore/` 설정

### 작업 중

의미 단위로 커밋합니다. "이것저것 수정" 같은 커밋은 만들지 마세요.

```bash
git add -A
git commit -m "..."
```

### 작업 끝

```bash
git push -u origin feat/작업이름   # 그 브랜치의 첫 push만 -u
gh pr create                      # PR 생성
```

**PR을 사용자 확인 없이 머지하지 마세요.** 머지는 사람이 판단합니다.

---

## 커밋 메시지

첫 줄은 **무엇을 했는지 한글 한 줄**, 본문에는 **왜 그렇게 했는지**를 씁니다.
코드를 보면 알 수 있는 "무엇"보다, 코드에 안 남는 "왜"가 나중에 훨씬 쓸모 있습니다.

```
리뷰 신고를 카운트에서 가중치로 변경

단순 카운트는 신고자 신뢰도와 사업자 여부를 반영할 수 없다.
발자국 등급이 사업자에게 이해관계가 되는 순간 조직적 신고가 들어올 수 있어
정수 카운트로는 방어가 불가능하다.
```

---

## 절대 하지 말 것

| 금지 | 이유 |
|---|---|
| `.env` 커밋 | DB 비밀번호·API 키가 인터넷에 남습니다. 커밋을 지워도 기록에 남습니다 |
| API 키를 코드에 하드코딩 | 같은 이유. 반드시 환경변수로 |
| `node_modules/`, 빌드 산출물 커밋 | 용량이 큽니다. 설치로 복원됩니다 |
| `git push --force` | 팀원의 커밋을 지울 수 있습니다 |
| `main`에 직접 push | 깨진 코드가 전원에게 퍼집니다 |
| 확인 없이 PR 머지 | 사람이 판단할 일입니다 |

---

## 커밋 전에 확인할 것

빌드나 타입 체크가 깨진 상태로 커밋하지 마세요.

- **앱** — `npx tsc --noEmit`
- **Spring** — `./gradlew build` 또는 `mvn verify`
- **Node** — `npm run build` / `npm test`

---

## 문서 동기화 — 저장소가 나뉘어 있다는 걸 잊지 말 것

API 명세나 DB 스키마를 바꾸면 **`freepets-docs`에도 반영해야 합니다.**
코드만 고치고 문서를 안 고치면, 다른 저장소를 보는 팀원은 옛 명세대로 작업하게 됩니다.

| 바꾼 것 | 같이 고칠 문서 |
|---|---|
| 엔드포인트 추가·변경 | `docs/02-api-design.md` |
| 테이블·컬럼 변경 | `db/schema.sql` + `db/migrations/NNN_설명.sql` + `docs/01-db-schema.md` |
| AI 프롬프트·출력 스키마 | `docs/03-ai-prompts.md` |
| 등급·포인트 정책 | `docs/04-review-paw-system.md` / `docs/05-contribution-rewards.md` |

**공용 DB에 직접 `ALTER TABLE`을 치지 마세요.** 변경은 `freepets-docs/db/migrations/`에 번호를 붙인 파일로 남기고 커밋한 뒤 적용합니다. 그래야 다른 사람이 무엇이 바뀌었는지 압니다.

---

## 백엔드 구현 시 주의 (`freepets-api`)

`freepets-docs/db/README.md`에 자세히 있습니다. 자주 걸리는 것만:

1. **생성 컬럼은 INSERT하지 않는다** — `facilities.location`, `reviews.friendliness`는 `GENERATED`입니다. JPA는 `@Column(insertable = false, updatable = false)`.
2. **ENUM은 영문 코드 그대로 응답한다** — `ALLOWED`, `CAFE` 등. 한글 변환은 프론트 책임입니다.
3. **Claude 호출 파라미터** — 모델마다 다릅니다. 쓰는 모델을 먼저 확인하세요.
   - **샘플링(`temperature`/`top_p`/`top_k`)**: Sonnet 5·Opus 5·Opus 4.7/4.8·Fable 5에서는 파라미터 자체가 **제거**됐습니다. 기본값이든 아니든 **넣으면 400**입니다 — `temperature: 1`도 400입니다. 그냥 빼세요. (Sonnet 4.6·Opus 4.6과 그 이전은 아직 받습니다.)
   - **`thinking` 생략 시 동작**: `claude-sonnet-5`와 **`claude-opus-5`** 는 생략하면 **adaptive가 기본 ON**이고, Fable 5는 **항상 ON**입니다. Opus 4.7/4.8·Sonnet 4.6·Haiku 4.5는 생략하면 꺼진 채로 돕니다.
   - **끄는 방법은 모델마다 다릅니다.** Sonnet 5는 `{"type":"disabled"}`가 통하지만, **Fable 5는 400**이고 **Opus 5는 effort `xhigh`/`max`에서 400**입니다. 게다가 **thinking을 끈 Opus 5는 도구 호출을 `tool_use` 블록이 아니라 본문 텍스트에 써버리는** 알려진 실패 모드가 있습니다 — 턴은 성공하고 에러도 안 나는데 호출만 실행되지 않습니다(4번 항목이 막으려는 상황을 이게 만듭니다). **끄지 말고 `output_config.effort`를 `low`/`medium`으로 내리세요.** 비용도 같이 내려갑니다.
   - **`budget_tokens`는 쓰지 마세요.** Sonnet 5·Opus 5·Opus 4.7/4.8·Fable 5에서 **400**입니다. 훈련 데이터에 흔한 옛 패턴이라 실수하기 쉽습니다. 깊이 조절은 `effort`로 합니다.
   - **`output_config.effort`**: `low`/`medium`/`high`(모델에 따라 `xhigh`/`max`)이고 **기본값은 `high`** 입니다. **거부하는 건 Sonnet 4.5·Haiku 4.5와 그 이전뿐**이고 Sonnet 4.6·Sonnet 5·Opus 4.5 이상은 전부 지원합니다("Sonnet 전용"이 아닙니다). 단 Opus 4.5는 `low`/`medium`/`high`만 있습니다.
   - **assistant prefill은 400**입니다(Sonnet 5·Opus 5·Fable 5·4.6/4.7/4.8 전부). 응답 형식은 구조화 출력이나 시스템 프롬프트로 잡으세요.
   - 모델 ID는 정확히 씁니다 — `claude-opus-5`·`claude-sonnet-5`·`claude-haiku-4-5`. 기억나는 날짜 접미사를 임의로 붙이지 마세요.
4. **도구 호출을 강제하지 않으면 파싱이 통째로 실패합니다** — `strict: true`는 도구가 **호출됐을 때** 입력 스키마만 검증하고, 호출 자체는 보장하지 않습니다. 기본값 `tool_choice: {"type":"auto"}`면 모델이 도구 없이 텍스트만 반환할 수 있습니다. 도구를 쓰는 경로(조건 파싱·판별)는 **`tool_choice: {"type":"tool","name":"..."}`로 강제**하세요.
   - `strict: true`는 **도구 정의 최상위**에 둡니다 — `name`·`description`·`input_schema`와 **형제**이지 `input_schema` 안이 아닙니다. 안에 넣으면 적용되지 않습니다(그때 400이 나는지 조용히 무시되는지는 확인된 바 없으니, 위치를 맞추는 것으로 예방하세요).
   - 스키마에는 `additionalProperties: false`와 `required`가 **필수**입니다. strict 실패의 1순위 원인입니다.
   - 도구 없이 JSON 응답만 받는 경로라면 `output_config.format.type: "json_schema"` + `schema`를 씁니다.
   - 자세한 건 `freepets-docs/docs/03-ai-prompts.md` 공통 설계 원칙.
5. **API 키는 서버에만** — 앱 번들은 사용자 기기에 내려가므로 키를 넣으면 그대로 유출됩니다. 앱은 반드시 백엔드를 경유합니다.
6. **리뷰 작성 자격 검사는 서비스 레이어 책임** — 해당 시설에 `pet_checks` 이력이 없으면 403 `REVIEW_NOT_ELIGIBLE`. DB 제약으로 걸려 있지 않습니다.
7. **삭제 정책** — 대부분 CASCADE지만 `reviews.pet_id`만 `SET NULL`입니다. 반려동물을 지워도 리뷰는 남아야 등급이 흔들리지 않습니다.

---

## 코드 스타일

- 주석과 커밋 메시지는 **한글**로 씁니다.
- 주석은 "무엇"이 아니라 **"왜"**를 씁니다. 코드가 이미 무엇인지 말하고 있습니다.
- 기존 파일의 스타일(들여쓰기·네이밍·주석 밀도)을 따릅니다.

---

## 이 저장소 (freepets-app) 전용

### Expo가 바뀌었습니다

코드를 쓰기 전에 반드시 정확한 버전의 문서를 확인하세요: https://docs.expo.dev/versions/v57.0.0/

기억에 의존해 Expo API를 쓰지 마세요. SDK 57에서 바뀐 것이 많습니다.

### 커밋 전 확인

```bash
npx tsc --noEmit
```

### 새 화면을 추가했다면

타입 라우트가 자동 생성되는 구조라, 새 라우트를 추가하면 `npx expo start`를 한 번 띄워
`.expo/types/router.d.ts`를 재생성해야 타입 체크가 통과합니다.

### 구조

```
src/
├── app/          Expo Router — 폴더 구조가 곧 화면 경로
├── components/   공통 컴포넌트
├── constants/    디자인 토큰 (theme.ts) — 색상을 하드코딩하지 말고 여기서 가져오세요
├── data/         도메인 타입 · 목 데이터 · 판별 로직
└── store/        전역 상태
```

`data/judge.ts`는 백엔드 AI 판별을 대신하는 목 구현입니다.

⚠️ **"함수 호출만 교체하면 된다"고 가정하지 마세요.** `freepets-docs/docs/03` 4장 판정 순서표
0~10번 중 `judge.ts`가 구현한 건 1번 하나뿐입니다 — 종(`kind`) 검사·맹견 검사·`partial_area_note`가
없고, `Facility`에 `petConditionStatus`가 없어 상태 분기도 못 합니다. 요구사항 코드도 서로 없고
(`SMALL_ONLY`·`VACCINATION`·`OUTDOOR_ONLY` ↔ `MANNER_BELT`·`STROLLER`·`FREE`·`ETC`),
경계값은 답이 뒤집힙니다("10kg 미만"에 정확히 10.0kg → 표는 `DENIED`, `judge.ts`는 `CONDITIONAL`).
실 API 교체는 타입 추가·분기 추가·신규 UI가 따르는 별도 작업으로 잡으세요.
