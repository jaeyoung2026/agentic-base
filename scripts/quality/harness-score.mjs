/**
 * 하네스 스코어카드 — 프로젝트의 하네스 커버리지를 7축으로 측정.
 *
 * "Agent = Model + Harness" — 하네스가 얼마나 완성됐는가?
 * 각 축별 점검 항목을 자동 감지하고 종합 점수를 산출한다.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

function exists(rel) {
  return existsSync(resolve(ROOT, rel));
}
function fileSize(rel) {
  try {
    return readFileSync(resolve(ROOT, rel), "utf8").length;
  } catch {
    return 0;
  }
}
function dirCount(rel, ext) {
  try {
    return readdirSync(resolve(ROOT, rel), { recursive: true }).filter(
      (f) => !ext || f.endsWith(ext),
    ).length;
  } catch {
    return 0;
  }
}
function grepCount(pattern, dir = "src") {
  try {
    const result = execSync(
      `grep -rn "${pattern}" ${dir}/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l`,
      { encoding: "utf8", cwd: ROOT },
    );
    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

// ══════════════════════════════════════════════
// 축별 점검
// ══════════════════════════════════════════════

const axes = [];

// 1. 제어 축 (Control)
{
  const items = [];
  items.push({ name: "PAR Loop 스키마", ok: exists("src/agent/par"), weight: 3 });
  items.push({ name: "Pre-commit hook", ok: exists(".husky/pre-commit"), weight: 2 });
  items.push({
    name: "quality:guards 스크립트",
    ok: (() => {
      try {
        const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
        return !!pkg.scripts?.["quality:guards"];
      } catch {
        return false;
      }
    })(),
    weight: 2,
  });
  items.push({
    name: "quality:check 파이프라인",
    ok: (() => {
      try {
        const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
        return !!pkg.scripts?.["quality:check"];
      } catch {
        return false;
      }
    })(),
    weight: 2,
  });
  axes.push({ name: "제어 (Control)", items });
}

// 2. 연결 축 (Connection)
{
  const items = [];
  items.push({ name: "LLM wrapper", ok: exists("src/lib/llm"), weight: 3 });
  items.push({
    name: "DB 클라이언트",
    ok: exists("src/lib/supabase") || exists("src/execution/repository"),
    weight: 2,
  });
  items.push({ name: "환경 변수 관리", ok: exists("src/lib/env.ts"), weight: 1 });
  items.push({ name: "외부 서비스 계층", ok: exists("src/execution/services"), weight: 2 });
  axes.push({ name: "연결 (Connection)", items });
}

// 3. 정책 축 (Policy)
{
  const items = [];
  items.push({ name: "AGENTS.md", ok: exists("AGENTS.md"), weight: 3 });
  items.push({ name: "AGENTS.md 충실도 (>2KB)", ok: fileSize("AGENTS.md") > 2000, weight: 2 });
  items.push({
    name: "profiles/ 디렉토리",
    ok: exists("src/product/profiles") || exists("profiles"),
    weight: 1,
  });
  items.push({ name: ".concern-rules.json", ok: exists(".concern-rules.json"), weight: 2 });
  items.push({ name: "설계 결정 문서", ok: exists("docs/design-decisions.md"), weight: 1 });
  axes.push({ name: "정책 (Policy)", items });
}

// 4. 기억 축 (Memory)
{
  const items = [];
  items.push({ name: "Artifact 영속 경로", ok: exists("src/execution/repository"), weight: 3 });
  items.push({ name: "Domain Access 계층", ok: exists("src/execution/domain-access"), weight: 2 });
  items.push({
    name: "Artifact 스키마",
    ok: exists("src/domain/artifact-schema.ts") || exists("src/domain/artifact.ts"),
    weight: 2,
  });
  axes.push({ name: "기억 (Memory)", items });
}

// 5. 검증 축 (Validation)
{
  const items = [];
  items.push({ name: "Formatter (Prettier)", ok: exists(".prettierrc"), weight: 1 });
  items.push({
    name: "Linter (ESLint)",
    ok: exists("eslint.config.mjs") || exists(".eslintrc.json"),
    weight: 1,
  });
  items.push({ name: "중복 탐지 (jscpd)", ok: exists(".jscpd.json"), weight: 1 });
  items.push({
    name: "테스트 커버리지",
    ok: exists("vitest.config.ts") || exists("jest.config.ts"),
    weight: 2,
  });
  items.push({ name: "Dead code 탐지 (knip)", ok: exists("knip.json"), weight: 1 });
  items.push({
    name: "Import 경계 (dep-cruiser)",
    ok: exists(".dependency-cruiser.cjs"),
    weight: 2,
  });
  items.push({
    name: "탈출구 차단 (escapes)",
    ok: exists("scripts/quality/check-escapes.mjs"),
    weight: 1,
  });
  items.push({
    name: "테스트 비율 (tloc)",
    ok: exists("scripts/quality/check-test-ratio.mjs"),
    weight: 1,
  });
  items.push({
    name: "관심사 중앙화 (concerns)",
    ok: exists("scripts/quality/check-concerns.mjs"),
    weight: 2,
  });
  items.push({
    name: "실행 가능 스펙 (specdown)",
    ok: dirCount("specs", ".spec.md") > 0,
    weight: 2,
  });
  items.push({
    name: "설계 검증 (spec-scope)",
    ok: exists("scripts/spec-scope/cli.mjs"),
    weight: 2,
  });
  // 추론적 센서
  items.push({
    name: "LLM-as-Judge (추론적 센서)",
    ok: exists("scripts/spec-scope/lib/gaps.mjs"),
    weight: 1,
  });
  axes.push({ name: "검증 (Validation)", items });
}

// 6. 구성 축 (Configuration/Subagents)
{
  const items = [];
  items.push({ name: "Agent 오케스트레이터", ok: exists("src/agent/orchestrator"), weight: 3 });
  items.push({ name: "Agent 도구 정의", ok: exists("src/agent/tools"), weight: 2 });
  items.push({ name: "정책 계층 (policy)", ok: exists("src/agent/policy"), weight: 2 });
  axes.push({ name: "구성 (Composition)", items });
}

// 7. 플랫폼 축 (Platform)
{
  const items = [];
  items.push({
    name: "3-Plane 구조",
    ok: exists("src/agent") && exists("src/execution") && exists("src/features"),
    weight: 3,
  });
  items.push({ name: "Domain 계약", ok: exists("src/domain"), weight: 2 });
  items.push({ name: "Product 계층", ok: exists("src/product"), weight: 2 });
  items.push({ name: "Route handler 헬퍼", ok: exists("src/lib/http"), weight: 1 });
  axes.push({ name: "플랫폼 (Platform)", items });
}

// ══════════════════════════════════════════════
// 스코어 산출
// ══════════════════════════════════════════════

let totalWeight = 0;
let totalScore = 0;

console.log("\n═══ 하네스 스코어카드 ═══\n");

for (const axis of axes) {
  let axisWeight = 0;
  let axisScore = 0;

  for (const item of axis.items) {
    axisWeight += item.weight;
    if (item.ok) axisScore += item.weight;
  }

  totalWeight += axisWeight;
  totalScore += axisScore;

  const pct = Math.round((axisScore / axisWeight) * 100);
  const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
  const icon = pct === 100 ? "✅" : pct >= 70 ? "🔶" : "❌";

  console.log(`${icon} ${axis.name.padEnd(22)} ${bar} ${String(pct).padStart(3)}%`);

  for (const item of axis.items) {
    console.log(`   ${item.ok ? "✓" : "✗"} ${item.name}`);
  }
  console.log("");
}

const totalPct = Math.round((totalScore / totalWeight) * 100);
console.log(`${"─".repeat(50)}`);
console.log(`종합 하네스 커버리지: ${totalPct}%  (${totalScore}/${totalWeight})`);
console.log("");

if (totalPct >= 90)
  console.log("→ 하네스가 성숙합니다. 표류 감지(Drift Detection)를 추가하면 완성.");
else if (totalPct >= 70) console.log("→ 핵심 축은 갖춰졌습니다. 약한 축을 보강하세요.");
else console.log("→ 하네스 구축이 필요합니다. 검증 축과 정책 축부터 시작하세요.");
