/**
 * 테스트/프로덕션 LOC 비율 검사.
 * tokei가 설치되어 있으면 사용, 없으면 간이 카운트.
 * 비율이 120%를 초과하면 에러.
 *
 * 참고: https://raw.githubusercontent.com/akngs/s4/refs/heads/main/bins/tloc.sh
 */

import { execSync } from "node:child_process";

const MAX_RATIO = 1.2; // 120%

function countLines(glob) {
  try {
    const result = execSync(`find src -name "${glob}" -exec cat {} + 2>/dev/null | wc -l`, {
      encoding: "utf8",
    });
    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

const prodLines =
  countLines("*.ts") + countLines("*.tsx") - countLines("*.test.*") - countLines("*.spec.*");
const testLines = countLines("*.test.*") + countLines("*.spec.*");

const ratio = prodLines > 0 ? testLines / prodLines : 0;

console.log(
  `[tloc] Production: ${String(prodLines)} lines, Test: ${String(testLines)} lines, Ratio: ${(ratio * 100).toFixed(1)}%`,
);

if (ratio > MAX_RATIO) {
  console.error(
    `[guard:test-ratio] Test/production ratio ${(ratio * 100).toFixed(1)}% exceeds ${String(MAX_RATIO * 100)}% limit.`,
  );
  process.exit(1);
}

console.log("[guard:test-ratio] OK");
