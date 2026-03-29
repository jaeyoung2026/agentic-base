import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const VALID_HELP_MARKERS = [
  "Markdown-first executable specifications",
  "Execute specs and generate HTML/JSON reports",
];

function getCandidatePaths() {
  const candidates = new Set();
  const envBinary = process.env.SPECDOWN_BIN;
  if (envBinary) {
    candidates.add(envBinary);
  }

  candidates.add(join(homedir(), ".local", "bin", "specdown"));

  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    if (!entry || entry.includes("node_modules/.bin")) continue;
    candidates.add(join(entry, "specdown"));
  }

  return [...candidates].filter((candidate) => existsSync(candidate));
}

function isValidSpecdown(binaryPath) {
  const result = spawnSync(binaryPath, ["--help"], {
    encoding: "utf8",
  });

  if (result.error) {
    return false;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return VALID_HELP_MARKERS.some((marker) => output.includes(marker));
}

function resolveSpecdownBinary() {
  for (const candidate of getCandidatePaths()) {
    if (isValidSpecdown(candidate)) {
      return candidate;
    }
  }

  return null;
}

const binaryPath = resolveSpecdownBinary();
if (!binaryPath) {
  console.error(
    [
      "ERROR: runnable SpecDown binary not found.",
      "Install the executable SpecDown CLI, then retry:",
      "curl -sSfL https://raw.githubusercontent.com/corca-ai/specdown/main/install.sh | sh",
    ].join("\n"),
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync(binaryPath, args.length > 0 ? args : ["run"], {
  env: { ...process.env, SPECDOWN: "1" },
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
