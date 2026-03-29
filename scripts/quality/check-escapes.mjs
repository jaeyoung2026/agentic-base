/**
 * 탈출구 차단 — eslint-disable, any, @ts-ignore 등을 코드에서 검색.
 * 발견 시 에러로 종료.
 */

import { execSync } from "node:child_process";

const PATTERNS = [
  "eslint-disable",
  "@ts-ignore",
  "@ts-expect-error",
  "@ts-nocheck",
  "as any",
  ": any",
];

let found = 0;

for (const pattern of PATTERNS) {
  try {
    const result = execSync(
      `grep -rn "${pattern}" src/ --include="*.ts" --include="*.tsx" || true`,
      { encoding: "utf8" },
    );
    if (result.trim()) {
      console.error(`[escape] "${pattern}" found:\n${result}`);
      found++;
    }
  } catch {
    // grep returns 1 when no match — that's fine
  }
}

if (found > 0) {
  console.error(
    `\n[guard:escapes] ${String(found)} escape pattern(s) detected. Fix before committing.`,
  );
  process.exit(1);
}

console.log("[guard:escapes] No escape patterns found.");
