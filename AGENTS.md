# Agent Guide

**Agentic Base** — AI 제품 베이스 템플릿. 에이전틱 엔지니어링 원칙에 따라 설계된 Next.js AI 제품의 뼈대.

## 원칙

이 템플릿은 [mirror-mind/agentic-engineering-principles.md](https://github.com/jaeyoungkang/mirror-mind)의 원칙을 구현한다:

1. **에이전트의 생산성은 코드베이스의 품질에 비례한다**
2. **명확한 경계** — 계산과 효과를 분리한다
3. **관심사 중앙화** — 반복 값을 한 곳에 선언하고, 하드코딩을 기계적으로 차단한다
4. **품질 게이트** — 선언 → 실행 → 검증. 설계·구현·관심사 모든 층에 재귀 적용
5. **모든 것은 파일이다** — 추상화를 하나로 수렴

## Authority

agentic-base는 권한을 네 칩으로 분리한다. 이 구분은 누가 행동하는가가 아니라 누가 결정할 수 있는가를 뜻한다.

| Chip  | 이름                               | agentic-base 매핑                                                                        |
| ----- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| **H** | Human — normative authority        | 정본 markdown 작성자. Promise, Intent Check, Acceptance Check, Aspect 의미와 철회 승인권 |
| **A** | Agent — translation authority      | `src/product/`와 `src/agent/` 작성. 계약을 spec, code, test, eval로 전파                 |
| **E** | Evaluator — truth signal authority | judge/eval 실행. verdict 신호를 만들지만 계약 의미를 바꾸지 않음                         |
| **S** | System — constraint authority      | husky, CI, ESLint, specdown, `harness:score`, dependency-cruiser, concern guard          |

에이전트는 A authority만 가진다. H 결정을 흉내 내거나 E verdict를 evidence 없이 닫지 않는다.

## Layer

| Layer        | 소유 authority | agentic-base 위치                                                                                                        |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Contract     | H              | `docs/contracts/story-chain/`, `docs/contracts/feature-specs.md`, `docs/reality-feedback.md`, `docs/intent-judgments.md` |
| Propagation  | A              | `docs/contracts/story-chain/specs/*.spec.md`, `src/product/`, `src/agent/`, 관련 test/eval 산출물                        |
| Enforcement  | S              | `.husky/`, `.github/workflows/`, `scripts/quality/`, ESLint, TypeScript, specdown, dependency-cruiser                    |
| Verification | E              | `vitest`, `run:shell`, judge/eval 결과, rendered DOM 또는 runtime output evidence                                        |

Contract → Propagation → Enforcement → Verification 순서로 의미가 내려간다. 역방향 현실 신호는 `docs/reality-feedback.md`에 남기고 Contract를 다시 연다.

## Verdict Trichotomy

Verdict는 `met`, `not-met`, `unknown` 셋뿐이다.

| Verdict   | 의미                                                  |
| --------- | ----------------------------------------------------- |
| `met`     | production-equivalent evidence가 약속 충족을 보여준다 |
| `not-met` | 실행된 truth signal이 약속 미달을 보여준다            |
| `unknown` | 판정 부채가 남아 있으며 blocking이다                  |

`unknown` 발생 조건:

- evaluator가 돌지 않았다
- evidence가 부족하다
- rubric 또는 answer criteria가 약하다
- 입력이 production-equivalent가 아니다
- 결과가 흔들려 `met`이나 `not-met`을 말하기 어렵다

`met`은 `runtime-output` 또는 `rendered-dom` evidence ref 없이 선언하지 않는다. `not-met`과 `unknown`은 `gateNotes`나 ledger 본문에 사유를 남긴다.

## Escalation Protocol

에이전트가 H authority를 대신해야 하거나, evidence 없이 verdict를 닫아야 하거나, 계약과 현실 신호가 충돌하면 멈추고 아래 형식으로 보고한다.

```text
STATUS: NEEDS_HUMAN
ROW: <promise/aspect/spec/check ref>
WHY: <advance 못 하는 이유 한 줄>
DATA: <관련 verdict, signal, 파일 ref>
RECOMMENDATION: <후보안 1-2개>
```

STOP 조건:

- Promise는 있는데 Intent Check나 Acceptance Check가 비어 있다
- Intent Check가 Acceptance Check의 재서술처럼 보인다
- 같은 Promise 안에서 Intent Check와 Acceptance Check가 충돌한다
- covering spec, owner, evidence path가 비어 있다
- `unknown` 또는 `not-met`인데 enforcement가 이를 막지 않는다
- 문서 계약과 운영 관찰이 반복해서 어긋난다
- 철회 결정이나 intent-absorbed 처리가 필요하지만 Human Judgment Gate ref가 없다

## Abstraction Reduction over Guard Accumulation

guard를 추가하기 전에 abstraction 자체를 줄일 수 있는지 먼저 검토한다. 잘못된 경계를 test, lint, policy advice로 계속 둘러싸기보다, 그 잘못된 상태를 표현하기 어려운 구조로 바꾸는 편이 우선이다. guard는 abstraction reduction을 검토한 뒤의 fallback이다.

## 구조

```
src/
├── app/           # Next.js route tree only
├── domain/        # stable contracts (Artifact, Message, Turn)
├── features/      # Product Plane UI
├── stores/        # ephemeral client state (Zustand)
├── agent/         # Agent Plane (orchestrator, par, policy, tools)
├── execution/     # Execution Plane (repository, domain-access, services)
├── observability/ # observe, track, schemas
├── lib/           # env, llm wrappers, supabase client
└── product/       # business logic (prompts, tools, artifact-types, profile)
```

## Import 방향 규칙

`Product → Agent → Execution` 만 허용. 역방향 금지.

- `src/app/`, `src/features/`, `src/stores/` → `src/agent/`, `src/execution/`, `src/domain/` 참조 가능
- `src/agent/` → `src/execution/`, `src/domain/` 참조 가능
- `src/execution/` → `src/domain/` 참조 가능
- **역방향 금지**: `src/execution/` → `src/agent/` ✗, `src/agent/` → `src/app/` ✗

dependency-cruiser로 자동 강제.

## Execution 계층 규칙

API 라우트에서 데이터까지의 호출 체인:

```
Route handler → Domain Access → Repository → Supabase
```

| 계층              | 위치                           | 역할                           | 규칙                                           |
| ----------------- | ------------------------------ | ------------------------------ | ---------------------------------------------- |
| **Repository**    | `src/execution/repository/`    | Artifact CRUD (DB 추상화)      | Supabase 직접 참조. 도메인 모델 반환           |
| **Domain Access** | `src/execution/domain-access/` | 타입 검증 래퍼                 | Repository만 의존. 타입 단언으로 서브타입 보장 |
| **Services**      | `src/execution/services/`      | 외부 연결 (LLM, 3rd party API) | Repository/Domain Access와 독립                |

- Route handler는 Domain Access 또는 Service만 호출한다. Repository를 직접 호출하지 않는다.
- Repository의 모든 메서드에 `userId`를 강제한다 (테넌트 격리).
- DB 스키마(snake_case)와 도메인 모델(camelCase)은 Repository 내부 mapper로 분리한다.

## Product 계층 규칙

`src/product/`는 프로젝트의 비즈니스 로직을 모은다. 템플릿 코어와 분리하는 경계.

| 하위              | 역할                 | 핵심 규칙                                            |
| ----------------- | -------------------- | ---------------------------------------------------- |
| `artifact-types/` | Artifact 빌더 함수   | 순수 함수. 도메인 타입만 의존                        |
| `policies/`       | 검증·시뮬레이션·매핑 | **순수 함수만**. DB·LLM 호출 금지                    |
| `prompts/`        | LLM 프롬프트 정의    | 입출력 스키마 + 프롬프트 텍스트. 호출은 Services에서 |
| `tools/`          | 에이전트 도구 정의   | Agent Plane에서 참조                                 |

경계 원칙:

- `policies/`에는 순수 함수만 넣는다. 같은 입력이면 항상 같은 출력.
- `prompts/`는 프롬프트 텍스트와 Zod 출력 스키마만 정의한다. 실제 LLM 호출은 `src/execution/services/`에서.
- Artifact 타입이 늘어나면 `artifact-types/`에 빌더 함수를 추가한다. 새 테이블을 만들지 않는다.

## Route Handler 헬퍼

`src/lib/http/route-handler.ts`가 API 라우트의 공통 관심사를 처리한다:

- `parseJsonBody(request)` — JSON 파싱 + InvalidJsonBodyError
- `formatZodIssues(issues)` — Zod 검증 오류를 읽기 쉬운 문자열 배열로

모든 API 라우트에서 이 헬퍼를 사용한다. 직접 `request.json()`을 호출하지 않는다.

## 품질 게이트

```bash
npm run quality:check  # 전체 게이트 실행
```

| 게이트             | 도구                               | 경계          |
| ------------------ | ---------------------------------- | ------------- |
| Formatter          | Prettier                           | 표현의 경계   |
| Linter             | ESLint strictTypeChecked + sonarjs | 규칙의 경계   |
| jscpd              | jscpd                              | 책임의 경계   |
| Test coverage      | Vitest + v8                        | 검증의 경계   |
| knip               | knip                               | 존재의 경계   |
| dependency-cruiser | dependency-cruiser                 | 의존의 경계   |
| tloc               | tokei + check-test-ratio           | 비율의 경계   |
| specdown           | specdown                           | 스펙의 경계   |
| Concern Check      | check-concerns                     | 관심사의 경계 |

### Enforcement Bootstrap

clone 직후 `npm install`이 `package.json`의 `prepare` 스크립트로 `husky install`을 실행해 로컬 hook 경로를 설치한다.

| 경로                | 실행                      | 역할              |
| ------------------- | ------------------------- | ----------------- |
| `.husky/pre-commit` | `npm run quality:commit`  | commit 전 게이트  |
| `.husky/pre-push`   | `npm run quality:prepush` | push 전 전체 검증 |

이 템플릿의 hook은 staged fast-skip을 두지 않는다. pre-commit은 `quality:commit` 전체(guards + lint-staged)를 실행하고, pre-push는 `quality:prepush`가 연결한 `quality:check` 전체를 실행한다. clone 직후부터 로컬 hook과 CI가 같은 품질 경로를 바라보게 만드는 것이 Phase 0 enforcement baseline이다.

Generated artifact는 commit하지 않는다. `specs/report.json`, `specs/report/`, `.spec-scope-out/`은 실행 결과물이며 정본이 아니다. specdown 산출물은 commit하지 않고, 검증 실행이 worktree를 dirty하게 만들지 않도록 로컬/CI artifact로만 본다.

### 관심사 중앙화

여러 파일에 반복되는 값(디자인 토큰, API 경로, 에러 메시지 등)은 **선언-매핑-강제** 3단으로 관리한다:

| 단       | 역할                                   | 빠지면                                |
| -------- | -------------------------------------- | ------------------------------------- |
| **선언** | 값의 단일 원본을 한 파일에 정의        | 뭘 써야 하는지 모름                   |
| **매핑** | 사용 지점에 연결 (import, CSS 변수 등) | 정의했지만 아무도 안 씀               |
| **강제** | 하드코딩 우회를 기계적으로 탐지·차단   | 에이전트가 직접 값을 써서 일관성 붕괴 |

`.concern-rules.json`에 금지 패턴을 선언하면 `guard:concerns`가 CI에서 자동 차단한다. 프롬프트로 부탁하는 게 아니라 스크립트로 강제한다.

### 설계 층: spec-scope

스펙 문서의 완전성을 구현 전에 검증한다. `scripts/spec-scope/`에 인라인.

```bash
npm run spec-scope         # LLM으로 플로우 추출 + 갭 분석
npm run spec-scope:parse   # 기계적 파싱 (LLM 없이)
```

2-phase 검증:

1. **구조적 분석** (코드) — orphan node, dead edge, untested error path
2. **의미적 분석** (LLM) — spec이 실제로 주장하는 것을 테스트하는가

출력: `.spec-scope-out/`에 플로우 시각화(HTML) + 갭 리포트(MD/JSON). 환경 변수 `GEMINI_API_KEY` 필요.

## LLM 이원화

| 수준            | API                     | 모델                   | 용도                            |
| --------------- | ----------------------- | ---------------------- | ------------------------------- |
| Plan (에이전트) | `structuredInference()` | gemini-3-flash-preview | 구조화된 추론 → Zod 스키마 JSON |
| Execute (실행)  | `streamExecution()`     | gemini-3-flash-preview | 스트리밍 응답 + tool use        |

## Artifact 균일 인터페이스

모든 산출물은 `Artifact` 인터페이스를 통과한다. 새 타입 추가 시:

1. `src/domain/artifact.ts`에 타입 + metadata 추가
2. `src/domain/artifact-schema.ts`에 Zod 스키마 추가
3. `src/features/`에 렌더러 추가
4. 필요 시 `src/agent/tools/`에 도구 연결

**새 스토어와 새 영속 경로는 추가하지 않는다** — Artifact CRUD가 유일한 영속 경로.

### 하네스 스코어카드

```bash
npm run harness:score   # 7축 하네스 커버리지 측정
```

프로젝트의 하네스 완성도를 제어·연결·정책·기억·검증·구성·플랫폼 7축으로 점검한다. 새 프로젝트 부트스트랩 후, 또는 인프라 변경 후 실행하여 빠진 것을 확인.

## 검증

```bash
npm run typecheck     # TypeScript strict
npm run lint          # ESLint strict
npm run test:coverage # Vitest + coverage
npm run specdown      # 실행 가능 스펙
npm run build         # Next.js 빌드
```
