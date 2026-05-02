#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseMarkdown,
  getFrontmatter,
  getSection,
  hasSection,
  getSubsections,
  getTableRows,
  getRunShellBlocks,
  collectInlineCode,
  extractKeyValues,
  nodeToString,
} from "./lib/markdown-ast.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const STORY_CHAIN_DIR = "docs/contracts/story-chain";
const PROMISES_DIR = `${STORY_CHAIN_DIR}/promises`;
const ASPECTS_DIR = `${STORY_CHAIN_DIR}/aspects`;
const SPECS_DIR = `${STORY_CHAIN_DIR}/specs`;
const FEATURE_SPECS_PATH = "docs/contracts/feature-specs.md";
const STAGED_TRIGGERS = [`${STORY_CHAIN_DIR}/`, FEATURE_SPECS_PATH, "scripts/mission-control/"];

const LONGITUDINAL_AC_CATEGORIES = new Set([
  "missing_ac_ledger",
  "stale_ac_reference",
  "missing_scenario_reference",
  "missing_spec_file",
  "coverage_ledger_mismatch",
  "missing_coverage_section",
  "missing_run_shell",
]);
const CODE_TRACE_CATEGORIES = new Set(["missing_execution_target", "missing_code_trace"]);
const ASPECT_CATEGORIES = new Set([
  "pol_aspect_unverified",
  "pol_aspect_not_met",
  "pol_aspect_unknown",
]);
const INTENT_CATEGORIES = new Set([
  "invalid_sufficiency_verdict",
  "met_missing_production_evidence",
  "missing_intent_judgment_ref",
  "absorbed_promise_missing_acceptance_check",
  "invalid_intent_judgment_ref",
]);

const INTENT_JUDGMENTS_PATH = "docs/intent-judgments.md";

function repoPath(...parts) {
  return join(REPO_ROOT, ...parts);
}

function toRepoRelative(absPath) {
  return relative(REPO_ROOT, absPath).replaceAll("\\", "/");
}

function readText(relPath) {
  return readFileSync(repoPath(relPath), "utf8");
}

function readAst(relPath) {
  return parseMarkdown(readText(relPath));
}

function walkFiles(relDir, predicate) {
  const absDir = repoPath(relDir);
  const files = [];
  if (!existsSync(absDir)) return files;
  function walk(absPath) {
    for (const name of readdirSync(absPath)) {
      const child = join(absPath, name);
      const info = statSync(child);
      if (info.isDirectory()) {
        walk(child);
        continue;
      }
      const relPath = toRepoRelative(child);
      if (predicate(relPath)) files.push(relPath);
    }
  }
  walk(absDir);
  return files.sort();
}

