#!/usr/bin/env node

/**
 * mc:propagate — Promise의 acceptance check를 ledger와 spec coverage로 전파한다.
 *
 * 사용법:
 *   node scripts/mission-control/mc-propagate.mjs <promise-id> [--apply]
 *
 * 기본은 dry-run — 추가될 markdown row를 출력만 한다.
 * `--apply`를 붙이면 실제로 feature-specs.md와 covering spec의 table에 row를 append한다.
 *
 * 안전 가드:
 *   - 대상 섹션(`## Acceptance Check Ledger`, `## Coverage By Story`)에 table 헤더가
 *     이미 있어야 한다. 없으면 STATUS: NEEDS_HUMAN으로 멈춘다 (사람이 첫 table을 만든다).
 *   - 이미 존재하는 (promiseId, acId) 조합은 건너뛴다.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseMarkdown, getFrontmatter, getSection, getTableRows } from "./lib/markdown-ast.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const PROMISES_DIR = "docs/contracts/story-chain/promises";
const FEATURE_SPECS_PATH = "docs/contracts/feature-specs.md";

function fail(message, recommendation) {
  process.stderr.write(`STATUS: NEEDS_HUMAN\nROW: mc:propagate\nWHY: ${message}\n`);
  if (recommendation) process.stderr.write(`RECOMMENDATION: ${recommendation}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      options[arg.slice(2)] = true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, options };
}

function repoPath(...parts) {
  return join(REPO_ROOT, ...parts);
}

function findPromiseFile(idOrSlug) {
  const slug = idOrSlug.replace(/^promise:/, "");
  const path = `${PROMISES_DIR}/${slug}.md`;
  if (!existsSync(repoPath(path))) {
    fail(`Promise file not found: ${path}`, `Run mc:add-promise <slug> first.`);
  }
  return path;
}

function ledgerKey(promiseId, acId) {
  return `${promiseId.replace(/`/g, "").trim()}|${acId.replace(/`/g, "").trim()}`;
}

function existingLedgerKeys(content) {
  const ast = parseMarkdown(content);
  const rows = getTableRows(getSection(ast, 2, "Acceptance Check Ledger"));
  return new Set(
    rows
      .map((row) => {
        const promiseId = row.promise ?? row.story ?? row.us ?? "";
        const acId = row["acceptance check"] ?? row["acceptance criterion"] ?? row.ac ?? "";
        if (!promiseId || !acId) return null;
        return ledgerKey(promiseId, acId);
      })
      .filter(Boolean),
  );
}

function existingCoverageKeys(content) {
  const ast = parseMarkdown(content);
  const rows = getTableRows(getSection(ast, 2, "Coverage By Story"));
  return new Set(
    rows
      .map((row) => {
        const promiseId = row.promise ?? row.story ?? row.us ?? "";
        const acId = row["acceptance check"] ?? row["acceptance criterion"] ?? row.ac ?? "";
        if (!promiseId || !acId) return null;
        return ledgerKey(promiseId, acId);
      })
      .filter(Boolean),
  );
}

/**
 * 섹션 안의 table에 row를 append한다.
 * 단순 string manipulation — table 헤더가 이미 있어야 한다.
 * 헤더가 없으면 null을 반환해 호출자가 STATUS: NEEDS_HUMAN으로 안내한다.
 */
function appendRowsToSectionTable(content, sectionHeading, newRowLines) {
  const headingPattern = new RegExp(`^##\\s+${sectionHeading}\\s*$`, "m");
  const headingMatch = headingPattern.exec(content);
  if (!headingMatch) return null;

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const restAfterHeading = content.slice(sectionStart);
  const nextHeadingMatch = /^##\s+/m.exec(restAfterHeading);
  const sectionEnd = nextHeadingMatch ? sectionStart + nextHeadingMatch.index : content.length;
  const sectionBody = content.slice(sectionStart, sectionEnd);

  const lines = sectionBody.split("\n");
  let lastTableRowIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith("|") && !/^\|\s*-+\s*\|/.test(lines[i])) {
      lastTableRowIdx = i;
    }
  }
  if (lastTableRowIdx === -1) return null; // table 헤더 없음

  const updated = [...lines];
  updated.splice(lastTableRowIdx + 1, 0, ...newRowLines);
  const newBody = updated.join("\n");
  return content.slice(0, sectionStart) + newBody + content.slice(sectionEnd);
}

