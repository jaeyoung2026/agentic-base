#!/usr/bin/env node

/**
 * mc:staged-path-guard — E authority isolation의 로컬 강제.
 *
 * CODEOWNERS는 GitHub branch protection이 없으면 강제력이 약하다.
 * pre-commit 시점에 staged 파일 중 다음을 차단한다:
 *
 *   - docs/contracts/story-chain/rubrics/ 변경 (H authority 전용)
 *   - docs/contracts/story-chain/evidence/ 강제 add (runtime 자동 생성 영역)
 *
 * .gitkeep, README.md는 예외 — 디렉토리 메타이므로 허용.
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const RUBRICS_PREFIX = "docs/contracts/story-chain/rubrics/";
const EVIDENCE_PREFIX = "docs/contracts/story-chain/evidence/";
const META_FILES = new Set([".gitkeep", "README.md"]);

function getStagedFiles() {
  const result = spawnSync("git", ["diff", "--cached", "--name-only"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isMetaFile(path) {
  const name = path.split("/").at(-1) ?? "";
  return META_FILES.has(name);
}

function main() {
  const violations = [];
  for (const path of getStagedFiles()) {
    if (path.startsWith(RUBRICS_PREFIX) && !isMetaFile(path)) {
      violations.push({
        path,
        reason: `rubrics/ is H authority. Agent must not commit changes here. (See AGENTS.md ## E Authority Isolation)`,
      });
    }
    if (path.startsWith(EVIDENCE_PREFIX) && !isMetaFile(path)) {
      violations.push({
        path,
        reason: `evidence/ is runtime-only. Production runtime auto-generates evidence; agent must not commit. (See .gitignore + AGENTS.md ## E Authority Isolation)`,
      });
    }
  }

  if (violations.length === 0) {
    process.stdout.write("mc:staged-path-guard - clear\n");
    return;
  }

  process.stderr.write("STATUS: NEEDS_HUMAN\n");
  process.stderr.write("ROW: mc:staged-path-guard\n");
  process.stderr.write(`WHY: ${violations.length} staged path(s) violate E authority isolation\n`);
  for (const violation of violations) {
    process.stderr.write(`  ${violation.path} — ${violation.reason}\n`);
  }
  process.stderr.write(
    "RECOMMENDATION: unstage with `git reset HEAD <path>`. If this change is genuinely human-authored, ask the H owner to commit instead.\n",
  );
  process.exit(1);
}

main();
