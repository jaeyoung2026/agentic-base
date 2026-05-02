/**
 * Two-phase gap analysis:
 *   Phase 1: Structural analysis on the extracted flow graph (code, no LLM)
 *   Phase 2: Semantic analysis — LLM reads graph + specs to validate real coverage
 *
 * The graph is the single source of truth for "what the system does".
 * Specs are checked against the graph to see if they cover the paths.
 */
import { callLLM } from "./llm.mjs";

// ══════════════════════════════════════════════
// Phase 1: Structural (deterministic, no LLM)
// ══════════════════════════════════════════════

export function structuralAnalysis(flowData) {
  const { nodes = [], edges = [], scenarios = [], lanes = {} } = flowData;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const findings = [];

  // All nodes that appear in at least one scenario path
  const coveredNodes = new Set();
  scenarios.forEach((s) => s.path?.forEach((nid) => coveredNodes.add(nid)));

  // All edges that appear in at least one scenario path
  const coveredEdges = new Set();
  scenarios.forEach((s) => {
    if (!s.path) return;
    for (let i = 0; i < s.path.length - 1; i++) {
      coveredEdges.add(`${s.path[i]}→${s.path[i + 1]}`);
    }
  });

  // 1. Orphan nodes: exist in graph but no scenario passes through
  nodes.forEach((n) => {
    if (!coveredNodes.has(n.id) && n.shape !== "pill") {
      findings.push({
        severity: "critical",
        category: "orphan_node",
        title: `노드 "${n.label || n.id}" — 시나리오 경로 없음`,
        detail: `이 노드를 지나는 시나리오가 하나도 없습니다. 그래프에 정의되었지만 검증 경로에서 완전히 빠져 있습니다.`,
        node: n.id,
        lane: n.lane,
      });
    }
  });

  // 2. Dead edges: edge exists but no scenario traverses it
  edges.forEach((e) => {
    const key = `${e.source}→${e.target}`;
    if (!coveredEdges.has(key) && e.type !== "tree") {
      const sn = nodeMap.get(e.source);
      const tn = nodeMap.get(e.target);
      findings.push({
        severity: e.type === "error" ? "warning" : "warning",
        category: "dead_edge",
        title: `엣지 "${sn?.label || e.source}" → "${tn?.label || e.target}" 미검증`,
        detail: `이 연결을 지나는 시나리오가 없습니다. ${e.type === "error" ? "에러 경로" : e.type === "cross" ? "크로스레인 연결" : "플로우"} 미검증.`,
        node: e.source,
        lane: sn?.lane,
      });
    }
  });

  // 3. Error nodes without error scenario
  const errorScenarioPaths = new Set();
  scenarios
    .filter((s) => s.type === "hard_error" || s.type === "recoverable")
    .forEach((s) => s.path?.forEach((nid) => errorScenarioPaths.add(nid)));
  nodes
    .filter((n) => n.err)
    .forEach((n) => {
      if (!errorScenarioPaths.has(n.id)) {
        findings.push({
          severity: "critical",
          category: "untested_error_node",
          title: `에러 노드 "${n.label || n.id}" — 에러 시나리오 없음`,
          detail: `${n.err === "hard" ? "hard_error" : "recoverable"} 노드이지만 에러/복구 시나리오에 포함되지 않습니다.`,
          node: n.id,
          lane: n.lane,
        });
      }
    });

  // 4. Lanes without error scenario
  const lanesWithError = new Set(
    scenarios.filter((s) => s.type === "hard_error" || s.type === "recoverable").map((s) => s.lane),
  );
  Object.keys(lanes).forEach((lane) => {
    const laneHasErrorNodes = nodes.some((n) => n.lane === lane && n.err);
    if (laneHasErrorNodes && !lanesWithError.has(lane)) {
      findings.push({
        severity: "warning",
        category: "lane_no_error_scenario",
        title: `${lanes[lane]?.label || lane} 레인 — 에러 시나리오 없음`,
        detail: `에러 노드가 있지만 에러 시나리오가 없습니다. 실패 경로 전체 미검증.`,
        node: null,
        lane,
      });
    }
  });

  // 5. Chip tree branches without scenario coverage
  const chipNodes = nodes.filter((n) => n.shape === "pill");
  chipNodes.forEach((chip) => {
    if (!coveredNodes.has(chip.id)) {
      findings.push({
        severity: "warning",
        category: "uncovered_chip_branch",
        title: `칩 "${chip.label}" — 시나리오 경로 없음`,
        detail: `이 칩 분기를 지나는 시나리오가 없습니다. 사용자가 이 칩을 클릭했을 때의 동작이 미검증.`,
        node: chip.id,
        lane: chip.lane,
      });
    }
  });

  // 6. Single-path nodes: only 1 scenario covers this node
  const nodeScenarioCount = {};
  scenarios.forEach((s) =>
    s.path?.forEach((nid) => {
      nodeScenarioCount[nid] = (nodeScenarioCount[nid] || 0) + 1;
    }),
  );
  nodes
    .filter((n) => n.shape !== "pill" && n.shape !== "card")
    .forEach((n) => {
      if ((nodeScenarioCount[n.id] || 0) === 1) {
        findings.push({
          severity: "info",
          category: "single_path",
          title: `"${n.label || n.id}" — 단일 시나리오 의존`,
          detail: `이 노드를 지나는 시나리오가 1개뿐입니다. 해당 시나리오가 빠지면 커버리지 0.`,
          node: n.id,
          lane: n.lane,
        });
      }
    });

  // Stats
  const totalNodes = nodes.length;
  const totalEdges = edges.length;
  const covNodePct = Math.round((coveredNodes.size / totalNodes) * 100);
  const covEdgePct = Math.round((coveredEdges.size / totalEdges) * 100);

  return {
    findings,
    stats: {
      totalNodes,
      totalEdges,
      totalScenarios: scenarios.length,
      coveredNodes: coveredNodes.size,
      coveredEdges: coveredEdges.size,
      covNodePct,
      covEdgePct,
    },
  };
}

