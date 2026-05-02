# Story Chain

Story Chain은 agentic-base 프로젝트가 사용자 약속을 선언하고, 그 약속이 spec과 검증으로 내려가는 경로를 기록하는 정본 영역이다. 이 Phase 1 골격은 에이전트가 첫 Promise를 쓸 자리를 만들고 verdict 흐름의 기본 문법을 고정한다. validator, baseline, orphan surface audit은 Phase 2 범위다.

## Vocabulary

| 용어             | 역할                                                          | 정본 위치                                                             |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Promise          | 사용자에게 무엇을 약속하는지 쓰는 계약 단위                   | `docs/contracts/story-chain/promises/`                                |
| Intent Check     | 여러 Acceptance Check를 가로지르는 사용자 의도 질문           | Promise 본문과 covering Spec Ledger                                   |
| Acceptance Check | 단일 deterministic check로 닫히는 기계적 계약                 | Promise 본문, `docs/contracts/feature-specs.md`, covering Spec Ledger |
| Aspect           | 여러 Promise를 가로지르는 횡단 제약                           | `docs/contracts/story-chain/aspects/`                                 |
| Spec Ledger      | Promise, Aspect, run evidence, Sufficiency Review를 엮는 원장 | `docs/contracts/story-chain/specs/`                                   |

legacy 식별자는 `legacyIds:` frontmatter에만 보존한다. 새 작업의 기본 식별자는 `promise:{slug}`, `intent-check:{slug}`, `acceptance-check:{slug}`, `aspect:{slug}` 형식을 쓴다.

## Layout

```text
docs/contracts/story-chain/
  README.md
  promises/
    _TEMPLATE.md
  aspects/
    _TEMPLATE.md
  specs/
    _TEMPLATE.spec.md
```

`promises/`는 사용자 약속의 원문, `aspects/`는 횡단 제약의 선언, `specs/`는 executable spec과 Sufficiency Review를 담는다. `docs/contracts/feature-specs.md`는 Acceptance Check와 scenario catalog를 위한 얇은 ledger다.

## Verdict Defaults

새 Promise, Aspect, Spec Ledger의 verdict 기본값은 `unknown`이다. `unknown`은 중립이 아니라 blocking verdict다. evaluator가 돌지 않았거나, evidence가 부족하거나, rubric이 빈약하거나, production-equivalent 입력이 아니면 `unknown`으로 남긴다.

`not-met`은 실행된 truth signal이 약속 미달을 보여줄 때 쓴다. `met`은 아래 evidence rule을 만족할 때만 쓴다.

## Curated Spec Ledger Subtypes

Spec Ledger는 두 subtype 중 하나로 해석한다.

| Subtype         | frontmatter                                            | 조건                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default         | `curated: true`                                        | 최소 1개 Intent Check entry와 최소 1개 Acceptance Check entry를 가진다.                                                                                                                       |
| Intent-absorbed | `curated: true` + `intentAbsorbedIntoAcceptance: true` | Intent 질문이 Human Judgment Gate 결정에 의해 Acceptance Check로 흡수됐다. Intent Check entry는 0개일 수 있지만, source Promise마다 Acceptance Check coverage와 H decision ref가 있어야 한다. |

Skeleton ledger는 `curated:`를 비워 둘 수 있다. `curated: true`로 올리는 순간에는 위 subtype 중 하나를 명시적으로 만족해야 한다.

## Human Judgment Gate Refs

Intent-absorbed subtype은 `docs/intent-judgments.md`의 H decision을 인용해야 한다. ref 형식은 아래를 기본으로 한다.

```yaml
intentJudgmentRefs:
  - promise:{promise-slug} -> HJG-YYYY-MM-DD-{decision-slug}
```

`docs/intent-judgments.md`에는 같은 ID를 H3 heading으로 기록한다.

```markdown
### HJG-YYYY-MM-DD-{decision-slug}
```

legacy story를 가져온 경우에는 `legacyIds:`에 legacy ID를 보존하고, H decision entry의 `Legacy refs` 필드에 같이 적는다. Human Judgment Gate ref 없이 Intent를 Acceptance Check에 흡수했다고 주장하지 않는다.

## `met` Flip Evidence Rule

`met`으로 verdict를 바꾸려면 production-equivalent evidence가 필요하다. 허용되는 evidence kind는 둘뿐이다.

| kind             | 의미                                              |
| ---------------- | ------------------------------------------------- |
| `runtime-output` | 실제 runtime 경로가 만든 출력 또는 tool-call 인자 |
| `rendered-dom`   | 실제 UI 컴포넌트가 렌더한 DOM                     |

simulation wrapper, prompt 조각 직접 호출, production 경로 밖의 LLM 응답은 `met` evidence가 아니다. evidence가 이 기준을 만족하지 않으면 verdict는 `unknown`으로 남긴다.

Schema level evidence shape:

```yaml
evidence:
  kind: runtime-output | rendered-dom
  ref: <test path, DOM dump, run output, or artifact ref>
```

`not-met`과 `unknown`은 `gateNotes:`로 사유를 남긴다. `met`은 `evidence:` 없이 선언하지 않는다.
