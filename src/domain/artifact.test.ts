import { describe, it, expect } from "vitest";
import { artifactSchema } from "./artifact-schema";

describe("artifactSchema", () => {
  it("validates a minimal artifact", () => {
    const result = artifactSchema.safeParse({
      id: "test-1",
      type: "discussion",
      title: "Test",
      content: "",
      createdBy: "user",
      metadata: { type: "discussion" },
      refs: [],
      conversationId: "conv-1",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = artifactSchema.safeParse({
      id: "test-1",
      type: "invalid",
      title: "Test",
      content: "",
      createdBy: "user",
      metadata: { type: "discussion" },
      refs: [],
      conversationId: "conv-1",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});
