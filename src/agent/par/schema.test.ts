import { describe, expect, it } from "vitest";
import { auditResultSchema } from "./schema";

describe("auditResultSchema", () => {
  it("defaults missing verdict to unknown", () => {
    const parsed = auditResultSchema.parse({ violations: [] });

    expect(parsed.verdict).toBe("unknown");
  });

  it("requires evidence when verdict is met", () => {
    const parsed = auditResultSchema.safeParse({
      violations: [],
      verdict: "met",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts production-equivalent evidence for met verdict", () => {
    const parsed = auditResultSchema.parse({
      violations: [],
      verdict: "met",
      evidence: { kind: "rendered-dom", ref: "dom-dump.html" },
    });

    expect(parsed.evidence?.kind).toBe("rendered-dom");
  });
});
