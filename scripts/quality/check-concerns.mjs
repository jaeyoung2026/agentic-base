/**
 * 관심사 중앙화 강제 — 하드코딩된 값이 토큰/상수를 우회하는지 검사.
 *
 * .concern-rules.json에 금지 패턴과 허용 예외를 선언한다.
 * 발견 시 에러로 종료.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const RULES_PATH = resolve(ROOT, ".concern-rules.json");

if (!existsSync(RULES_PATH)) {
  console.log("[guard:concerns] No .concern-rules.json found — skipping.");
  process.exit(0);
}

const rules = JSON.parse(readFileSync(RULES_PATH, "utf8"));
let totalViolations = 0;

for (const rule of rules) {
  const { name, pattern, glob = "*.ts,*.tsx", maxAllowed = 0, excludeFiles = [] } = rule;

  try {
    const includeFlags = glob
      .split(",")
      .map((g) => `--include="${g.trim()}"`)
      .join(" ");

    const escaped = pattern.replace(/"/g, '\\"');
    const result = execSync(`grep -rn "${escaped}" src/ ${includeFlags} || true`, {
      encoding: "utf8",
      cwd: ROOT,
    });

    if (!result.trim()) continue;

    // Filter out excluded files
    const lines = result
      .trim()
      .split("\n")
      .filter((line) => !excludeFiles.some((ex) => line.includes(ex)));

    if (lines.length <= maxAllowed) continue;

    const over = lines.length - maxAllowed;
    console.error(
      `[concern] "${name}" — ${String(lines.length)} found (max ${String(maxAllowed)}):`,
    );
    for (const line of lines) {
      console.error(`  ${line}`);
    }
    console.error("");
    totalViolations += over;
  } catch {
    // grep returns 1 when no match — fine
  }
}

if (totalViolations > 0) {
  console.error(
    `[guard:concerns] ${String(totalViolations)} concern violation(s) detected. Use centralized tokens/constants instead.`,
  );
  process.exit(1);
}

console.log("[guard:concerns] All concerns centralized.");
