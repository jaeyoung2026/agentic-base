---
type: evidence-directory
authority: runtime (auto-generated)
---

# Evidence — Production-Equivalent Outputs

이 디렉토리는 **production runtime이 직접 만든 evidence**가 산다. live judge가 verdict를 내릴 때 참조하는 입력.

## 왜 자동 생성만 허용하는가 (E authority 실질 독립성)

evidence를 agent가 자유롭게 작성·수정할 수 있으면 "production-equivalent"라는 표시는 의미를 잃는다. 실제 runtime이 찍은 출력이 아니라 agent가 그럴듯하게 합성한 출력이 들어가는 순간, `met` verdict는 거짓말이 된다.

agentic-base는 evidence를 **runtime artifact로만** 받는다.

## 규칙

- **이 디렉토리의 파일은 production runtime(또는 production-equivalent test runner)이 자동 생성한다.**
- agent는 evidence 파일을 직접 작성·수정하지 않는다.
- evidence 산출 경로는 코드(orchestrator, route handler, test harness)에서 명시적으로 만든다.
- 모든 evidence 파일은 `.gitignore`로 commit에서 제외된다 — repo의 진실은 코드와 rubric, evidence는 runtime의 진실이다.

## 파일 명명

```
docs/contracts/story-chain/evidence/<promise-slug>/<timestamp>.<kind>.json
```

예:

- `evidence/onboarding/2026-05-02T21-00.runtime-output.json`
- `evidence/onboarding/2026-05-02T21-05.rendered-dom.html`

## live judge 입력 흐름

1. runtime이 사용자 인터랙션 또는 production-equivalent test에서 evidence 자동 저장
2. live judge가 rubric을 읽고 evidence를 입력으로 받아 verdict 산출
3. Sufficiency Review entry에 verdict + evidence ref 기록
4. validator가 met 선언 시 evidence ref가 `runtime-output|rendered-dom`인지 검사
