import { describe, it, expect } from "vitest";
import { handleTurn, type TurnResult } from "./index";

describe("handleTurn", () => {
  it("returns response when audit passes", async () => {
    const result: TurnResult = await handleTurn({
      planFn: async () => ({
        narrative: "test",
        agency_mode: "doing",
        attention_frame: { focus: "test", slots: [] },
        promises: [],
      }),
      executeFn: async () => "hello",
      auditFn: async () => ({
        violations: [],
        verdict: "met",
        evidence: { kind: "runtime-output", ref: "test-output" },
      }),
      repairFn: async () => "repaired",
    });

    expect(result.response).toBe("hello");
    expect(result.repaired).toBe(false);
    expect(result.audit.verdict).toBe("met");
  });

  it("repairs when audit fails", async () => {
    const result: TurnResult = await handleTurn({
      planFn: async () => ({
        narrative: "test",
        agency_mode: "doing",
        attention_frame: { focus: "test", slots: [] },
        promises: [],
      }),
      executeFn: async () => "bad response",
      auditFn: async () => ({
        violations: [{ promise_id: "p1", description: "violated", severity: "error" }],
        verdict: "not-met",
        gateNotes: "promise p1 violated",
      }),
      repairFn: async () => "fixed response",
    });

    expect(result.response).toBe("fixed response");
    expect(result.repaired).toBe(true);
    expect(result.audit.verdict).toBe("not-met");
  });

  it("repairs when audit verdict is unknown", async () => {
    const result: TurnResult = await handleTurn({
      planFn: async () => ({
        narrative: "test",
        agency_mode: "doing",
        attention_frame: { focus: "test", slots: [] },
        promises: [],
      }),
      executeFn: async () => "unverified response",
      auditFn: async () => ({
        violations: [],
        verdict: "unknown",
        gateNotes: "evidence was not production-equivalent",
      }),
      repairFn: async () => "repaired unknown",
    });

    expect(result.response).toBe("repaired unknown");
    expect(result.repaired).toBe(true);
    expect(result.audit.verdict).toBe("unknown");
  });
});
