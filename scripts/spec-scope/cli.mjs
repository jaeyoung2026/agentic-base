#!/usr/bin/env node
/**
 * spec-scope — Auto-discover specs, visualize flows, report coverage gaps.
 *
 * Usage:
 *   spec-scope <project-path-or-git-url> [options]
 *
 * Options:
 *   --out <dir>       Output directory (default: ./spec-scope-out)
 *   --model <id>      LLM model (default: gemini-3-flash-preview)
 *   --theme <TH-XXX>  Analyze specific theme only (for multi-theme projects)
 *   --skip-flow       Skip flow visualization, gap report only
 *   --skip-gaps       Skip gap analysis, flow visualization only
 */

import { resolve, join, basename } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { config } from "dotenv";
import { discover, summarize } from "./lib/discover.mjs";
import { extractFlow } from "./lib/extract.mjs";
import { analyzeGaps } from "./lib/gaps.mjs";
import { buildReport } from "./lib/report.mjs";
import { buildHtml } from "./lib/template.mjs";
import {
  parseScenarios,
  parseFeatureSpecs,
  parseUserStories,
  buildFlowFromParsed,
} from "./lib/parse-contracts.mjs";

// Load env
[".env.local", ".env"].forEach((f) => config({ path: resolve(process.cwd(), f) }));
[".env.local", ".env"].forEach((f) =>
  config({ path: new URL(`../${f}`, import.meta.url).pathname }),
);

// ── Parse args ──
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : null;
}
function hasFlag(name) {
  return args.includes(`--${name}`);
}
const target =
  args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true) ||
  args.find((a) => !a.startsWith("--"));

if (!target || hasFlag("help")) {
  console.log(`
spec-scope — Auto-discover specs, visualize flows, report coverage gaps.

Usage:
  spec-scope <project-path>     Analyze local project
  spec-scope <git-url>          Clone and analyze

Options:
  --out <dir>       Output directory (default: ./spec-scope-out)
  --model <id>      LLM model (default: gemini-3-flash-preview)
  --theme <TH-XXX>  Analyze specific theme only
  --skip-flow       Gap report only
  --skip-gaps       Flow visualization only

Examples:
  spec-scope ./my-project
  spec-scope ./my-project --theme TH-PDF --out ./reports
  spec-scope https://github.com/org/repo.git
`);
  process.exit(0);
}

const outDir = resolve(flag("out") || "spec-scope-out");
const model = flag("model") || "gemini-3-flash-preview";
const themeFilter = flag("theme");
const skipFlow = hasFlag("skip-flow");
const skipGaps = hasFlag("skip-gaps");
const useParse = hasFlag("parse"); // mechanical parsing, no LLM for flow extraction

// ── Resolve project path ──
let projectDir;
if (target.startsWith("http") || target.startsWith("git@")) {
  // Git clone
  const repoName = basename(target).replace(/\.git$/, "");
  const tmpDir = resolve("/tmp", `spec-scope-${repoName}-${Date.now()}`);
  console.log(`Cloning ${target}...`);
  execSync(`git clone --depth 1 ${target} ${tmpDir}`, { stdio: "pipe" });
  projectDir = tmpDir;
  console.log(`Cloned to ${tmpDir}`);
} else {
  projectDir = resolve(target);
  if (!existsSync(projectDir)) {
    console.error(`Not found: ${projectDir}`);
    process.exit(1);
  }
}

