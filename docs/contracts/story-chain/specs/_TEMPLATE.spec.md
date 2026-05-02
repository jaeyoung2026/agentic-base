---
curated:
intentAbsorbedIntoAcceptance: false
intentJudgmentRefs: []
verdict: unknown
evidence:
gateNotes:
---

# {Spec Name} Spec Ledger

## Source Promises

- promise:{promise-slug}

## Applied Aspects

- aspect:{aspect-slug}

## Intent Checks

- intent-check:{semantic-slug}
  - source promise: promise:{promise-slug}
  - evidence: unknown

## Acceptance Checks

- acceptance-check:{semantic-slug}
  - source promise: promise:{promise-slug}
  - evidence: unknown

## Coverage By Story

| Promise                | Acceptance Check                 | Evidence | Notes                                         |
| ---------------------- | -------------------------------- | -------- | --------------------------------------------- |
| promise:{promise-slug} | acceptance-check:{semantic-slug} | unknown  | Skeleton row. Replace before `curated: true`. |

## Executable Evidence

```run:shell
$ test -f docs/contracts/story-chain/specs/_TEMPLATE.spec.md
```

## Sufficiency Review

### YYYY-MM-DD - intent-check:{semantic-slug}

- Input: {production-equivalent fixture, runtime output, or rendered DOM}
- Evidence: {runtime-output or rendered-dom ref}
- Gaps observed:
  - Adopt-resolved - {gap and resolution}
  - Reject - {gap and why it is outside this surface}
- Verdict: unknown