// ══════════════════════════════════════════════
// Phase 2: Semantic (LLM)
// ══════════════════════════════════════════════

const SEMANTIC_PROMPT = `You are a QA architect. You are given:
1. A FLOW GRAPH (nodes, edges, scenarios) extracted from the project's contracts.
2. SPEC FILES (.spec.md with run:shell executable tests).
3. STRUCTURAL FINDINGS — gaps already detected by graph analysis.

Your job: validate whether the SPEC files actually cover the GRAPH's scenarios.

For each scenario in the graph:
- Does a spec's run:shell command actually test the behavior described in the scenario's path?
- Are the assertions checking the right thing?

For each structural finding:
- Confirm or dismiss it based on what the specs actually test.
- A spec might cover a node even if no scenario passes through it (e.g., a unit test for that specific node).

Output JSON:
{
  "score": 0-100,
  "summary": "Overall assessment",
  "semantic_findings": [{
    "severity": "critical|warning|info",
    "category": "missing_spec|semantic_mismatch|partial_coverage|untested_scenario|untested_error|integration_gap",
    "scenario_or_node": "S1 or node-id",
    "spec": "file.spec.md or null",
    "title": "Short title",
    "detail": "What's missing",
    "recommendation": "How to fix"
  }],
  "structural_overrides": [{
    "original_title": "exact title from structural finding",
    "action": "confirm|dismiss|downgrade",
    "reason": "Why this structural finding should be kept, dismissed, or downgraded"
  }],
  "spec_audit": [{
    "spec": "file.spec.md",
    "scenarios_covered": ["S1","S4"],
    "scenarios_missed": ["S8"],
    "note": ""
  }]
}

Rules:
- Be skeptical. Read run:shell commands carefully.
- Score 0-100 based on combined structural + semantic coverage.
- structural_overrides: for each structural finding, say if the specs actually cover it (dismiss) or not (confirm).`;

export async function analyzeGaps(contracts, specs, { model, flowData } = {}) {
  // Phase 1: structural
  let structural = { findings: [], stats: {} };
  if (flowData) {
    console.log("  Phase 1: Structural graph analysis...");
    structural = structuralAnalysis(flowData);
    console.log(
      `  -> ${structural.findings.length} structural findings (nodes ${structural.stats.covNodePct}%, edges ${structural.stats.covEdgePct}%)`,
    );
  }

  // Phase 2: semantic (LLM)
  console.log("  Phase 2: Semantic spec analysis...");
  const graphSummary = flowData
    ? JSON.stringify(
        {
          lanes: flowData.lanes,
          nodes: flowData.nodes?.map((n) => ({
            id: n.id,
            lane: n.lane,
            label: n.label,
            shape: n.shape,
            err: n.err,
          })),
          edges: flowData.edges,
          scenarios: flowData.scenarios?.map((s) => ({
            id: s.id,
            lane: s.lane,
            label: s.label,
            type: s.type,
            path: s.path,
          })),
        },
        null,
        2,
      )
    : "No graph data.";

  const structuralSummary =
    structural.findings.length > 0
      ? structural.findings.map((f) => `[${f.severity}] ${f.title}: ${f.detail}`).join("\n")
      : "No structural findings.";

  const content = [
    "## FLOW GRAPH\n\n```json\n" + graphSummary + "\n```\n\n",
    "## STRUCTURAL FINDINGS\n\n" + structuralSummary + "\n\n",
    "## SPEC FILES\n\n",
    ...specs.map((f) => `### ${f.name}\n\n${f.content}\n\n`),
    "## CONTRACTS (for reference)\n\n",
    ...contracts.map((f) => `### ${f.name}\n\n${f.content}\n\n`),
  ].join("");

  console.log(`  Sending to LLM (${Math.round(content.length / 1024)}KB)...`);
  const semantic = await callLLM(SEMANTIC_PROMPT, content, { model });
  if (!semantic.semantic_findings) semantic.semantic_findings = [];
  if (!semantic.structural_overrides) semantic.structural_overrides = [];
  if (!semantic.spec_audit) semantic.spec_audit = [];

  // Phase 3: merge structural + semantic
  console.log("  Phase 3: Merging findings...");
  const overrideMap = new Map(semantic.structural_overrides.map((o) => [o.original_title, o]));

  const mergedFindings = [];

  // Process structural findings with overrides
  for (const f of structural.findings) {
    const override = overrideMap.get(f.title);
    if (override?.action === "dismiss") {
      continue; // LLM says spec actually covers this
    }
    if (override?.action === "downgrade") {
      f.severity = f.severity === "critical" ? "warning" : "info";
      f.detail += ` (LLM: ${override.reason})`;
    }
    if (override?.action === "confirm") {
      f.detail += ` (LLM confirmed: ${override.reason})`;
    }
    f.source = "structural";
    mergedFindings.push(f);
  }

  // Add semantic-only findings
  for (const f of semantic.semantic_findings) {
    f.source = "semantic";
    mergedFindings.push(f);
  }

  return {
    score: semantic.score || 0,
    summary: semantic.summary || "",
    findings: mergedFindings,
    structural_stats: structural.stats,
    spec_audit: semantic.spec_audit,
    uncovered_scenarios:
      semantic.spec_audit?.flatMap((a) =>
        (a.scenarios_missed || []).map((s) => ({
          scenario_id: s,
          description: "",
          gap: a.note || `Not covered by ${a.spec}`,
        })),
      ) || [],
  };
}
