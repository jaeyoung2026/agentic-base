---
type: rubric-directory
authority: H
---

# Rubrics — Evaluator Independence

이 디렉토리는 **rubric 정본**이 산다. Sufficiency Review, Intent Check answer-criteria, live judge prompt가 여기서 시작한다.

## 왜 분리하는가 (E authority 실질 독립성)

라이트하우스 운영에서 발견된 약점: agent가 rubric·evidence 선택자·judge 프롬프트를 모두 만지면 **E authority는 형식적 분리에 불과**하다 — agent가 자기 산출물을 자기 기준으로 닫는 self-justifying loop가 가능해진다.

agentic-base는 처음부터 이 우회로를 막는다.

## 규칙

- **이 디렉토리의 모든 파일은 H(Human) authority 전용**이다. agent는 rubric을 작성하거나 수정하지 않는다.
- CODEOWNERS로 강제한다 (`/.github/CODEOWNERS`).
- agent는 rubric을 **읽고 그에 맞춰 구현**할 수만 있다 — rubric의 문구를 손보면 안 된다.
- 새 rubric이 필요하면 agent는 STOP하고 `STATUS: NEEDS_HUMAN`으로 보고한다.

## 파일 형식

```yaml
# rubrics/<promise-slug>.rubric.yaml 또는 .md
id: rubric:<slug>
appliesTo:
  - promise:<slug>
  - aspect:<slug>
liveJudge:
  prompt: |
    <judge가 사용자 의도 충족 여부를 판정할 때 묻는 질문>
  answerCriteria: |
    <met이라 판단하기 위해 답이 만족해야 하는 조건>
  evidence:
    kind: runtime-output | rendered-dom
    sourceHint: <어디서 evidence를 찾는가>
```
