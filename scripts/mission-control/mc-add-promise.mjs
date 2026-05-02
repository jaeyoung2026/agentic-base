#!/usr/bin/env node

/**
 * mc:add-promise — Promise 골격을 _TEMPLATE.md에서 만들어준다.
 *
 * 사용법:
 *   node scripts/mission-control/mc-add-promise.mjs <slug> \
 *     --title "..." \
 *     --experience experience:foo \
 *     --moment moment:bar \
 *     --lane product
 *
 * 인자가 부족하면 STATUS: NEEDS_HUMAN으로 종료한다.
 * 본문(Promise/Intent Check/Acceptance Check 텍스트)은 H authority 영역이므로
 * placeholder를 남기고 사람이 채우게 한다.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const PROMISES_DIR = join(REPO_ROOT, "docs/contracts/story-chain/promises");
const TEMPLATE_PATH = join(PROMISES_DIR, "_TEMPLATE.md");
const LANES_CONFIG = join(__dirname, "lanes.json");

function loadValidLanes() {
  try {
    const raw = JSON.parse(readFileSync(LANES_CONFIG, "utf8"));
    if (Array.isArray(raw.valid) && raw.valid.every((entry) => typeof entry === "string")) {
      return new Set(raw.valid);
    }
  } catch {
    /* fall through */
  }
  return new Set(["product", "agent", "execution", "admin", "other"]);
}

const VALID_LANES = loadValidLanes();

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, options };
}

function fail(message, recommendation) {
  process.stderr.write(`STATUS: NEEDS_HUMAN\nROW: mc:add-promise\nWHY: ${message}\n`);
  if (recommendation) {
    process.stderr.write(`RECOMMENDATION: ${recommendation}\n`);
  }
  process.exit(1);
}

function isSlug(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value);
}

function applyReplacements(template, replacements) {
  let out = template;
  for (const [pattern, value] of Object.entries(replacements)) {
    out = out.split(pattern).join(value);
  }
  return out;
}

function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const slug = positional[0];

  if (!slug) {
    fail(
      "Missing positional <slug>",
      "node scripts/mission-control/mc-add-promise.mjs <slug> --title ... --experience ... --moment ... --lane ...",
    );
  }
  if (!isSlug(slug)) {
    fail(`Invalid slug "${slug}" — use kebab-case alphanumeric.`);
  }
  if (!options.title || typeof options.title !== "string") {
    fail("Missing --title");
  }
  if (!options.experience || typeof options.experience !== "string") {
    fail("Missing --experience (e.g. --experience experience:onboarding)");
  }
  if (!options.moment || typeof options.moment !== "string") {
    fail("Missing --moment (e.g. --moment moment:first-render)");
  }
  if (!options.lane || !VALID_LANES.has(options.lane)) {
    fail(`Missing or invalid --lane (one of ${[...VALID_LANES].join(", ")})`);
  }

  if (!existsSync(TEMPLATE_PATH)) {
    fail(`Template not found: ${TEMPLATE_PATH}`);
  }

  const target = join(PROMISES_DIR, `${slug}.md`);
  if (existsSync(target)) {
    fail(`Promise already exists: ${target}`, "Choose a different slug or edit the existing file.");
  }

  const template = readFileSync(TEMPLATE_PATH, "utf8");
  const filled = applyReplacements(template, {
    "{semantic-slug}": slug,
    "{ short title }": options.title,
    "{short title}": options.title,
    "experience:{experience-slug}": options.experience,
    "moment:{moment-slug}": options.moment,
    "lane: product | agent | execution | admin | other": `lane: ${options.lane}`,
    "{spec-name}": slug,
  });

  writeFileSync(target, filled, "utf8");
  process.stdout.write(`mc:add-promise - created ${target}\n`);
  process.stdout.write(
    "next: fill Promise body, Intent Check, Acceptance Check (H authority), then run mc:validate-story-chain.\n",
  );
}

main();
