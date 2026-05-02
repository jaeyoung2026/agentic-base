#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const ALLOWLIST_PATH = join(REPO_ROOT, "scripts/mission-control/surface-allowlist.json");
const TAG_SCAN_LINES = 24;
const TAG_PATTERNS = [
  /^\s*\/\/\s*@promise\s+(promise:[a-z0-9-]+)/,
  /^\s*\/\/\s*@aspect\s+(aspect:[a-z0-9-]+)/,
  /^\s*\/\/\s*@check\s+((?:intent-check|acceptance-check):[a-z0-9-]+)/,
];

function toRepoRelative(absPath) {
  return relative(REPO_ROOT, absPath).replaceAll("\\", "/");
}

function readJson(path) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadAllowlist() {
  const parsed = readJson(ALLOWLIST_PATH);
  return {
    infrastructure: new Set(parsed.infrastructure ?? []),
    backfillBacklog: new Set(parsed.backfillBacklog ?? []),
  };
}

function walkDir(absDir, out) {
  if (!existsSync(absDir)) return;
  for (const name of readdirSync(absDir)) {
    const child = join(absDir, name);
    const info = statSync(child);
    if (info.isDirectory()) {
      walkDir(child, out);
      continue;
    }
    out.push(toRepoRelative(child));
  }
}

function listSurfaceFiles() {
  const files = [];
  walkDir(join(REPO_ROOT, "src/features"), files);
  walkDir(join(REPO_ROOT, "src/app/(workspace)"), files);
  walkDir(join(REPO_ROOT, "src/app/api"), files);
  for (const exact of ["src/app/page.tsx", "src/app/layout.tsx"]) {
    if (existsSync(join(REPO_ROOT, exact))) files.push(exact);
  }

  return [...new Set(files)]
    .filter((path) => /\.(ts|tsx|css)$/.test(path))
    .filter((path) => !/\/__tests__\/|\.test\./.test(path))
    .filter(
      (path) =>
        path.endsWith(".css") ||
        path.endsWith("route.ts") ||
        path.endsWith("page.tsx") ||
        path.endsWith("layout.tsx") ||
        path.startsWith("src/features/") ||
        path.startsWith("src/app/(workspace)/"),
    )
    .sort();
}

function readTags(relPath) {
  if (!/\.(ts|tsx)$/.test(relPath)) return [];
  const source = readFileSync(join(REPO_ROOT, relPath), "utf8");
  const lines = source.split(/\r?\n/).slice(0, TAG_SCAN_LINES);
  const tags = [];
  for (const line of lines) {
    for (const pattern of TAG_PATTERNS) {
      const match = line.match(pattern);
      if (match?.[1]) tags.push(match[1]);
    }
  }
  return tags;
}

function promiseCount() {
  const dir = join(REPO_ROOT, "docs/contracts/story-chain/promises");
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { recursive: true }).filter(
    (entry) => String(entry).endsWith(".md") && !String(entry).endsWith("_TEMPLATE.md"),
  ).length;
}

function classifySurface(path, allowlist, hasPromises) {
  const tags = readTags(path);
  if (tags.length > 0) return { path, classification: "tagged", tags };
  if (allowlist.infrastructure.has(path)) {
    return { path, classification: "infrastructure", tags };
  }
  if (allowlist.backfillBacklog.has(path)) {
    return { path, classification: "backfillBacklog", tags };
  }
  if (!hasPromises) {
    return { path, classification: "backfillBacklog", tags, auto: true };
  }
  return { path, classification: "orphan", tags };
}

function buildReport(entries, promiseTotal) {
  return {
    promiseCount: promiseTotal,
    total: entries.length,
    tagged: entries.filter((entry) => entry.classification === "tagged"),
    infrastructure: entries.filter((entry) => entry.classification === "infrastructure"),
    backfillBacklog: entries.filter((entry) => entry.classification === "backfillBacklog"),
    orphans: entries.filter((entry) => entry.classification === "orphan"),
  };
}

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

function formatReport(report) {
  const lines = [
    `mc:audit-surface - ${report.total} user-facing surface file(s) checked`,
    `  tagged           ${String(report.tagged.length).padStart(3)}`,
    `  infrastructure   ${String(report.infrastructure.length).padStart(3)}`,
    `  backfillBacklog  ${String(report.backfillBacklog.length).padStart(3)} warning until the first promises are backfilled`,
    `  orphan           ${String(report.orphans.length).padStart(3)}`,
  ];

  if (report.backfillBacklog.length > 0) {
    lines.push("");
    lines.push("Backfill backlog");
    for (const entry of report.backfillBacklog) {
      const suffix = entry.auto ? " (auto: no promises yet)" : "";
      lines.push(`  ${entry.path}${suffix}`);
    }
  }

  if (report.orphans.length > 0) {
    lines.push("");
    lines.push("Orphans");
    for (const entry of report.orphans) lines.push(`  ${entry.path}`);
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const wantsJson = args.includes("--json");
  const stagedOnly = args.includes("--staged");
  const allowlist = loadAllowlist();
  const totalPromises = promiseCount();
  const hasPromises = totalPromises > 0;
  const entries = listSurfaceFiles().map((path) => classifySurface(path, allowlist, hasPromises));
  let report = buildReport(entries, totalPromises);

  if (stagedOnly) {
    const staged = new Set(getStagedFiles());
    report = buildReport(
      entries.filter((entry) => staged.has(entry.path)),
      totalPromises,
    );
    if (report.total === 0) {
      const payload = { skipped: true, reason: "no-surface-staged" };
      if (wantsJson) process.stdout.write(`${JSON.stringify(payload)}\n`);
      else process.stdout.write("mc:audit-surface - no staged surface files. skipping.\n");
      return;
    }
  }

  if (wantsJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatReport(report));
  }

  if (report.orphans.length > 0) process.exitCode = 1;
}

main();
