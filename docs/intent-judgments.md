# Intent Judgments

Human Judgment Gate decision ledger다. 이 파일은 append-only다. Intent Check를 Acceptance Check로 흡수하거나, 부분 흡수하거나, 철회할 때 H authority의 결정을 여기에 기록한다.

## Entry Format

```markdown
### HJG-YYYY-MM-DD-{decision-slug}

- Decision: absorbed | partial | rejected | retired
- Promise refs:
  - promise:{promise-slug}
- Legacy refs:
  - {optional legacy ID}
- Rationale: {why Human accepted this intent treatment}
- Acceptance coverage:
  - acceptance-check:{semantic-slug}
- Evidence: {conversation, issue, PR, or review ref}
```

Intent-absorbed Spec Ledger subtype은 frontmatter에 아래 ref를 가져야 한다.

```yaml
intentJudgmentRefs:
  - promise:{promise-slug} -> HJG-YYYY-MM-DD-{decision-slug}
```

## Decisions
