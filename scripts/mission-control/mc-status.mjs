#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

function runJson(script, args = []) {
  const result = spawnSync("node", [script, "--json", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (!result.stdout) {
    return { ok: false, error: result.stderr || `${script} produced no output` };
  }
  try {
    return { ok: result.status === 0, data: JSON.parse(result.stdout) };
  } catch {
    return { ok: false, error: result.stdout };
  }
}

function statusFor(findings, categories) {
  const scoped = findings.filter((finding) => categories.has(finding.category));
  if (scoped.some((finding) => finding.severity === "critical")) return "blocked";
  if (scoped.length > 0) return "warning";
  return "green";
}

function detailFor(findings, categories) {
  const scoped = findings.filter((finding) => categories.has(finding.category));
  if (scoped.length === 0) return "clean";
  const critical = scoped.filter((finding) => finding.severity === "critical").length;
  const warning = scoped.length - critical;
  return `${critical} critical, ${warning} warning`;
}

const AC_CATEGORIES = new Set([
  "missing_ac_ledger",
  "stale_ac_reference",
  "missing_scenario_reference",
  "missing_spec_file",
  "coverage_ledger_mismatch",
  "missing_coverage_section",
  "missing_run_shell",
]);
const CODE_CATEGORIES = new Set(["missing_execution_target", "missing_code_trace"]);
const ASPECT_CATEGORIES = new Set([
  "pol_aspect_unverified",
  "pol_aspect_not_met",
  "pol_aspect_unknown",
]);
const INTENT_CATEGORIES = new Set([
  "invalid_sufficiency_verdict",
  "met_missing_production_evidence",
]);

function formatRelease(validate) {
  const findings = validate.findings ?? [];
  const summary = validate.summary ?? {};
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const suffix = validate.skipped ? " (skeleton)" : "";
  return [
    "Release verdict",
    `  Intent verdict: ${statusFor(findings, INTENT_CATEGORIES).padEnd(12)} (${summary.intentMet ?? 0}/${summary.intentEntries ?? 0} met)`,
    `  AC trace:       ${statusFor(findings, AC_CATEGORIES).padEnd(12)} (${detailFor(findings, AC_CATEGORIES)})`,
    `  Code trace:     ${statusFor(findings, CODE_CATEGORIES).padEnd(12)} (${detailFor(findings, CODE_CATEGORIES)})`,
    `  Aspect:         ${statusFor(findings, ASPECT_CATEGORIES).padEnd(12)} (${summary.aspectMet ?? 0}/${summary.aspectCount ?? 0} met)`,
    `Release: ${criticalCount === 0 ? "ready" : "blocked"}${suffix}`,
  ].join("\n");
}

function main() {
  const wantsJson = process.argv.includes("--json");
  const validate = runJson("scripts/mission-control/mc-validate-story-chain.mjs");
  const baseline = runJson("scripts/mission-control/mc-check-new-criticals.mjs");
  const surface = runJson("scripts/mission-control/mc-audit-surface.mjs");

  if (wantsJson) {
    process.stdout.write(`${JSON.stringify({ validate, baseline, surface }, null, 2)}\n`);
    return;
  }

  if (!validate.ok && !validate.data) {
    process.stdout.write(`mc:status - validator unavailable\n${validate.error}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${formatRelease(validate.data)}\n`);

  if (baseline.data) {
    process.stdout.write(
      `Baseline: newCriticals=${baseline.data.newCriticals?.length ?? 0}, escalatedCriticals=${baseline.data.escalatedCriticals?.length ?? 0}, newWarnings=${baseline.data.newWarnings?.length ?? 0}\n`,
    );
  } else if (baseline.error) {
    process.stdout.write(`Baseline: unavailable (${baseline.error.trim()})\n`);
  }

  if (surface.data) {
    process.stdout.write(
      `Surface audit: orphan=${surface.data.orphans?.length ?? 0}, backfillBacklog=${surface.data.backfillBacklog?.length ?? 0}, tagged=${surface.data.tagged?.length ?? 0}\n`,
    );
  } else if (surface.error) {
    process.stdout.write(`Surface audit: unavailable (${surface.error.trim()})\n`);
  }

  if (
    baseline.data &&
    ((baseline.data.newCriticals?.length ?? 0) > 0 ||
      (baseline.data.escalatedCriticals?.length ?? 0) > 0)
  ) {
    process.exitCode = 1;
  }
  if (surface.data && (surface.data.orphans?.length ?? 0) > 0) {
    process.exitCode = 1;
  }
}

main();
