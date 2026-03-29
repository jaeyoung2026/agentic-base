/**
 * Orchestrator — plan → execute → audit 파이프라인.
 * PAR 폐루프: audit 실패 시 재계획 또는 fallback.
 */

import type { PlanResult, AuditResult } from "@/agent/par/schema";

export interface TurnResult {
  plan: PlanResult;
  response: string;
  audit: AuditResult;
  repaired: boolean;
}

/**
 * 턴 처리 골격.
 * 비즈니스 로직(plan 함수, execute 함수, audit 함수)은 외부에서 주입.
 */
export async function handleTurn(deps: {
  planFn: () => Promise<PlanResult>;
  executeFn: (plan: PlanResult) => Promise<string>;
  auditFn: (plan: PlanResult, response: string) => Promise<AuditResult>;
  repairFn: (plan: PlanResult, audit: AuditResult) => Promise<string>;
  signal?: AbortSignal;
}): Promise<TurnResult> {
  const plan = await deps.planFn();
  const response = await deps.executeFn(plan);
  const audit = await deps.auditFn(plan, response);

  // 폐루프: audit 실패 시 repair
  if (!audit.passed) {
    const repaired = await deps.repairFn(plan, audit);
    return { plan, response: repaired, audit, repaired: true };
  }

  return { plan, response, audit, repaired: false };
}
