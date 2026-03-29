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
      auditFn: async () => ({ violations: [], passed: true }),
      repairFn: async () => "repaired",
    });

    expect(result.response).toBe("hello");
    expect(result.repaired).toBe(false);
    expect(result.audit.passed).toBe(true);
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
        passed: false,
      }),
      repairFn: async () => "fixed response",
    });

    expect(result.response).toBe("fixed response");
    expect(result.repaired).toBe(true);
    expect(result.audit.passed).toBe(false);
  });
});
