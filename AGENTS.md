# Agent Guide

**Agentic Base** — AI 제품 베이스 템플릿. 에이전틱 엔지니어링 원칙에 따라 설계된 Next.js AI 제품의 뼈대.

## 원칙

이 템플릿은 [mirror-mind/agentic-engineering-principles.md](https://github.com/jaeyoungkang/mirror-mind)의 원칙을 구현한다:

1. **에이전트의 생산성은 코드베이스의 품질에 비례한다**
2. **명확한 경계** — 계산과 효과를 분리한다
3. **품질 게이트** — 선언 → 실행 → 검증
4. **모든 것은 파일이다** — 추상화를 하나로 수렴

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

## 품질 게이트

```bash
npm run quality:check  # 전체 게이트 실행
```

| 게이트             | 도구                               | 경계        |
| ------------------ | ---------------------------------- | ----------- |
| Formatter          | Prettier                           | 표현의 경계 |
| Linter             | ESLint strictTypeChecked + sonarjs | 규칙의 경계 |
| jscpd              | jscpd                              | 책임의 경계 |
| Test coverage      | Vitest + v8                        | 검증의 경계 |
| knip               | knip                               | 존재의 경계 |
| dependency-cruiser | dependency-cruiser                 | 의존의 경계 |
| tloc               | tokei + check-test-ratio           | 비율의 경계 |
| specdown           | specdown                           | 스펙의 경계 |

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

## 검증

```bash
npm run typecheck     # TypeScript strict
npm run lint          # ESLint strict
npm run test:coverage # Vitest + coverage
npm run specdown      # 실행 가능 스펙
npm run build         # Next.js 빌드
```
