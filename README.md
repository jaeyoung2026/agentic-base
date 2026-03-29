# Agentic Base

AI 제품을 빠르게 만들기 위한 베이스 템플릿. 초기 세팅이 준비된 상태에서 비즈니스 로직만 쌓아올리는 구조.

## Why

기존 AI 템플릿(Vercel Chatbot, LangChain Starter 등)은 "채팅 UI + LLM 호출" 수준에 머문다. 실제 AI 제품 운영에 필요한 구조화된 추론, 균일 데이터 인터페이스, 관측 체계, 품질 게이트가 없다.

이 템플릿은 [Light House](https://github.com/corca-ai/lighthouse)(대화형 연구 동료 에이전트)를 만들면서 검증한 에이전틱 엔지니어링 원칙을 일반화한 것이다.

## 핵심 아이디어

### 에이전트의 생산성은 코드베이스의 품질에 비례한다

에이전트를 잘 다루는 게 아니라, 에이전트가 잘 일할 수 있는 코드베이스를 만드는 것이 핵심이다. 코드 품질 관리는 사람의 리뷰가 아니라 구조적 강제(품질 게이트)로 전환해야 한다.

### 3-Plane 아키텍처

```
Product Plane  — UI, 사용자 인터랙션, 임시 상태
Agent Plane    — 구조화된 추론 (plan → execute → audit)
Execution Plane — DB, 외부 API, 비동기 실행
```

Import 방향: `Product → Agent → Execution` 만 허용. 역방향은 dependency-cruiser로 자동 차단.

### Artifact 균일 인터페이스

모든 산출물(대화, 문서, 검색 결과, 분석)은 하나의 `Artifact` 인터페이스를 통과한다. 새 스토어나 새 영속 경로를 만들지 않는다.

### LLM 이원화

| 수준            | 래퍼                    | 용도                            |
| --------------- | ----------------------- | ------------------------------- |
| Plan (에이전트) | `structuredInference()` | 구조화된 추론 → Zod 스키마 JSON |
| Execute (실행)  | `streamExecution()`     | 스트리밍 응답 + tool use        |

모델: `gemini-3-flash-preview` (기본). `src/lib/llm/inference.ts` 한 파일만 바꾸면 프로바이더 교체 가능.

## 기술 스택

| 영역       | 선택                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| 프레임워크 | Next.js 16 + React 19                                                      |
| AI         | Vercel AI SDK 6 + Gemini                                                   |
| 인증 + DB  | Supabase (Auth + PostgreSQL)                                               |
| 상태       | Zustand (임시 UI 상태만)                                                   |
| 스타일     | Tailwind CSS v4                                                            |
| 검증       | Zod 3 + TypeScript strict                                                  |
| 테스트     | Vitest + v8 coverage                                                       |
| 스펙       | [specdown](https://github.com/corca-ai/specdown) (마크다운 실행 가능 스펙) |

## 디렉토리 구조

```
src/
├── app/           # Next.js route tree only
├── domain/        # Artifact, Message — stable contracts
├── agent/         # Agent Plane (orchestrator, PAR loop, policy, tools)
├── execution/     # Execution Plane (repository, domain-access, services)
├── observability/ # observe, track — 관측 레이어
├── lib/           # env, LLM wrappers, Supabase client
├── product/       # 비즈니스 로직 (프롬프트, 도구, artifact 타입, 정책)
├── features/      # UI 컴포넌트
└── stores/        # Zustand ephemeral state
```

`src/product/`에 도메인 코드를 모아서 템플릿 코어와 분리한다.

## 품질 게이트

`npm run quality:check` 한 번으로 전체 게이트 실행:

| 게이트             | 도구                     | 경계        |
| ------------------ | ------------------------ | ----------- |
| Formatter          | Prettier                 | 표현의 경계 |
| Linter             | ESLint + next/typescript | 규칙의 경계 |
| jscpd              | jscpd                    | 책임의 경계 |
| Test coverage      | Vitest + v8              | 검증의 경계 |
| knip               | knip                     | 존재의 경계 |
| dependency-cruiser | dependency-cruiser       | 의존의 경계 |
| tloc               | check-test-ratio         | 비율의 경계 |
| specdown           | specdown                 | 스펙의 경계 |

에이전트가 만드는 코드의 약점(탈출구, 코드 삭제 안 함, 중복 테스트)을 자동으로 잡는다.

## 시작하기

```bash
# 1. 클론
git clone https://github.com/jaeyoung2026/agentic-base.git my-project
cd my-project
rm -rf .git && git init

# 2. 의존성 설치
npm install

# 3. 환경 변수
cp .env.example .env.local
# .env.local에 Supabase + Gemini 키 입력

# 4. specdown 설치 (Go 바이너리)
curl -sSfL https://raw.githubusercontent.com/corca-ai/specdown/main/install.sh | sh

# 5. 품질 게이트 확인
npm run quality:check  # all green이면 준비 완료

# 6. 개발 서버
npm run dev
```

## 템플릿이 제공하는 것 vs 직접 만들 것

| 제공 (초기 세팅)                 | 직접 만들 것 (비즈니스 로직) |
| -------------------------------- | ---------------------------- |
| 3-Plane 디렉토리 구조            | Artifact 타입 확장           |
| Artifact 인터페이스 + Zod 스키마 | 에이전트 도구 구현           |
| LLM 이원화 래퍼                  | 프롬프트, profile YAML       |
| PAR Loop 스키마 (plan + audit)   | 정책, 시나리오               |
| Supabase Auth + DB 배선          | 추가 도메인 테이블           |
| 관측 레이어 (observe + track)    | memory, cost, ranking 정책   |
| 품질 게이트 전체 체인            | 실제 UI/UX                   |
| specdown 초기 스펙               | 외부 서비스 통합             |

## 에이전트 스킬

코드 작성 에이전트(Claude Code, Codex)를 위한 스킬이 내장되어 있다:

| 스킬                        | 대상        | 내용                                       |
| --------------------------- | ----------- | ------------------------------------------ |
| next-best-practices         | Codex       | Next.js 16 파일 규칙, RSC 경계, async 패턴 |
| vercel-react-best-practices | Codex       | React 성능 최적화 65규칙                   |
| specdown                    | Claude Code | specdown 문법, CLI, traceability           |

## 원칙 문서

이 템플릿의 설계 근거는 [에이전틱 엔지니어링 원칙](https://github.com/jaeyoungkang/mirror-mind/blob/main/agentic-engineering-principles.md)에 있다.

## License

MIT
