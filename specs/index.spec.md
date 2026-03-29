---
type: spec
---

# Agentic Base 스펙 인덱스

이 프로젝트의 실행 가능 스펙 목록.

## Domain Contract

Artifact 타입이 정의되어 있어야 한다.

```run:shell
$ grep -c "ArtifactType" src/domain/artifact.ts
```

## LLM Wrappers

structuredInference와 streamExecution이 export되어 있어야 한다.

```run:shell
$ grep -c "export.*function.*structuredInference\|export.*function.*streamExecution" src/lib/llm/inference.ts
```

## PAR Schema

planResultSchema와 auditResultSchema가 export되어 있어야 한다.

```run:shell
$ grep -c "export const planResultSchema\|export const auditResultSchema" src/agent/par/schema.ts
```