// ── Main ──
async function main() {
  console.log(`\n--- spec-scope ---\n`);
  console.log(`Project: ${projectDir}`);
  console.log(`Model:   ${model}`);
  console.log(`Output:  ${outDir}\n`);

  // 1. Discover
  console.log("[1/4] Discovering spec documents...");
  const disc = await discover(projectDir);
  console.log(summarize(disc));

  if (disc.contracts.length === 0) {
    console.error(
      "\nNo contract documents found. Looking for: user-stories.md, feature-specs.md, policies.md, etc.",
    );
    console.error("Expected in: docs/contracts/, docs/policy/, docs/specs/");
    process.exit(1);
  }

  // Determine what to analyze
  let targets = [];
  if (themeFilter && disc.themes.length > 0) {
    const theme = disc.themes.find((t) => t.id === themeFilter);
    if (!theme) {
      console.error(
        `Theme ${themeFilter} not found. Available: ${disc.themes.map((t) => t.id).join(", ")}`,
      );
      process.exit(1);
    }
    targets.push({
      id: themeFilter,
      contracts: theme.files,
      specs: disc.specs,
      title: themeFilter,
    });
  } else if (disc.themes.length > 0 && !themeFilter) {
    // Multi-theme: process each
    for (const theme of disc.themes) {
      targets.push({ id: theme.id, contracts: theme.files, specs: disc.specs, title: theme.id });
    }
    // Also add a combined analysis if specs exist
    if (disc.specs.length > 0) {
      targets.push({
        id: "all",
        contracts: disc.contracts,
        specs: disc.specs,
        title: "All Themes",
      });
    }
  } else {
    // Single project (lighthouse-style)
    const projName = basename(projectDir);
    targets.push({
      id: projName,
      contracts: [...disc.context, ...disc.contracts],
      specs: disc.specs,
      title: projName,
    });
  }

  mkdirSync(outDir, { recursive: true });

  // 2. Process each target
  let indexItems = [];
  for (const t of targets) {
    console.log(
      `\n[Processing] ${t.title} (${t.contracts.length} contracts, ${t.specs.length} specs)`,
    );

    // 2a. Flow extraction (needed for both viz and gap analysis)
    let flowData = null;
    let gapData = null;

    if (useParse) {
      // Mechanical parsing — no LLM needed for flow extraction
      console.log("[2/4] Parsing contract documents (no LLM)...");
      try {
        const scenarioFile = t.contracts.find(
          (f) => f.name.match(/scenario/i) || f.name.match(/reaction/i),
        );
        const featureFile = t.contracts.find((f) => f.name.match(/feature.?spec/i));
        const storyFiles = t.contracts.filter((f) => f.name.match(/user.?stor/i));

        const scenarios = scenarioFile ? parseScenarios(scenarioFile.content) : [];
        const featureSpecs = featureFile
          ? parseFeatureSpecs(featureFile.content)
          : { acLedger: [], scCatalog: [] };
        const userStories = storyFiles.flatMap((f) => parseUserStories(f.content));

        console.log(
          `  Parsed: ${scenarios.length} scenarios, ${featureSpecs.acLedger.length} ACs, ${userStories.length} user stories`,
        );

        flowData = buildFlowFromParsed({ scenarios, featureSpecs, userStories, title: t.title });
        console.log(
          `  -> ${Object.keys(flowData.lanes).length} lanes, ${flowData.nodes.length} nodes, ${flowData.edges.length} edges, ${flowData.scenarios.length} scenarios`,
        );
      } catch (e) {
        console.error(`  Parse failed: ${e.message}`);
        if (process.env.DEBUG) console.error(e.stack);
      }
    } else {
      // LLM-based extraction
      console.log("[2/4] Extracting flow graph (LLM)...");
      try {
        flowData = await extractFlow(t.contracts, { model, title: t.title });
        console.log(
          `  -> ${Object.keys(flowData.lanes).length} lanes, ${flowData.nodes.length} nodes, ${flowData.edges.length} edges, ${flowData.scenarios.length} scenarios`,
        );
      } catch (e) {
        console.error(`  Flow extraction failed: ${e.message}`);
      }
    }

    // 2b. Gap analysis: structural (graph) + semantic (LLM + specs)
    if (!skipGaps && flowData) {
      if (t.specs.length > 0) {
        console.log("[3/4] Running graph + semantic gap analysis...");
        try {
          gapData = await analyzeGaps(t.contracts, t.specs, { model, flowData });
          const mdPath = join(outDir, `gaps-${t.id}.md`);
          const jsonPath = join(outDir, `gaps-${t.id}.json`);
          await writeFile(mdPath, buildReport(gapData, { title: t.title, model }));
          await writeFile(jsonPath, JSON.stringify(gapData, null, 2));
          const stats = gapData.structural_stats || {};
          console.log(
            `  -> ${mdPath} (score: ${gapData.score}/100, findings: ${gapData.findings.length}, nodes ${stats.covNodePct}%, edges ${stats.covEdgePct}%)`,
          );
          indexItems.push({
            id: t.id,
            title: t.title,
            type: "gaps",
            file: `gaps-${t.id}.md`,
            score: gapData.score,
            findings: gapData.findings.length,
          });
        } catch (e) {
          console.error(`  Gap analysis failed: ${e.message}`);
        }
      } else {
        // No specs but we have graph — structural analysis only
        console.log("[3/4] Running structural-only gap analysis (no specs)...");
        try {
          const { structuralAnalysis } = await import("./lib/gaps.mjs");
          const structural = structuralAnalysis(flowData);
          gapData = {
            score: null,
            summary: "Structural analysis only — no spec files found.",
            findings: structural.findings.map((f) => ({ ...f, source: "structural" })),
            structural_stats: structural.stats,
            spec_audit: [],
            uncovered_scenarios: [],
          };
          const mdPath = join(outDir, `gaps-${t.id}.md`);
          await writeFile(
            mdPath,
            buildReport(gapData, { title: t.title, model: "structural-only" }),
          );
          console.log(`  -> ${mdPath} (structural only, ${structural.findings.length} findings)`);
          indexItems.push({
            id: t.id,
            title: t.title,
            type: "gaps",
            file: `gaps-${t.id}.md`,
            score: null,
            findings: structural.findings.length,
          });
        } catch (e) {
          console.error(`  Structural analysis failed: ${e.message}`);
        }
      }
    }

    // 2c. Generate flow HTML (after gap analysis so we can inject coverage data)
    if (!skipFlow && flowData) {
      const html = buildHtml(flowData, gapData);
      const flowPath = join(outDir, `flow-${t.id}.html`);
      await writeFile(flowPath, html);
      console.log(`  -> ${flowPath} (coverage ${gapData ? "injected" : "none"})`);
      indexItems.push({
        id: t.id,
        title: t.title,
        type: "flow",
        file: `flow-${t.id}.html`,
        lanes: Object.keys(flowData.lanes).length,
        nodes: flowData.nodes.length,
        scenarios: flowData.scenarios.length,
      });
    }
  }

  // 3. Index page
  console.log("\n[4/4] Generating index...");
  const indexHtml = buildIndex(indexItems, basename(projectDir));
  await writeFile(join(outDir, "index.html"), indexHtml);
  console.log(`  -> ${join(outDir, "index.html")}`);

  console.log(`\n--- Done! Open ${join(outDir, "index.html")} ---\n`);
}

