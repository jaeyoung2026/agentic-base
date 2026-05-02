---
id: aspect:{semantic-slug}
legacyIds: []
applies-to:
  - promise:{promise-slug}
covering-spec: docs/contracts/story-chain/specs/{spec-name}.spec.md
verdict: unknown
evidence:
gateNotes:
---

# {short title}

## 1. Why

{What user value breaks if this cross-cutting rule is absent?}

## 2. Pointcut

- applies to:
  - promise:{promise-slug}
- excludes:
  - {explicit exclusions, if any}

## 3. Advice

- {rule that must be woven into each pointcut site}

## 4. Verification

- coverage: {how each pointcut site proves it follows the advice}
- wovenness: {where the Promise or Spec Ledger records the advice so it cannot disappear silently}
- verdict: `unknown` until coverage and wovenness evidence exist.
