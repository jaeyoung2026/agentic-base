#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const BASELINE_PATH = join(REPO_ROOT, "scripts/mission-control/baselines/alignment-debt.json");
const ALIGNMENT_PREFIXES = ["docs/contracts/story-chain/", "scripts/mission-control/"];
const ALIGNMENT_EXACT = new Set(["docs/contracts/feature-specs.md"]);

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

function affectsAlignment(files) {
  return files.some(
    (file) =>
      ALIGNMENT_EXACT.has(file) || ALIGNMENT_PREFIXES.some((prefix) => file.startsWith(prefix)),
  );
}

function loadSnapshot() {
  const result = spawnSync(
    "node",
    ["scripts/mission-control/mc-validate-story-chain.mjs", "--json"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (!result.stdout) {
    throw new Error(result.stderr || "mc:validate-story-chain produced no JSON");
  }
  return JSON.parse(result.stdout);
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    throw new Error(`Baseline not found at ${BASELINE_PATH}. Run with --update-baseline first.`);
  }
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  return {
    version: parsed.version ?? 1,
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    totalCount: parsed.totalCount ?? 0,
  };
}

function findingSignature(finding) {
  const parts = [finding.category];
  if (finding.storyId) parts.push(`story=${finding.storyId}`);
  if (finding.acId) parts.push(`ac=${finding.acId}`);
  if (finding.specPath) parts.push(`spec=${finding.specPath}`);
  if (finding.command) parts.push(`cmd=${finding.command}`);
  return parts.join("|");
}

function toBaselineEntry(finding) {
  return {
    signature: findingSignature(finding),
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
  };
}

function buildBaseline(findings) {
  const entries = findings
    .map(toBaselineEntry)
    .sort((left, right) => left.signature.localeCompare(right.signature));
  return {
    version: 1,
    entries,
    totalCount: entries.length,
  };
}

function writeBaseline(baseline) {
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
}

function compareWithBaseline(findings, baseline) {
  const baselineBySignature = new Map(baseline.entries.map((entry) => [entry.signature, entry]));
  const currentEntries = findings.map(toBaselineEntry);
  const currentSignatures = new Set(currentEntries.map((entry) => entry.signature));
  const newCriticals = [];
  const newWarnings = [];
  const escalatedCriticals = [];
  let stableCriticals = 0;
  let stableWarnings = 0;

  for (const entry of currentEntries) {
    const baselineEntry = baselineBySignature.get(entry.signature);
    if (!baselineEntry) {
      if (entry.severity === "critical") newCriticals.push(entry);
      else newWarnings.push(entry);
      continue;
    }
    if (entry.severity === "critical" && baselineEntry.severity !== "critical") {
      escalatedCriticals.push({
        ...entry,
        baselineSeverity: baselineEntry.severity,
      });
      continue;
    }
    if (entry.severity === "critical") stableCriticals += 1;
    else stableWarnings += 1;
  }

  const resolved = baseline.entries.filter((entry) => !currentSignatures.has(entry.signature));
  return {
    newCriticals,
    newWarnings,
    escalatedCriticals,
    resolved,
    stableCriticals,
    stableWarnings,
  };
}

function printResult(result, baseline) {
  process.stdout.write("Alignment debt check\n");
  process.stdout.write(`baseline entries: ${baseline.totalCount}\n`);
  process.stdout.write(
    `newCriticals: ${result.newCriticals.length}, escalatedCriticals: ${result.escalatedCriticals.length}, newWarnings: ${result.newWarnings.length}\n`,
  );
  process.stdout.write(
    `stable: ${result.stableCriticals} critical, ${result.stableWarnings} warning\n`,
  );
  if (result.resolved.length > 0) {
    process.stdout.write(
      `resolved: ${result.resolved.length} (run --update-baseline to lock in)\n`,
    );
  }

  for (const bucketName of ["newCriticals", "escalatedCriticals", "newWarnings"]) {
    const entries = result[bucketName];
    if (entries.length === 0) continue;
    process.stdout.write(`\n${bucketName}\n`);
    for (const entry of entries) {
      const suffix = entry.baselineSeverity ? ` (was ${entry.baselineSeverity})` : "";
      process.stdout.write(`  ${entry.signature}${suffix}\n`);
    }
  }

  if (result.newCriticals.length === 0 && result.escalatedCriticals.length === 0) {
    process.stdout.write("\nNo new criticals - clear to proceed.\n");
  }
}

function main() {
  const args = process.argv.slice(2);
  const wantsJson = args.includes("--json");
  const stagedOnly = args.includes("--staged");
  const wantsUpdate = args.includes("--update-baseline");

  if (stagedOnly && !wantsUpdate && !affectsAlignment(getStagedFiles())) {
    const payload = { skipped: true, reason: "no-alignment-staged" };
    if (wantsJson) process.stdout.write(`${JSON.stringify(payload)}\n`);
    else process.stdout.write("mc:check-new-criticals - no staged alignment files. skipping.\n");
    return;
  }

  const snapshot = loadSnapshot();
  if (wantsUpdate) {
    const baseline = buildBaseline(snapshot.findings);
    writeBaseline(baseline);
    if (wantsJson)
      process.stdout.write(`${JSON.stringify({ updated: true, ...baseline }, null, 2)}\n`);
    else process.stdout.write(`Baseline updated: ${baseline.totalCount} entries\n`);
    return;
  }

  const baseline = loadBaseline();
  const result = compareWithBaseline(snapshot.findings, baseline);
  if (wantsJson) {
    process.stdout.write(
      `${JSON.stringify({ ...result, baselineTotalCount: baseline.totalCount }, null, 2)}\n`,
    );
  } else {
    printResult(result, baseline);
  }

  if (result.newCriticals.length > 0 || result.escalatedCriticals.length > 0) {
    process.exitCode = 1;
  }
}

main();
