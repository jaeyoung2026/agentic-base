/**
 * Build markdown gap report from merged structural + semantic analysis.
 */
export function buildReport(data, { title = "Project", model = "" } = {}) {
  const now = new Date().toISOString().slice(0, 10);
  const sev = { critical: "\u{1F534}", warning: "\u{1F7E1}", info: "\u{1F7E2}" };
  const cat = {
    missing_spec: "Spec 없음",
    semantic_mismatch: "의미적 불일치",
    partial_coverage: "부분 커버",
    untested_scenario: "미검증 시나리오",
    untested_error: "미검증 에러",
    integration_gap: "통합 갭",
    orphan_node: "고립 노드",
    dead_edge: "미검증 엣지",
    untested_error_node: "에러 노드 미검증",
    lane_no_error_scenario: "레인 에러 미검증",
    uncovered_chip_branch: "칩 분기 미검증",
    single_path: "단일 경로 의존",
  };
  const srcLabel = { structural: "Graph", semantic: "LLM" };

  const stats = data.structural_stats || {};

  let md = `# Gap Report — ${title}

> Generated: ${now}
> Model: \`${model}\`
> Coverage Score: **${data.score}/100**

---

## Graph Coverage

| Metric | Value |
|--------|-------|
| Total Nodes | ${stats.totalNodes || "—"} |
| Covered by Scenarios | ${stats.coveredNodes || "—"} (${stats.covNodePct || "—"}%) |
| Total Edges | ${stats.totalEdges || "—"} |
| Covered by Scenarios | ${stats.coveredEdges || "—"} (${stats.covEdgePct || "—"}%) |
| Scenarios | ${stats.totalScenarios || "—"} |

---

## Summary

${data.summary}

---

## Findings (${data.findings.length})

| # | Source | Severity | Category | Title |
|---|--------|----------|----------|-------|
${data.findings.map((f, i) => `| ${i + 1} | ${srcLabel[f.source] || "—"} | ${sev[f.severity] || ""} ${f.severity} | ${cat[f.category] || f.category} | ${f.title} |`).join("\n")}

`;
  ["critical", "warning", "info"].forEach((s) => {
    const items = data.findings.filter((f) => f.severity === s);
    if (!items.length) return;
    md += `\n### ${sev[s]} ${s.charAt(0).toUpperCase() + s.slice(1)} (${items.length})\n\n`;
    items.forEach((f) => {
      md += `#### ${f.title}\n\n`;
      md += `- **Source**: ${srcLabel[f.source] || "—"} analysis\n`;
      if (f.us) md += `- **US/AC**: ${f.us} ${f.ac || ""}\n`;
      if (f.scenario_or_node) md += `- **Target**: ${f.scenario_or_node}\n`;
      if (f.node) md += `- **Node**: \`${f.node}\`\n`;
      if (f.lane) md += `- **Lane**: ${f.lane}\n`;
      if (f.spec) md += `- **Spec**: \`${f.spec}\`\n`;
      md += `- **Category**: ${cat[f.category] || f.category}\n`;
      md += `- **Detail**: ${f.detail}\n`;
      if (f.recommendation) md += `- **Recommendation**: ${f.recommendation}\n`;
      md += "\n";
    });
  });

  if (data.spec_audit?.length) {
    md += `---\n\n## Spec Audit\n\n| Spec | Scenarios Covered | Missed | Note |\n|------|-------------------|--------|------|\n`;
    data.spec_audit.forEach((s) => {
      md += `| \`${s.spec}\` | ${s.scenarios_covered?.join(", ") || "—"} | ${s.scenarios_missed?.join(", ") || "—"} | ${s.note || ""} |\n`;
    });
    md += "\n";
  }

  if (data.uncovered_scenarios?.length) {
    md += `---\n\n## Uncovered Scenarios\n\n`;
    data.uncovered_scenarios.forEach((s) => {
      md += `- **${s.scenario_id}**: ${s.gap}\n`;
    });
    md += "\n";
  }

  return md;
}
