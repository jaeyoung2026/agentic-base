---
id: promise:mission-control-cli
legacyIds: []
title: 사용자가 mc:add-promise 한 줄로 첫 promise 골격을 만들 수 있다
experience: experience:authoring
moment: moment:first-promise
lane: admin
status: draft
aspects: []
intentChecks:
  - intent-check:mission-control-cli
acceptanceChecks:
  - acceptance-check:mission-control-cli-ac1
  - acceptance-check:mission-control-cli-ac2
  - acceptance-check:mission-control-cli-ac3
coveringSpecs:
  - docs/contracts/story-chain/specs/mission-control-cli.spec.md
verdict: unknown
evidence:
gateNotes:
---

# 사용자가 mc:add-promise 한 줄로 첫 promise 골격을 만들 수 있다

## 1. Promise

As a developer adopting agentic-base,
I want one CLI command that scaffolds my first Promise,
So that I can move from an empty skeleton to a validator-blocking chain in seconds — not by reading docs and copy-pasting frontmatter.

## 2. Intent Check

### intent-check:mission-control-cli

- question: 사용자가 `mc:add-promise <slug> --title ... --experience ... --moment ... --lane ...` 한 줄을 실행했을 때, 곧장 의미 있는 promise 파일이 만들어지고 다음 단계(`mc:validate-story-chain`이 무엇을 막는지)가 명확히 보이는가?
- evidence: unknown (live judge 또는 사람 review로 측정)
- why live judge: "의미 있는 골격"은 deterministic으로 환원되지 않는다 — frontmatter 정확성(AC1~AC3가 잡음)과 별개로, "사용자가 다음 행동을 알 수 있는가"라는 UX 질문이 남는다.
- linked acceptance checks:
  - acceptance-check:mission-control-cli-ac1
  - acceptance-check:mission-control-cli-ac2
  - acceptance-check:mission-control-cli-ac3
- answer criteria: "그냥 파일이 생겼다" 같은 답은 fail. "사용자가 다음으로 무엇을 해야 하는지 stdout이 안내했고, validator가 즉시 구체적 finding을 발사했다"가 met의 최소 조건.

## 3. Acceptance Check

### acceptance-check:mission-control-cli-ac1

- description: 인자가 부족하면(`<slug>`, `--title`, `--experience`, `--moment`, `--lane` 중 하나라도 빠지면) `STATUS: NEEDS_HUMAN`을 stderr에 출력하고 exit 1로 종료한다.
- evidence: run:shell — `node scripts/mission-control/mc-add-promise.mjs` 실행 시 stderr에 `STATUS: NEEDS_HUMAN`이 포함되는지 grep + exit code 검사

### acceptance-check:mission-control-cli-ac2

- description: 인자가 충족되면 `docs/contracts/story-chain/promises/<slug>.md`가 생성되고, frontmatter의 `id`, `title`, `experience`, `moment`, `lane`이 입력대로 채워진다. 본문은 `_TEMPLATE.md`의 placeholder를 그대로 유지한다(H authority 영역).
- evidence: vitest 또는 run:shell — 생성 후 파일 존재 + YAML frontmatter parse + 입력 인자와 일치 검사

### acceptance-check:mission-control-cli-ac3

- description: 생성 직후 `mc:validate-story-chain`이 새 promise에 대해 `missing_ac_ledger` critical finding을 즉시 발사한다(즉, 새 promise가 ledger에 등록될 때까지 release blocked 상태가 강제된다).
- evidence: run:shell — 임시 promise 생성 → validator 실행 → finding 출력 검사 → 정리

## 4. Evidence

Verdict starts as `unknown`. Flip to `met` only with production-equivalent evidence:

```yaml
evidence:
  kind: runtime-output | rendered-dom
  ref: <path or artifact ref>
```

이 promise는 *agentic-base 자체의 첫 reflexive promise*다 — 검증 인프라가 자기 자신의 동작을 약속한다. AC1~AC3는 deterministic이므로 vitest + run:shell로 닫는다. Intent Check는 사용자 경험이라 별도 live judge 또는 사람 review가 필요하다.
