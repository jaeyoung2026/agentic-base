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

import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
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
 * Markdown table separator line(`| --- | --- |`, `|:---:|---:|` 등) 식별.
 * cell이 모두 dash + optional colon + whitespace로만 구성됐는지 본다.
 */
function isTableSeparator(line) {
  return /^\|(\s*:?-+:?\s*\|)+\s*$/.test(line);
}

/**
 * 섹션 안의 table에 row를 append한다.
 * separator 라인을 명시적으로 식별해 header-only table에서도 안전하게 동작한다.
 *
 * 동작:
 *   1. 섹션 안의 separator 라인을 찾는다 (없으면 null 반환).
 *   2. separator 이후 마지막 data row 다음 위치에 append.
 *   3. data row가 없으면(header-only) separator 바로 다음에 append.
 *
 * 한 섹션에 separator가 여러 개면 _마지막_ separator 기준으로 append.
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
  let separatorIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (isTableSeparator(lines[i])) separatorIdx = i;
  }
  if (separatorIdx === -1) return null;

  let lastDataRowIdx = -1;
  for (let i = separatorIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("|")) continue;
    if (isTableSeparator(line)) continue;
    lastDataRowIdx = i;
  }

  const insertIdx = lastDataRowIdx >= 0 ? lastDataRowIdx + 1 : separatorIdx + 1;
  const updated = [...lines];
  updated.splice(insertIdx, 0, ...newRowLines);
  const newBody = updated.join("\n");
  return content.slice(0, sectionStart) + newBody + content.slice(sectionEnd);
}

/**
 * read-modify-write race를 줄인다.
 *  - read 시점의 mtime을 기억
 *  - write 직전에 mtime이 그대로인지 재확인
 *  - tmp 파일에 쓰고 rename으로 atomic 교체
 */
function readWithMtime(absPath) {
  const content = readFileSync(absPath, "utf8");
  const mtimeMs = statSync(absPath).mtimeMs;
  return { content, mtimeMs };
}

function atomicWriteIfUnchanged(absPath, expectedMtimeMs, newContent) {
  if (existsSync(absPath)) {
    const currentMtime = statSync(absPath).mtimeMs;
    if (currentMtime !== expectedMtimeMs) {
      fail(
        `${absPath} was modified by another process between read and write.`,
        "Re-run mc:propagate after reviewing the new state.",
      );
    }
  }
  const tmpPath = `${absPath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmpPath, newContent, "utf8");
  renameSync(tmpPath, absPath);
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

  const featureSpecsAbs = repoPath(FEATURE_SPECS_PATH);
  const featureSpecsRead = existsSync(featureSpecsAbs)
    ? readWithMtime(featureSpecsAbs)
    : { content: "", mtimeMs: 0 };
  const featureSpecsContent = featureSpecsRead.content;
  const existingLedger = existingLedgerKeys(featureSpecsContent);

  const ledgerRowsToAdd = [];
  for (const ac of acs) {
    if (!existingLedger.has(ledgerKey(id, ac))) {
      ledgerRowsToAdd.push(`| ${id} | ${ac} | ${coveringSpecs[0]} | (pending) |`);
    }
  }

  const coverageActions = [];
  for (const specRel of coveringSpecs) {
    const specAbs = repoPath(specRel);
    if (!existsSync(specAbs)) {
      coverageActions.push({ specRel, status: "missing", rows: [] });
      continue;
    }
    const { content: specContent, mtimeMs } = readWithMtime(specAbs);
    const existing = existingCoverageKeys(specContent);
    const rowsToAdd = [];
    for (const ac of acs) {
      if (!existing.has(ledgerKey(id, ac))) {
        rowsToAdd.push(`| ${id} | ${ac} | (pending) |`);
      }
    }
    coverageActions.push({
      specRel,
      specAbs,
      mtimeMs,
      content: specContent,
      status: "exists",
      rows: rowsToAdd,
    });
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
    atomicWriteIfUnchanged(featureSpecsAbs, featureSpecsRead.mtimeMs, updated);
    process.stdout.write(`\napplied: ${FEATURE_SPECS_PATH} +${ledgerRowsToAdd.length} row(s)\n`);
  }

  for (const action of coverageActions) {
    if (action.status !== "exists" || action.rows.length === 0) continue;
    const updated = appendRowsToSectionTable(action.content, "Coverage By Story", action.rows);
    if (updated === null) {
      fail(
        `${action.specRel} has no Coverage By Story table header.`,
        "Add a markdown table with headers `| Promise | Acceptance Check | Evidence |` under `## Coverage By Story`, then re-run.",
      );
    }
    atomicWriteIfUnchanged(action.specAbs, action.mtimeMs, updated);
    process.stdout.write(`applied: ${action.specRel} +${action.rows.length} row(s)\n`);
  }
}

main();