function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const promiseId = positional[0];
  if (!promiseId) fail("Missing <promise-id>");

  const apply = options.apply === true;
  const promiseRelPath = findPromiseFile(promiseId);
  const promiseAst = parseMarkdown(readFileSync(repoPath(promiseRelPath), "utf8"));
  const frontmatter = getFrontmatter(promiseAst);

  const id = typeof frontmatter.id === "string" ? frontmatter.id.trim() : promiseId;
  const acs = Array.isArray(frontmatter.acceptanceChecks)
    ? frontmatter.acceptanceChecks.filter((entry) => typeof entry === "string")
    : [];
  const coveringSpecs = Array.isArray(frontmatter.coveringSpecs)
    ? frontmatter.coveringSpecs.filter((entry) => typeof entry === "string")
    : [];

  if (acs.length === 0) fail(`${id} has no acceptanceChecks in frontmatter`);
  if (coveringSpecs.length === 0) fail(`${id} has no coveringSpecs in frontmatter`);

  const featureSpecsContent = existsSync(repoPath(FEATURE_SPECS_PATH))
    ? readFileSync(repoPath(FEATURE_SPECS_PATH), "utf8")
    : "";
  const existingLedger = existingLedgerKeys(featureSpecsContent);

  const ledgerRowsToAdd = [];
  for (const ac of acs) {
    if (!existingLedger.has(ledgerKey(id, ac))) {
      ledgerRowsToAdd.push(`| ${id} | ${ac} | ${coveringSpecs[0]} | (pending) |`);
    }
  }

  const coverageActions = [];
  for (const specRel of coveringSpecs) {
    if (!existsSync(repoPath(specRel))) {
      coverageActions.push({ specRel, status: "missing", rows: [] });
      continue;
    }
    const specContent = readFileSync(repoPath(specRel), "utf8");
    const existing = existingCoverageKeys(specContent);
    const rowsToAdd = [];
    for (const ac of acs) {
      if (!existing.has(ledgerKey(id, ac))) {
        rowsToAdd.push(`| ${id} | ${ac} | (pending) |`);
      }
    }
    coverageActions.push({ specRel, status: "exists", rows: rowsToAdd });
  }

  process.stdout.write(`mc:propagate - ${id}\n`);
  process.stdout.write(`  acceptance checks: ${acs.length}\n`);
  process.stdout.write(`  covering specs:    ${coveringSpecs.length}\n\n`);

  process.stdout.write("Proposed changes\n");
  if (ledgerRowsToAdd.length === 0) {
    process.stdout.write(`  ${FEATURE_SPECS_PATH} Acceptance Check Ledger: clean\n`);
  } else {
    process.stdout.write(
      `  ${FEATURE_SPECS_PATH} Acceptance Check Ledger: +${ledgerRowsToAdd.length} row(s)\n`,
    );
    for (const row of ledgerRowsToAdd) process.stdout.write(`    ${row}\n`);
  }
  for (const action of coverageActions) {
    if (action.status === "missing") {
      process.stdout.write(`  ${action.specRel}: MISSING spec file\n`);
    } else if (action.rows.length === 0) {
      process.stdout.write(`  ${action.specRel} Coverage By Story: clean\n`);
    } else {
      process.stdout.write(
        `  ${action.specRel} Coverage By Story: +${action.rows.length} row(s)\n`,
      );
      for (const row of action.rows) process.stdout.write(`    ${row}\n`);
    }
  }

  if (!apply) {
    process.stdout.write("\nDry-run. Run with --apply to write changes.\n");
    return;
  }

  // ── apply phase ─────────────────────────────────────
  if (ledgerRowsToAdd.length > 0) {
    const updated = appendRowsToSectionTable(
      featureSpecsContent,
      "Acceptance Check Ledger",
      ledgerRowsToAdd,
    );
    if (updated === null) {
      fail(
        `${FEATURE_SPECS_PATH} has no Acceptance Check Ledger table header.`,
        "Add a markdown table with headers `| Promise | Acceptance Check | Covering Spec | Evidence |` under `## Acceptance Check Ledger`, then re-run.",
      );
    }
    writeFileSync(repoPath(FEATURE_SPECS_PATH), updated, "utf8");
    process.stdout.write(`\napplied: ${FEATURE_SPECS_PATH} +${ledgerRowsToAdd.length} row(s)\n`);
  }

  for (const action of coverageActions) {
    if (action.status !== "exists" || action.rows.length === 0) continue;
    const specContent = readFileSync(repoPath(action.specRel), "utf8");
    const updated = appendRowsToSectionTable(specContent, "Coverage By Story", action.rows);
    if (updated === null) {
      fail(
        `${action.specRel} has no Coverage By Story table header.`,
        "Add a markdown table with headers `| Promise | Acceptance Check | Evidence |` under `## Coverage By Story`, then re-run.",
      );
    }
    writeFileSync(repoPath(action.specRel), updated, "utf8");
    process.stdout.write(`applied: ${action.specRel} +${action.rows.length} row(s)\n`);
  }
}

main();
