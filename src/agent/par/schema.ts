/**
 * PAR Loop 기본 스키마.
 * Plan → Execute → Audit 파이프라인의 데이터 계약.
 * 프로젝트별 확장은 src/product/policies/에서.
 */

import { z } from "zod";

// ─── Plan 결과 ─────────────────────────────────────────────

export const planResultSchema = z.object({
  narrative: z.string().describe("이번 턴의 핵심 맥락 서사"),
  agency_mode: z.enum(["doing", "suggesting", "asking"]),
  attention_frame: z.object({
    focus: z.string(),
    slots: z.array(
      z.object({
        role: z.string(),
        content: z.string(),
      }),
    ),
  }),
  promises: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      active: z.boolean(),
    }),
  ),
});

export type PlanResult = z.infer<typeof planResultSchema>;

// ─── Audit 결과 ────────────────────────────────────────────

const auditEvidenceSchema = z.object({
  kind: z.enum(["runtime-output", "rendered-dom"]),
  ref: z.string().min(1),
});

export const auditResultSchema = z
  .object({
    violations: z.array(
      z.object({
        promise_id: z.string(),
        description: z.string(),
        severity: z.enum(["error", "warning", "info"]),
      }),
    ),
    verdict: z.enum(["met", "not-met", "unknown"]).default("unknown"),
    evidence: auditEvidenceSchema.optional(),
    gateNotes: z.string().optional(),
  })
  .superRefine((audit, context) => {
    if (audit.verdict === "met" && !audit.evidence) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "met verdict requires production-equivalent evidence",
        path: ["evidence"],
      });
    }
  });

export type AuditResult = z.infer<typeof auditResultSchema>;
