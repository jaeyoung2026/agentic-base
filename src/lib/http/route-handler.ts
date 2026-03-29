/**
 * Route Handler 헬퍼 — Next.js API 라우트의 공통 관심사.
 *
 * 모든 API 라우트에서 반복되는 JSON 파싱, Zod 검증, 에러 포매팅을 통일한다.
 * 이 파일 하나로 라우트 핸들러의 보일러플레이트를 제거한다.
 */

import type { ZodIssue } from "zod";

// ─── 에러 클래스 ─────────────────────────────────────────

export class InvalidJsonBodyError extends Error {
  constructor(cause?: unknown) {
    super("Invalid JSON body");
    this.name = "InvalidJsonBodyError";
    this.cause = cause;
  }
}

// ─── JSON 파싱 ──────────────────────────────────────────

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (cause) {
    throw new InvalidJsonBodyError(cause);
  }
}

// ─── Zod 에러 포매팅 ────────────────────────────────────

export function formatZodIssues(
  issues: ReadonlyArray<Pick<ZodIssue, "path" | "message">>,
): string[] {
  return issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