function buildIndex(items, projectName) {
  const flows = items.filter((i) => i.type === "flow");
  const gaps = items.filter((i) => i.type === "gaps");
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>spec-scope — ${projectName}</title>
<style>
:root{--bg:#1a1e2e;--surface:#232840;--surface2:#2c3252;--border:#454d78;--text:#eef0f8;--dim:#9ba3c4;--accent:#7d9bff;--green:#5eeb96;--yellow:#ffd84d;--red:#ff8888;--teal:#40e8d4;--purple:#d0a0ff;--orange:#ffaa55;}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:'Pretendard',-apple-system,system-ui,sans-serif;min-height:100vh;}
.hero{max-width:900px;margin:0 auto;padding:60px 40px 32px;}
.hero h1{font-size:32px;font-weight:800;letter-spacing:-1px;margin-bottom:8px;} .hero h1 span{color:var(--accent);}
.hero p{font-size:14px;color:var(--dim);line-height:1.6;}
.section{max-width:900px;margin:0 auto;padding:0 40px 24px;}
.section h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--dim);margin-bottom:14px;display:flex;align-items:center;gap:8px;}
.section h2 .cnt{font-size:11px;padding:2px 7px;border-radius:8px;background:var(--surface2);color:var(--accent);}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;text-decoration:none;color:var(--text);transition:all .2s;position:relative;display:block;}
.card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.3);}
.card .bar{position:absolute;top:0;left:0;width:4px;height:100%;border-radius:12px 0 0 12px;}
.card .badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:6px;display:inline-block;margin-bottom:8px;}
.card h3{font-size:14px;font-weight:700;margin-bottom:4px;}
.card .desc{font-size:11px;color:var(--dim);line-height:1.5;}
.card .stats{display:flex;gap:10px;font-size:11px;color:var(--dim);margin-top:8px;}
.card .stats .dot{width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:3px;}
hr{border:none;border-top:1px solid var(--border);max-width:900px;margin:8px auto 24px;padding:0 40px;}
</style></head><body>
<div class="hero"><h1><span>spec-scope</span> — ${esc(projectName)}</h1><p>Auto-discovered specs and contracts. Flow visualizations and semantic gap analysis.</p></div>
${flows.length ? `<div class="section"><h2>Flow Visualizations <span class="cnt">${flows.length}</span></h2><div class="grid">${flows.map((f) => `<a class="card" href="${f.file}"><div class="bar" style="background:var(--accent)"></div><div class="badge" style="background:rgba(125,155,255,.12);color:var(--accent)">Flow</div><h3>${esc(f.title)}</h3><div class="stats"><span><span class="dot" style="background:var(--green)"></span>${f.lanes} lanes</span><span><span class="dot" style="background:var(--accent)"></span>${f.nodes} nodes</span><span><span class="dot" style="background:var(--teal)"></span>${f.scenarios} scenarios</span></div></a>`).join("")}</div></div>` : ""}
${
  gaps.length
    ? `<hr><div class="section"><h2>Gap Reports <span class="cnt">${gaps.length}</span></h2><div class="grid">${gaps
        .map((g) => {
          const sc =
            g.score >= 90 ? "var(--green)" : g.score >= 70 ? "var(--yellow)" : "var(--red)";
          return `<a class="card" href="${g.file}"><div class="bar" style="background:${sc}"></div><div class="badge" style="background:${sc}20;color:${sc}">Score ${g.score}</div><h3>${esc(g.title)}</h3><div class="desc">${g.findings} findings</div></a>`;
        })
        .join("")}</div></div>`
    : ""
}
</body></html>`;
}
function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

main().catch((e) => {
  console.error("Error:", e.message);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});