function listPromisePaths() {
  return walkFiles(PROMISES_DIR, (path) => path.endsWith(".md") && !path.endsWith("/_TEMPLATE.md"));
}
function listAspectPaths() {
  return walkFiles(ASPECTS_DIR, (path) => path.endsWith(".md") && !path.endsWith("/_TEMPLATE.md"));
}
function listSpecPaths() {
  return walkFiles(
    SPECS_DIR,
    (path) => path.endsWith(".spec.md") && !path.endsWith("/_TEMPLATE.spec.md"),
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectIds(value, pattern) {
  return unique([...String(value ?? "").matchAll(pattern)].map((match) => match[1]));
}

function cell(row, names) {
  for (const name of names) {
    const value = row[name.toLowerCase()];
    if (value) return value.replace(/`/g, "").trim();
  }
  return "";
}

function normalizeSpecPath(value) {
  const clean = value.replace(/`/g, "").trim();
  if (clean.startsWith(`${SPECS_DIR}/`)) return clean;
  if (clean.startsWith("docs/contracts/specs/")) {
    return `${SPECS_DIR}/${clean.split("/").at(-1)}`;
  }
  if (clean.startsWith("specs/")) {
    return `${SPECS_DIR}/${clean.slice("specs/".length)}`;
  }
  if (clean.endsWith(".spec.md")) return `${SPECS_DIR}/${clean}`;
  return clean;
}

function extractSpecPaths(value) {
  return unique(
    collectIds(
      value,
      /`?((?:docs\/contracts\/story-chain\/specs\/|docs\/contracts\/specs\/|specs\/)?[A-Za-z0-9._/-]+\.spec\.md)`?/g,
    ).map(normalizeSpecPath),
  );
}

function extractScenarioIds(value) {
  return unique([
    ...collectIds(value, /\b(SC-[A-Z0-9-]+)\b/g),
    ...collectIds(value, /\b(scenario:[a-z0-9-]+)\b/g),
  ]);
}

function extractPromiseIds(value) {
  return unique([
    ...collectIds(value, /\b(promise:[a-z0-9-]+)\b/g),
    ...collectIds(value, /\b(US-[A-Z0-9-]+)\b/g),
  ]);
}

function extractAcceptanceCheckIds(value) {
  return unique([
    ...collectIds(value, /\b(acceptance-check:[a-z0-9-]+)\b/g),
    ...collectIds(value, /\b(AC\d+)\b/g),
  ]);
}

function parsePromise(path) {
  const ast = readAst(path);
  const frontmatter = getFrontmatter(ast);
  const id =
    typeof frontmatter.id === "string" && frontmatter.id.trim()
      ? frontmatter.id.trim()
      : `promise:${path.replace(/^.*\/|\.md$/g, "")}`;

  const frontmatterChecks = Array.isArray(frontmatter.acceptanceChecks)
    ? frontmatter.acceptanceChecks.filter((entry) => typeof entry === "string")
    : [];

  const headingChecks = ast.children
    .filter((node) => node.type === "heading" && node.depth === 3)
    .map((node) => nodeToString(node))
    .flatMap((text) => collectIds(text, /\b(acceptance-check:[a-z0-9-]+|AC\d+)\b/g));

  return {
    id,
    path,
    acceptanceChecks: unique([...frontmatterChecks, ...headingChecks]),
  };
}

function parseFeatureSpecs() {
  if (!existsSync(repoPath(FEATURE_SPECS_PATH))) {
    return { ledgerRows: [], scenarioIds: new Set() };
  }
  const ast = readAst(FEATURE_SPECS_PATH);
  const ledgerNodes = getSection(ast, 2, "Acceptance Check Ledger");
  const scenarioNodes = getSection(ast, 2, "Scenario Catalog");

  const ledgerRows = getTableRows(ledgerNodes).flatMap((row) => {
    const promiseId = cell(row, ["promise", "story", "us"]);
    const acId = cell(row, ["acceptance check", "acceptance criterion", "ac"]);
    if (!promiseId || !acId) return [];
    const specCell = cell(row, ["covering spec ledger", "covering spec", "spec", "evidence"]);
    const evidenceCell = cell(row, ["evidence"]);
    const traceCell = `${specCell} ${evidenceCell}`;
    return {
      promiseId,
      acId,
      specPaths: extractSpecPaths(traceCell),
      scenarioIds: extractScenarioIds(traceCell),
    };
  });

  const scenarioIds = new Set(
    getTableRows(scenarioNodes)
      .flatMap((row) => extractScenarioIds(cell(row, ["scenario", "sc"])))
      .filter(Boolean),
  );

  return { ledgerRows, scenarioIds };
}

function parseCoverageEntries(ast) {
  const sectionNodes = getSection(ast, 2, "Coverage By Story");
  if (sectionNodes.length === 0) return [];

  const tableEntries = getTableRows(sectionNodes).flatMap((row) => {
    const promiseIds = extractPromiseIds(cell(row, ["promise", "story", "us"]));
    const acIds = extractAcceptanceCheckIds(
      cell(row, ["acceptance check", "acceptance criterion", "ac"]),
    );
    return promiseIds.flatMap((promiseId) => acIds.map((acId) => ({ promiseId, acId })));
  });

  const inlineEntries = collectInlineCode(sectionNodes).flatMap((value) => {
    const promiseIds = extractPromiseIds(value);
    const acIds = extractAcceptanceCheckIds(value);
    return promiseIds.flatMap((promiseId) => acIds.map((acId) => ({ promiseId, acId })));
  });

  return unique(
    [...tableEntries, ...inlineEntries].map((entry) => `${entry.promiseId}|${entry.acId}`),
  ).map((key) => {
    const [promiseId, acId] = key.split("|");
    return { promiseId, acId };
  });
}

function extractExecutionTargets(command) {
  const targets = [];
  const pattern =
    /(?:^|\s|["'`])((?:src|scripts|specs|docs)\/[^\s"'`]+?\.(?:ts|tsx|js|jsx|mjs|cjs|md))/g;
  let match;
  while ((match = pattern.exec(command)) !== null) {
    const target = (match[1] ?? "").replace(/[),;]+$/g, "");
    if (target) targets.push(target);
  }
  return unique(targets);
}

function resolveTarget(target) {
  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.js`,
    `${target}.jsx`,
    target.endsWith(".ts") ? `${target.slice(0, -3)}.tsx` : "",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(repoPath(candidate))) ?? target;
}

function tryResolveImport(fromRelPath, specifier) {
  const fromAbsPath = repoPath(fromRelPath);
  const basePath = specifier.startsWith("@/")
    ? repoPath("src", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(fromAbsPath), specifier)
      : null;
  if (!basePath) return null;
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    join(basePath, "index.ts"),
    join(basePath, "index.tsx"),
    join(basePath, "index.js"),
  ];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  return resolved ? toRepoRelative(resolved) : null;
}

function collectSrcImports(relPath) {
  if (!existsSync(repoPath(relPath))) return [];
  const source = readText(relPath);
  const imports = [];
  const patterns = [
    /from\s+["']([^"']+)["']/g,
    /import\s+["']([^"']+)["']/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const resolved = tryResolveImport(relPath, match[1] ?? "");
      if (resolved?.startsWith("src/") || resolved?.startsWith("scripts/")) imports.push(resolved);
    }
  }
  return unique(imports);
}

function parseSufficiencyEntries(ast) {
  const sectionNodes = getSection(ast, 2, "Sufficiency Review");
  if (sectionNodes.length === 0) return [];

  const subsections = getSubsections(sectionNodes, 3);
  return subsections.map((sub) => {
    const kv = extractKeyValues(sub.nodes, ["Verdict", "Evidence", "polId"]);
    return {
      heading: sub.heading,
      block: nodeToString({ type: "root", children: sub.nodes }),
      verdict: kv.Verdict?.toLowerCase() ?? null,
      evidence: kv.Evidence ?? "",
      polId: kv.polId ?? "",
    };
  });
}

function parseIntentJudgmentRefs(value) {
  if (value === undefined || value === null) return { valid: [], invalid: [] };
  if (!Array.isArray(value)) {
    return {
      valid: [],
      invalid: [{ raw: JSON.stringify(value), reason: "expected array of strings" }],
    };
  }
  const valid = [];
  const invalid = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      invalid.push({ raw: JSON.stringify(entry), reason: "not a string" });
      continue;
    }
    const match = entry.match(/^(promise:[a-z0-9-]+|US-[A-Z0-9-]+)\s*->\s*(.+)$/);
    if (!match) {
      invalid.push({ raw: entry, reason: "expected `promise:slug -> anchor`" });
      continue;
    }
    valid.push({ promiseId: match[1].trim(), anchor: match[2].trim() });
  }
  return { valid, invalid };
}

function loadIntentJudgmentAnchors() {
  if (!existsSync(repoPath(INTENT_JUDGMENTS_PATH))) return new Set();
  const ast = readAst(INTENT_JUDGMENTS_PATH);
  const anchors = new Set();
  for (const node of ast.children) {
    if (node.type !== "heading") continue;
    const text = nodeToString(node);
    anchors.add(text);
    for (const match of text.matchAll(
      /\b(promise:[a-z0-9-]+|US-[A-Z0-9-]+|AC\d+|acceptance-check:[a-z0-9-]+)\b/g,
    )) {
      anchors.add(match[1]);
    }
  }
  return anchors;
}

function parseSpec(path) {
  const ast = readAst(path);
  const frontmatter = getFrontmatter(ast);
  const runBlocks = getRunShellBlocks(ast.children);
  const runChecks = runBlocks.map((block) => {
    const executionTargets = extractExecutionTargets(block.command).map(resolveTarget);
    const missingTargets = executionTargets.filter((target) => !existsSync(repoPath(target)));
    const codeTargets = new Set();
    for (const target of executionTargets) {
      if (!existsSync(repoPath(target))) continue;
      if (
        (target.startsWith("src/") || target.startsWith("scripts/")) &&
        !/\.test\./.test(target)
      ) {
        codeTargets.add(target);
      }
      for (const srcImport of collectSrcImports(target)) codeTargets.add(srcImport);
    }
    return {
      command: block.command,
      executionTargets,
      missingTargets,
      codeTargets: [...codeTargets].sort(),
    };
  });

  const refs = parseIntentJudgmentRefs(frontmatter.intentJudgmentRefs);
  return {
    path,
    curated: frontmatter.curated === true,
    intentAbsorbedIntoAcceptance: frontmatter.intentAbsorbedIntoAcceptance === true,
    intentJudgmentRefs: refs.valid,
    intentJudgmentRefsInvalid: refs.invalid,
    hasCoverageByStory: hasSection(ast, 2, "Coverage By Story"),
    coverageEntries: parseCoverageEntries(ast),
    runChecks,
    sufficiencyEntries: parseSufficiencyEntries(ast),
  };
}

function parseAspect(path) {
  const ast = readAst(path);
  const frontmatter = getFrontmatter(ast);
  const id =
    typeof frontmatter.id === "string" && frontmatter.id.trim()
      ? frontmatter.id.trim()
      : `aspect:${path.replace(/^.*\/|\.md$/g, "")}`;
  const coveringSpec =
    typeof frontmatter["covering-spec"] === "string"
      ? normalizeSpecPath(frontmatter["covering-spec"])
      : "";
  const legacyIds = Array.isArray(frontmatter.legacyIds)
    ? frontmatter.legacyIds.filter((entry) => typeof entry === "string")
    : [];
  const titleNode = ast.children.find((child) => child.type === "heading" && child.depth === 1);
  const title = titleNode ? nodeToString(titleNode) : id;
  return { id, path, coveringSpec, title, legacyIds };
}

function createFinding(input, findings) {
  return { id: `finding-${findings.length + 1}`, ...input };
}

function addFinding(findings, input) {
  findings.push(createFinding(input, findings));
}

function buildSnapshot() {
  const promisePaths = listPromisePaths();
  const aspectPaths = listAspectPaths();
  const specPaths = listSpecPaths();
  const skipped = promisePaths.length === 0 && aspectPaths.length === 0 && specPaths.length === 0;

  const promises = promisePaths.map(parsePromise);
  const aspects = aspectPaths.map(parseAspect);
  const specs = specPaths.map(parseSpec);
  const { ledgerRows, scenarioIds } = parseFeatureSpecs();
  const findings = [];

  const promiseById = new Map(promises.map((promise) => [promise.id, promise]));
  const ledgerByAc = new Map(ledgerRows.map((row) => [`${row.promiseId}|${row.acId}`, row]));
  const specByPath = new Map(specs.map((spec) => [spec.path, spec]));

  for (const promise of promises) {
    for (const acId of promise.acceptanceChecks) {
      if (!ledgerByAc.has(`${promise.id}|${acId}`)) {
        addFinding(findings, {
          severity: "critical",
          category: "missing_ac_ledger",
          title: `${promise.id} ${acId} is missing from feature-specs.md`,
          storyId: promise.id,
          acId,
          evidence: [promise.path, FEATURE_SPECS_PATH],
        });
      }
    }
  }

  for (const row of ledgerRows) {
    const promise = promiseById.get(row.promiseId);
    if (!promise || !promise.acceptanceChecks.includes(row.acId)) {
      addFinding(findings, {
        severity: "critical",
        category: "stale_ac_reference",
        title: `${row.promiseId} ${row.acId} is stale in feature-specs.md`,
        storyId: row.promiseId,
        acId: row.acId,
        evidence: [FEATURE_SPECS_PATH],
      });
    }

    for (const scenarioId of row.scenarioIds) {
      if (!scenarioIds.has(scenarioId)) {
        addFinding(findings, {
          severity: "critical",
          category: "missing_scenario_reference",
          title: `${row.promiseId} ${row.acId} points to missing ${scenarioId}`,
          storyId: row.promiseId,
          acId: row.acId,
          evidence: [FEATURE_SPECS_PATH],
        });
      }
    }

    if (row.specPaths.length === 0) {
      addFinding(findings, {
        severity: "critical",
        category: "missing_spec_file",
        title: `${row.promiseId} ${row.acId} has no covering spec path`,
        storyId: row.promiseId,
        acId: row.acId,
        evidence: [FEATURE_SPECS_PATH],
      });
    }

    for (const specPath of row.specPaths) {
      const spec = specByPath.get(specPath);
      if (!spec) {
        addFinding(findings, {
          severity: "critical",
          category: "missing_spec_file",
          title: `${row.promiseId} ${row.acId} points to missing ${specPath}`,
          storyId: row.promiseId,
          acId: row.acId,
          specPath,
          evidence: [FEATURE_SPECS_PATH],
        });
        continue;
      }
      const covered = spec.coverageEntries.some(
        (entry) => entry.promiseId === row.promiseId && entry.acId === row.acId,
      );
      if (!covered) {
        addFinding(findings, {
          severity: "critical",
          category: "coverage_ledger_mismatch",
          title: `${row.promiseId} ${row.acId} is absent from ${specPath} Coverage By Story`,
          storyId: row.promiseId,
          acId: row.acId,
          specPath,
          evidence: [FEATURE_SPECS_PATH, specPath],
        });
      }
    }
  }

  for (const spec of specs) {
    if (!spec.hasCoverageByStory) {
      addFinding(findings, {
        severity: "warning",
        category: "missing_coverage_section",
        title: `${spec.path} is missing Coverage By Story`,
        specPath: spec.path,
        evidence: [spec.path],
      });
    }
    if (spec.runChecks.length === 0) {
      addFinding(findings, {
        severity: "critical",
        category: "missing_run_shell",
        title: `${spec.path} has no run:shell block`,
        specPath: spec.path,
        evidence: [spec.path],
      });
    }
    for (const runCheck of spec.runChecks) {
      if (runCheck.missingTargets.length > 0) {
        addFinding(findings, {
          severity: "critical",
          category: "missing_execution_target",
          title: `${spec.path} points to missing execution targets`,
          specPath: spec.path,
          command: runCheck.command,
          evidence: [spec.path, ...runCheck.missingTargets],
        });
      }
      if (
        runCheck.executionTargets.length > 0 &&
        runCheck.missingTargets.length === 0 &&
        runCheck.codeTargets.length === 0
      ) {
        addFinding(findings, {
          severity: "warning",
          category: "missing_code_trace",
          title: `${spec.path} run:shell does not trace to src/ code`,
          specPath: spec.path,
          command: runCheck.command,
          evidence: [spec.path, ...runCheck.executionTargets],
        });
      }
    }

    for (const entry of spec.sufficiencyEntries) {
      if (!["met", "not-met", "unknown"].includes(entry.verdict)) {
        addFinding(findings, {
          severity: "critical",
          category: "invalid_sufficiency_verdict",
          title: `${spec.path} Sufficiency Review entry has no valid Verdict`,
          specPath: spec.path,
          evidence: [spec.path],
        });
      }
      if (entry.verdict === "met" && !/(runtime-output|rendered-dom)/i.test(entry.evidence)) {
        addFinding(findings, {
          severity: "critical",
          category: "met_missing_production_evidence",
          title: `${spec.path} declares met without production-equivalent Evidence`,
          specPath: spec.path,
          evidence: [spec.path],
        });
      }
    }
  }

  // 9번째 축 — Curated Spec Ledger / intent-absorbed subtype / Human Judgment Gate refs
  const intentJudgmentAnchors = loadIntentJudgmentAnchors();
  for (const spec of specs) {
    for (const invalidRef of spec.intentJudgmentRefsInvalid) {
      addFinding(findings, {
        severity: "critical",
        category: "invalid_intent_judgment_ref",
        title: `${spec.path} intentJudgmentRefs entry malformed: ${invalidRef.raw} (${invalidRef.reason})`,
        specPath: spec.path,
        evidence: [spec.path],
      });
    }

    if (!spec.intentAbsorbedIntoAcceptance) continue;

    if (spec.intentJudgmentRefs.length === 0) {
      addFinding(findings, {
        severity: "critical",
        category: "missing_intent_judgment_ref",
        title: `${spec.path} declares intentAbsorbedIntoAcceptance but lists no intentJudgmentRefs`,
        specPath: spec.path,
        evidence: [spec.path],
      });
      continue;
    }

    for (const ref of spec.intentJudgmentRefs) {
      // anchor 정확 매칭만 인정 (promiseId fallback 제거 — 우회로 차단)
      if (!intentJudgmentAnchors.has(ref.anchor)) {
        addFinding(findings, {
          severity: "critical",
          category: "missing_intent_judgment_ref",
          title: `${spec.path} intentJudgmentRefs ${ref.promiseId} -> ${ref.anchor} not found in ${INTENT_JUDGMENTS_PATH}`,
          specPath: spec.path,
          storyId: ref.promiseId,
          evidence: [spec.path, INTENT_JUDGMENTS_PATH],
        });
      }
      const promise = promiseById.get(ref.promiseId);
      if (promise && promise.acceptanceChecks.length === 0) {
        addFinding(findings, {
          severity: "critical",
          category: "absorbed_promise_missing_acceptance_check",
          title: `${ref.promiseId} (intent-absorbed via ${spec.path}) has no acceptance checks`,
          specPath: spec.path,
          storyId: ref.promiseId,
          evidence: [promise.path, spec.path],
        });
      }
    }
  }

  const aspectRows = [];
  for (const aspect of aspects) {
    const spec = aspect.coveringSpec ? specByPath.get(aspect.coveringSpec) : null;
    const aspectIds = [aspect.id, ...aspect.legacyIds];
    const matchingEntries =
      spec?.sufficiencyEntries.filter((entry) =>
        aspectIds.some((id) => entry.block.includes(id)),
      ) ?? [];
    const latestEntry = matchingEntries.at(-1) ?? null;

    if (!spec || !latestEntry) {
      addFinding(findings, {
        severity: "critical",
        category: "pol_aspect_unverified",
        title: `${aspect.id} aspect has no verdict-bearing Sufficiency Review entry`,
        storyId: aspect.id,
        specPath: aspect.coveringSpec || undefined,
        evidence: [aspect.path, aspect.coveringSpec].filter(Boolean),
      });
      aspectRows.push({ ...aspect, status: "unverified" });
      continue;
    }
    if (latestEntry.verdict === "not-met") {
      addFinding(findings, {
        severity: "critical",
        category: "pol_aspect_not_met",
        title: `${aspect.id} aspect verdict is not-met`,
        storyId: aspect.id,
        specPath: spec.path,
        evidence: [aspect.path, spec.path],
      });
      aspectRows.push({ ...aspect, status: "not-met" });
      continue;
    }
    if (latestEntry.verdict !== "met") {
      addFinding(findings, {
        severity: "critical",
        category: "pol_aspect_unknown",
        title: `${aspect.id} aspect verdict is unknown`,
        storyId: aspect.id,
        specPath: spec.path,
        evidence: [aspect.path, spec.path],
      });
      aspectRows.push({ ...aspect, status: "unknown" });
      continue;
    }
    aspectRows.push({ ...aspect, status: "met" });
  }

  return {
    skipped,
    summary: {
      promiseCount: promises.length,
      aspectCount: aspects.length,
      specCount: specs.length,
      ledgerRowCount: ledgerRows.length,
      intentEntries: specs.reduce(
        (count, spec) =>
          count +
          spec.sufficiencyEntries.filter(
            (entry) =>
              !aspects.some((aspect) =>
                [aspect.id, ...aspect.legacyIds].some((id) => entry.block.includes(id)),
              ),
          ).length,
        0,
      ),
      intentMet: specs.reduce(
        (count, spec) =>
          count +
          spec.sufficiencyEntries.filter(
            (entry) =>
              entry.verdict === "met" &&
              !aspects.some((aspect) =>
                [aspect.id, ...aspect.legacyIds].some((id) => entry.block.includes(id)),
              ),
          ).length,
        0,
      ),
      aspectMet: aspectRows.filter((row) => row.status === "met").length,
    },
    findings,
  };
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

function formatReleaseVerdict(snapshot) {
  const { findings, skipped, summary } = snapshot;
  const intentStatus = statusFor(findings, INTENT_CATEGORIES);
  const acStatus = statusFor(findings, LONGITUDINAL_AC_CATEGORIES);
  const codeStatus = statusFor(findings, CODE_TRACE_CATEGORIES);
  const aspectStatus = statusFor(findings, ASPECT_CATEGORIES);
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const release = criticalCount === 0 ? "ready" : "blocked";
  const releaseSuffix = skipped ? " (skeleton)" : "";

  return [
    "Release verdict",
    `  Intent verdict: ${intentStatus.padEnd(12)} (${summary.intentMet}/${summary.intentEntries} met)`,
    `  AC trace:       ${acStatus.padEnd(12)} (${detailFor(findings, LONGITUDINAL_AC_CATEGORIES)})`,
    `  Code trace:     ${codeStatus.padEnd(12)} (${detailFor(findings, CODE_TRACE_CATEGORIES)})`,
    `  Aspect:         ${aspectStatus.padEnd(12)} (${summary.aspectMet}/${summary.aspectCount} met)`,
    `Release: ${release}${releaseSuffix}`,
  ].join("\n");
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

function affectsStoryChain(files) {
  return files.some((file) =>
    STAGED_TRIGGERS.some((trigger) =>
      trigger.endsWith("/") ? file.startsWith(trigger) : file === trigger,
    ),
  );
}

function main() {
  const args = process.argv.slice(2);
  const wantsJson = args.includes("--json");
  const stagedOnly = args.includes("--staged");

  if (stagedOnly && !affectsStoryChain(getStagedFiles())) {
    if (wantsJson) {
      process.stdout.write(
        `${JSON.stringify({ skipped: true, reason: "no-story-chain-staged", findings: [] })}\n`,
      );
    } else {
      process.stdout.write(
        "mc:validate-story-chain - no staged files affect Story Chain. skipping.\n",
      );
    }
    return;
  }

  const snapshot = buildSnapshot();
  if (wantsJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  if (snapshot.skipped) {
    process.stdout.write("mc:validate-story-chain - 0 findings, skipped\n");
  } else {
    const criticalCount = snapshot.findings.filter(
      (finding) => finding.severity === "critical",
    ).length;
    process.stdout.write(
      `mc:validate-story-chain - ${snapshot.findings.length} finding(s), ${criticalCount} critical\n`,
    );
  }
  process.stdout.write(`${formatReleaseVerdict(snapshot)}\n`);

  if (snapshot.findings.length > 0) {
    process.stdout.write("\nFindings\n");
    for (const finding of snapshot.findings) {
      process.stdout.write(`  [${finding.severity}] ${finding.category}: ${finding.title}\n`);
    }
  }

  if (snapshot.findings.some((finding) => finding.severity === "critical")) {
    process.exitCode = 1;
  }
}

main();
