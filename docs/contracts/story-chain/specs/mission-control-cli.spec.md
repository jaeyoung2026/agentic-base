---
curated: true
intentAbsorbedIntoAcceptance: false
intentJudgmentRefs: []
verdict: unknown
evidence:
gateNotes:
---

# Mission Control CLI — Spec Ledger (curated)

> agentic-base 첫 reflexive promise. 검증 인프라가 자기 자신의 동작(`mc:add-promise`)을 약속한다.
> 3 AC 모두 deterministic — vitest + run:shell로 닫는다. Intent Check는 사용자 경험 차원이라 별도 live judge 또는 사람 review 대상.

## Source Promises

- promise:mission-control-cli

## Applied Aspects

(none yet)

## Intent Checks

- intent-check:mission-control-cli
  - source promise: promise:mission-control-cli
  - evidence: unknown — live judge 미구축, sufficiency review로 사람 판정

## Acceptance Checks

- acceptance-check:mission-control-cli-ac1
  - source promise: promise:mission-control-cli
  - evidence: run:shell `bash -c 'OUT=$(node scripts/mission-control/mc-add-promise.mjs 2>&1); echo "$OUT" | grep -q "STATUS: NEEDS_HUMAN"'`

- acceptance-check:mission-control-cli-ac2
  - source promise: promise:mission-control-cli
  - evidence: run:shell `node scripts/mission-control/__tests__/mc-add-promise-smoke.mjs --case ac2`

- acceptance-check:mission-control-cli-ac3
  - source promise: promise:mission-control-cli
  - evidence: run:shell `node scripts/mission-control/__tests__/mc-add-promise-smoke.mjs --case ac3`

## Coverage By Story

| Promise                     | Acceptance Check                         | Evidence                                                      | Notes                 |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------------- | --------------------- |
| promise:mission-control-cli | acceptance-check:mission-control-cli-ac1 | run:shell — exit 1 + STATUS: NEEDS_HUMAN                      | 인자 부족 차단        |
| promise:mission-control-cli | acceptance-check:mission-control-cli-ac2 | run:shell — file generated + frontmatter parsed               | 정상 시 골격 생성     |
| promise:mission-control-cli | acceptance-check:mission-control-cli-ac3 | run:shell — validator immediate critical on missing_ac_ledger | 약속 미전파 즉시 차단 |

## Executable Evidence

### acceptance-check:mission-control-cli-ac1 — 인자 부족 시 차단

```run:shell
$ bash -c 'OUT=$(node scripts/mission-control/mc-add-promise.mjs 2>&1); CODE=$?; echo "$OUT" | grep -q "STATUS: NEEDS_HUMAN" && [ $CODE -eq 1 ]'
```

### acceptance-check:mission-control-cli-ac2 — 인자 충족 시 골격 생성

```run:shell
$ node scripts/mission-control/__tests__/mc-add-promise-smoke.mjs --case ac2
```

### acceptance-check:mission-control-cli-ac3 — 생성 직후 validator critical 발사

```run:shell
$ node scripts/mission-control/__tests__/mc-add-promise-smoke.mjs --case ac3
```

## Sufficiency Review

### 2026-05-02 - intent-check:mission-control-cli

- Input: 본 spec의 run:shell 3건이 production-equivalent (실제 CLI를 동일 binary로 실행)
- Evidence: unknown — runtime 또는 rendered DOM이 아니라 CLI stdout/stderr. live judge가 "사용자가 다음 행동을 알 수 있는가"를 판정하기 전까지 unknown 유지
- Gaps observed:
  - Adopt-resolved - 3 AC 모두 deterministic 측정으로 닫음
  - Reject - "사용자가 다음 행동을 알 수 있는가" UX 질문은 이 spec 범위 밖. 별도 live judge 또는 사람 review로 넘김
- Verdict: unknown
