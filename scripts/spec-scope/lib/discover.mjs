/**
 * Auto-discover spec/contract documents in a project directory.
 * Returns { contracts: [{name,content}], specs: [{name,content}], context: [{name,content}] }
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { existsSync } from "node:fs";

const CONTRACT_DIRS = [
  "docs/contracts",
  "docs/policy",
  "docs/specs",
  "docs/requirements",
  "contracts",
  "specs/contracts",
  "requirements",
];
const SPEC_DIRS = ["specs", "spec", "specdown", "docs/specdown"];
const CONTEXT_FILES = ["AGENTS.md", "CLAUDE.md", "README.md"];
const SPEC_PATTERN = /\.spec\.md$/;
const CONTRACT_PATTERNS = [
  /user.?stories/i,
  /feature.?specs/i,
  /scenarios/i,
  /policies/i,
  /acceptance/i,
  /requirements/i,
  /gwt/i,
  /_index\.md$/,
];

async function walkDir(dir, base = dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    if (e.isDirectory()) {
      files.push(...(await walkDir(full, base)));
    } else if (e.isFile() && e.name.endsWith(".md")) {
      const rel = relative(base, full);
      const content = await readFile(full, "utf-8");
      files.push({ name: rel, content, path: full, size: content.length });
    }
  }
  return files;
}

export async function discover(projectDir) {
  const result = { contracts: [], specs: [], context: [], themes: [] };

  // 1. Context files (project root)
  for (const f of CONTEXT_FILES) {
    const p = join(projectDir, f);
    if (existsSync(p)) {
      result.context.push({ name: f, content: await readFile(p, "utf-8") });
    }
  }

  // 2. Look for contract directories
  for (const dir of CONTRACT_DIRS) {
    const full = join(projectDir, dir);
    if (!existsSync(full)) continue;
    const files = await walkDir(full);
    // Detect theme-based structure (TH-XXX subdirs)
    const themePattern = /^TH-[A-Z]+/;
    const themeDirs = [
      ...new Set(files.map((f) => f.name.split("/")[0]).filter((d) => themePattern.test(d))),
    ];

    if (themeDirs.length > 0) {
      // Moonlight-style: themes with epics
      for (const theme of themeDirs) {
        const themeFiles = files.filter((f) => f.name.startsWith(theme + "/"));
        result.themes.push({ id: theme, files: themeFiles, dir: join(full, theme) });
      }
    }
    // Also include all contract-like files
    const contractFiles = files.filter(
      (f) => CONTRACT_PATTERNS.some((p) => p.test(f.name)) || f.name.endsWith("policies.md"),
    );
    result.contracts.push(...contractFiles);
    break; // use first found contract dir
  }

  // 3. Look for SpecDown files
  // First check dedicated spec dirs
  for (const dir of SPEC_DIRS) {
    const full = join(projectDir, dir);
    if (!existsSync(full)) continue;
    const files = await walkDir(full);
    result.specs.push(...files.filter((f) => SPEC_PATTERN.test(f.name)));
    break;
  }
  // Also scan project root for .spec.md files
  if (result.specs.length === 0) {
    const allFiles = await walkDir(projectDir);
    result.specs = allFiles.filter((f) => SPEC_PATTERN.test(f.name));
  }

  // 4. If no contracts found via dirs, scan broadly for contract-like files
  if (result.contracts.length === 0) {
    const allFiles = await walkDir(projectDir);
    result.contracts = allFiles.filter((f) => CONTRACT_PATTERNS.some((p) => p.test(f.name)));
  }

  return result;
}

export function summarize(discovery) {
  const lines = [];
  lines.push(`Context files: ${discovery.context.map((f) => f.name).join(", ") || "none"}`);
  lines.push(
    `Contracts: ${discovery.contracts.length} files (${Math.round(discovery.contracts.reduce((s, f) => s + f.size, 0) / 1024)}KB)`,
  );
  lines.push(
    `Specs: ${discovery.specs.length} files (${Math.round(discovery.specs.reduce((s, f) => s + f.size, 0) / 1024)}KB)`,
  );
  if (discovery.themes.length > 0) {
    lines.push(`Themes: ${discovery.themes.map((t) => `${t.id}(${t.files.length})`).join(", ")}`);
  }
  return lines.join("\n");
}
