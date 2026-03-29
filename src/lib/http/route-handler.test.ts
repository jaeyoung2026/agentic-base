import { describe, it, expect } from "vitest";
import { InvalidJsonBodyError, parseJsonBody, formatZodIssues } from "./route-handler";

describe("parseJsonBody", () => {
  it("parses valid JSON", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseJsonBody(request);
    expect(result).toEqual({ name: "test" });
  });

  it("throws InvalidJsonBodyError for invalid JSON", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    await expect(parseJsonBody(request)).rejects.toThrow(InvalidJsonBodyError);
  });
});

describe("formatZodIssues", () => {
  it("formats issues with path", () => {
    const issues = [{ path: ["metadata", "type"], message: "Required" }];
    expect(formatZodIssues(issues)).toEqual(["metadata.type: Required"]);
  });

  it("formats issues without path", () => {
    const issues = [{ path: [], message: "Invalid input" }];
    expect(formatZodIssues(issues)).toEqual(["Invalid input"]);
  });
});
