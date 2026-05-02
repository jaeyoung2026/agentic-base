---
id: promise:{semantic-slug}
legacyIds: []
title: { short title }
experience: experience:{experience-slug}
moment: moment:{moment-slug}
lane: product | agent | execution | admin | other
status: draft
aspects: []
intentChecks:
  - intent-check:{semantic-slug}
acceptanceChecks:
  - acceptance-check:{semantic-slug}
coveringSpecs:
  - docs/contracts/story-chain/specs/{spec-name}.spec.md
verdict: unknown
evidence:
gateNotes:
---

# {short title}

## 1. Promise

As a ...

I want ...

So that ...

## 2. Intent Check

### intent-check:{semantic-slug}

- question: {user-intent question}
- evidence: {runtime-output or rendered-dom ref, or unknown until measured}
- why live judge: {why this cannot be reduced to one deterministic Acceptance Check}
- linked acceptance checks:
  - acceptance-check:{semantic-slug}
- answer criteria: {what shallow or misleading answer must fail}

## 3. Acceptance Check

### acceptance-check:{semantic-slug}

- description: {single deterministic contract}
- evidence: {vitest, run:shell, guard, or unknown until propagated}

## 4. Evidence

Verdict starts as `unknown`. Flip to `met` only with production-equivalent evidence:

```yaml
evidence:
  kind: runtime-output | rendered-dom
  ref: <path or artifact ref>
```

If the Intent Check is absorbed into Acceptance Checks, cite the Human Judgment Gate decision in the covering Spec Ledger and `docs/intent-judgments.md`.
