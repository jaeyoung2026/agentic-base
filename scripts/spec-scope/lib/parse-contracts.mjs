/**
 * Mechanical parser for structured contract documents.
 * Extracts chips, scenarios, AC mappings directly from markdown — no LLM.
 *
 * Supports:
 *   - user-stories.md: US + AC + chips
 *   - ai-reaction-scenarios.md: scenario ID + title/body/chips + replacement
 *   - feature-specs.md: SC→AC→SpecDown mapping, AC ledger
 */

// ══════════════════════════════════════════════
// ai-reaction-scenarios.md parser
// ══════════════════════════════════════════════

export function parseScenarios(content) {
  const scenarios = [];
  // Split by "### 시나리오" headers
  const blocks = content.split(/^### 시나리오 /m).slice(1);

  for (const block of blocks) {
    const sc = {};

    // ID and title: "S1: 일반 검색 — 결과 충분" or "S1: 결과 충분 (30편 이상)"
    const headerMatch = block.match(/^([A-Z]\d+):\s*(.+)/);
    if (!headerMatch) continue;
    sc.id = headerMatch[1];
    sc.label = headerMatch[2].trim().split("\n")[0];

    // Situation: "상황:" or "**상황:**"
    const sitMatch = block.match(/(?:\*\*)?상황:?(?:\*\*)?\s*(.+?)(?:\n\n|\n```)/s);
    sc.situation = sitMatch ? sitMatch[1].trim() : "";

    // AI reaction blocks (```txt ... ``` or ``` ... ```)
    const codeBlocks = [...block.matchAll(/```(?:txt)?\n([\s\S]*?)```/g)];

    if (codeBlocks.length > 0) {
      sc.reaction = parseReactionBlock(codeBlocks[0][1]);
    }

    // Replacement reaction (second code block)
    if (codeBlocks.length > 1) {
      sc.replaceReaction = parseReactionBlock(codeBlocks[1][1]);
    }

    // Type inference
    const hasChips = sc.reaction?.chips?.length > 0;
    if (block.match(/실패|열 수 없|읽을 수 없/) && !hasChips) {
      sc.type = "hard_error";
    } else if (block.match(/실패|타임아웃|부분/) && hasChips) {
      sc.type = "recoverable";
    } else if (block.includes("문서로 전환") || block.includes("문서가 생성")) {
      sc.type = "navigation";
    } else if (block.includes("분석 중") || block.includes("진행 중")) {
      sc.type = "progress";
    } else {
      sc.type = "normal";
    }

    // Lane inference from ID
    if (sc.id.startsWith("S")) sc.lane = "search";
    else if (sc.id.startsWith("G")) sc.lane = "gap";
    else if (sc.id.startsWith("P")) sc.lane = "pdf";
    else if (sc.id.startsWith("W")) sc.lane = "web";

    scenarios.push(sc);
  }

  return scenarios;
}

function parseReactionBlock(text) {
  const r = { title: "", body: "", chips: [] };

  // title:
  const titleMatch = text.match(/title:\s*(.+)/);
  if (titleMatch) r.title = titleMatch[1].trim();

  // body: (may be multi-line, ends at surface: or chips: or end)
  const bodyMatch = text.match(/body:\s*([\s\S]*?)(?=surface:|chips:|$)/);
  if (bodyMatch) r.body = bodyMatch[1].trim().replace(/\n/g, " ");

  // Format 1: surface: guided_tree with "- explore: X" / "- navigate: X" / "- recover: X"
  const surfaceLines = [...text.matchAll(/^\s*-\s*(explore|navigate|recover):\s*(.+)$/gm)];
  if (surfaceLines.length > 0) {
    r.chips = surfaceLines.map((m) => {
      const kind = m[1].trim();
      const label = m[2].trim();
      let k = "";
      if (kind === "navigate") k = "nav";
      else if (kind === "recover") k = "recover";
      return { t: label, k };
    });
    return r;
  }

  // Format 2: chips: [갭 분석 보기] [AlphaFold2 자세히]
  const chipsMatch = text.match(/chips:\s*(.+)/);
  if (chipsMatch) {
    const raw = chipsMatch[1].trim();
    if (raw === "(없음)" || raw === "없음" || raw.includes("없음")) {
      r.chips = [];
    } else {
      r.chips = [...raw.matchAll(/\[([^\]]+)\]/g)].map((m) => {
        const t = m[1].trim();
        let k = "";
        if (t.includes("갭 분석") || t.includes("PDF 열기")) k = "nav";
        else if (t.includes("다시 검색") || t.includes("현재 결과") || t.includes("전체 요약"))
          k = "recover";
        return { t, k };
      });
    }
  }

  // Format 3: surface: (none) or no surface at all
  if (text.match(/surface:\s*\(none\)/i) || text.match(/surface:\s*없음/)) {
    r.chips = [];
  }

  return r;
}

// ══════════════════════════════════════════════
// feature-specs.md parser — AC ledger + SC catalog
// ══════════════════════════════════════════════

export function parseFeatureSpecs(content) {
  const acLedger = [];
  const scCatalog = [];

  // Parse AC 원장 table
  const acSection = content.match(/## AC 원장\s*\n([\s\S]*?)(?=\n## |$)/);
  if (acSection) {
    const rows = acSection[1].match(/^\|(?!\s*-).+\|$/gm) || [];
    for (const row of rows.slice(1)) {
      // skip header
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length < 5) continue;
      const [us, ac, desc, verPath, status] = cells;
      // Parse verification path: `SC-XXX` → `spec.md`
      const scMatch = verPath.match(/`(SC-[^`]+)`/);
      const specMatches = [...verPath.matchAll(/`([^`]+\.spec\.md)`/g)].map((m) => m[1]);
      acLedger.push({
        us: us || acLedger[acLedger.length - 1]?.us || "",
        ac,
        desc,
        sc: scMatch ? scMatch[1] : "",
        specs: specMatches,
        status: status.trim(),
      });
    }
  }

  // Parse 시나리오 카탈로그 table
  const scSection = content.match(/## 시나리오 카탈로그\s*\n([\s\S]*?)(?=\n## |$)/);
  if (scSection) {
    const rows = scSection[1].match(/^\|(?!\s*-).+\|$/gm) || [];
    for (const row of rows.slice(1)) {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length < 4) continue;
      const [sc, covers, expect, verPath] = cells;
      const specMatches = [...verPath.matchAll(/`([^`]+\.spec\.md)`/g)].map((m) => m[1]);
      scCatalog.push({
        id: sc.replace(/`/g, "").trim(),
        covers: covers.trim(),
        expect: expect.trim(),
        specs: specMatches,
      });
    }
  }

  return { acLedger, scCatalog };
}

// ══════════════════════════════════════════════
// user-stories.md parser — US + AC + chip rules
// ══════════════════════════════════════════════

export function parseUserStories(content) {
  const stories = [];

  // Split by US headers: "#### US-XXX-NN-NN:"
  const blocks = content.split(/^#### /m).slice(1);

  for (const block of blocks) {
    const idMatch = block.match(/^(US-[A-Z]+-\d+-\d+):\s*(.+)/);
    if (!idMatch) continue;

    const us = { id: idMatch[1], title: idMatch[2].trim(), acs: [], chips: [] };

    // Lane
    if (us.id.includes("SEARCH")) us.lane = "search";
    else if (us.id.includes("PDF")) us.lane = "pdf";
    else if (us.id.includes("WEB")) us.lane = "web";

    // ACs
    const acMatches = [...block.matchAll(/^\d+\.\s*(.+)$/gm)];
    acMatches.forEach((m, i) => {
      us.acs.push({ id: `AC${i + 1}`, desc: m[1].trim() });
    });

    // Chip info from tables: "| 칩 1 |" or "| 칩 후보 |"
    const chipMatches = [...block.matchAll(/칩\s*\d?\s*\|\s*"([^"]+)"/g)];
    chipMatches.forEach((m) => {
      const t = m[1].trim();
      let k = "";
      if (t.includes("갭 분석") || t.includes("PDF 열기")) k = "nav";
      us.chips.push({ t, k });
    });

    // Also parse from "칩 후보" section if present
    const chipTable = block.match(/칩 후보[\s\S]*?\n((?:\|.+\n)+)/);
    if (chipTable) {
      const rows = chipTable[1].match(/^\|.+\|$/gm) || [];
      rows.forEach((row) => {
        const cells = row
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);
        if (cells.length >= 2 && cells[0].match(/칩\s*\d/)) {
          const chipDesc = cells[1].replace(/"/g, "").trim();
          // Extract the quoted text
          const quotedMatch = cells[1].match(/"([^"]+)"/);
          if (quotedMatch) {
            const t = quotedMatch[1];
            let k = "";
            if (t.includes("갭 분석")) k = "nav";
            us.chips.push({ t, k });
          }
        }
      });
    }

    stories.push(us);
  }

  return stories;
}

// ══════════════════════════════════════════════
// Build flow graph from parsed data (no LLM)
// ══════════════════════════════════════════════

export function buildFlowFromParsed({ scenarios, featureSpecs, userStories, title }) {
  const lanes = {};
  const nodes = [];
  const edges = [];
  const nodeSet = new Set();

  function addNode(n) {
    if (nodeSet.has(n.id)) return;
    nodeSet.add(n.id);
    nodes.push(n);
  }
  function addEdge(source, target, type = "flow") {
    if (!nodeSet.has(source) || !nodeSet.has(target)) return;
    const key = `${source}→${target}`;
    if (edges.some((e) => e.source === source && e.target === target)) return;
    edges.push({ source, target, type });
  }

  // Define lanes from scenario types
  const laneConfig = {
    search: { label: "SEARCH", color: "#7d9bff" },
    gap: { label: "GAP NETWORK", color: "#40e8d4" },
    pdf: { label: "PDF", color: "#d0a0ff" },
    web: { label: "WEB", color: "#ffaa55" },
  };

  // Determine which lanes are needed
  const usedLanes = new Set(scenarios.map((s) => s.lane).filter(Boolean));
  usedLanes.forEach((l) => {
    if (laneConfig[l]) lanes[l] = laneConfig[l];
  });

  // For each lane, create pipeline nodes
  const laneNodes = {
    search: [
      { id: "s-query", label: "검색 실행", sub: "user query", shape: "circle", col: 0 },
      { id: "s-api", label: "API 호출", sub: "Semantic Scholar", shape: "rect", col: 1 },
      { id: "s-render", label: "결과 렌더링", sub: "10편씩", shape: "rect", col: 2 },
      { id: "s-inline", label: "인라인 분석", sub: "BATCH=5", shape: "rect", col: 2 },
      { id: "s-react", label: "", sub: "", shape: "card", col: 3, w: 190, h: 115 },
    ],
    gap: [
      { id: "g-trigger", label: "갭 분석 시작", sub: "from search", shape: "circle", col: 0 },
      { id: "g-cluster", label: "클러스터링", sub: "의미 기반", shape: "rect", col: 1 },
      { id: "g-score", label: "Gap Score", sub: "Config Model", shape: "rect", col: 2 },
      { id: "g-hypo", label: "Hypothesis", sub: "LLM+fallback", shape: "rect", col: 2 },
      { id: "g-react", label: "", sub: "", shape: "card", col: 3, w: 190, h: 115 },
    ],
    pdf: [
      { id: "p-open", label: "PDF 열기", sub: "user action", shape: "circle", col: 0 },
      { id: "p-extract", label: "섹션 추출", sub: "4섹션+Fig/Table", shape: "rect", col: 1 },
      { id: "p-react", label: "", sub: "", shape: "card", col: 3, w: 190, h: 115 },
    ],
    web: [
      { id: "w-open", label: "웹 열기", sub: "URL import", shape: "circle", col: 0 },
      { id: "w-extract", label: "콘텐츠 추출", sub: "텍스트", shape: "rect", col: 1 },
      { id: "w-react", label: "", sub: "", shape: "card", col: 3, w: 190, h: 100 },
    ],
  };

  const laneEdges = {
    search: [
      ["s-query", "s-api"],
      ["s-api", "s-render"],
      ["s-render", "s-react"],
      ["s-api", "s-inline"],
      ["s-inline", "s-react"],
    ],
    gap: [
      ["g-trigger", "g-cluster"],
      ["g-cluster", "g-score"],
      ["g-score", "g-hypo"],
      ["g-hypo", "g-react"],
    ],
    pdf: [
      ["p-open", "p-extract"],
      ["p-extract", "p-react"],
    ],
    web: [
      ["w-open", "w-extract"],
      ["w-extract", "w-react"],
    ],
  };

  // Place pipeline nodes with row spacing
  Object.entries(laneNodes).forEach(([lane, pipeNodes]) => {
    if (!lanes[lane]) return;
    pipeNodes.forEach((n, i) => {
      const totalInCol = pipeNodes.filter((p) => p.col === n.col).length;
      const idxInCol = pipeNodes.filter((p) => p.col === n.col).indexOf(n);
      addNode({ ...n, lane, row: totalInCol > 1 ? (idxInCol / totalInCol) * 0.6 + 0.1 : 0.3 });
    });
    (laneEdges[lane] || []).forEach(([s, t]) => addEdge(s, t, "flow"));
  });

  // Build chip trees from scenarios
  const reactCardIds = { search: "s-react", gap: "g-react", pdf: "p-react", web: "w-react" };

  // Group scenarios by lane to build chip tree per lane
  Object.keys(lanes).forEach((lane) => {
    const laneScenarios = scenarios.filter((s) => s.lane === lane && s.reaction?.chips?.length > 0);
    const reactId = reactCardIds[lane];
    if (!reactId || !nodeSet.has(reactId)) return;

    // Collect unique L1 chips from all normal scenarios for this lane
    const l1Chips = new Map(); // chipLabel → { chip, scenarios[] }
    laneScenarios.forEach((sc) => {
      if (sc.type === "hard_error") return;
      (sc.reaction?.chips || []).forEach((chip) => {
        if (!l1Chips.has(chip.t)) l1Chips.set(chip.t, { chip, scenarios: [] });
        l1Chips.get(chip.t).scenarios.push(sc);
      });
    });

    let chipRow = 0.05;
    const chipRowStep = 0.9 / Math.max(l1Chips.size, 1);

    l1Chips.forEach(({ chip, scenarios: chipScenarios }, chipLabel) => {
      const chipId = `${lane}-c-${slugify(chipLabel)}`;
      addNode({
        id: chipId,
        lane,
        label: chipLabel,
        sub: "",
        shape: "pill",
        col: 4,
        row: chipRow,
        chipKind: chip.k || "",
      });
      addEdge(reactId, chipId, "tree");

      // Cross-lane navigation
      if (chip.k === "nav" && chipLabel.includes("갭 분석") && nodeSet.has("g-trigger")) {
        addEdge(chipId, "g-trigger", "cross");
      } else if (chip.k === "nav" && chipLabel.includes("PDF") && nodeSet.has("p-open")) {
        addEdge(chipId, "p-open", "cross");
      } else {
        // Replacement card
        const replaceId = `${lane}-r-${slugify(chipLabel)}`;
        addNode({
          id: replaceId,
          lane,
          label: "",
          sub: "",
          shape: "card",
          col: 5,
          row: chipRow,
          w: 160,
          h: 70,
        });
        addEdge(chipId, replaceId, "tree");

        // L2 chips from replaceReaction
        const scWithReplace = chipScenarios.find((sc) => sc.replaceReaction?.chips?.length > 0);
        if (scWithReplace?.replaceReaction?.chips) {
          let l2Row = Math.max(0, chipRow - chipRowStep * 0.3);
          const l2Step =
            (chipRowStep * 0.6) / Math.max(scWithReplace.replaceReaction.chips.length, 1);
          scWithReplace.replaceReaction.chips.forEach((c2) => {
            const c2Id = `${lane}-c2-${slugify(c2.t)}`;
            addNode({
              id: c2Id,
              lane,
              label: c2.t,
              sub: "",
              shape: "pill",
              col: 6,
              row: l2Row,
              chipKind: c2.k || "",
            });
            addEdge(replaceId, c2Id, "tree");
            l2Row += l2Step;
          });
        }
      }
      chipRow += chipRowStep;
    });

    // Error nodes from error scenarios
    laneScenarios
      .filter((s) => s.type === "hard_error" || s.type === "recoverable")
      .forEach((sc) => {
        // Infer error position
      });
  });

  // Add error nodes from scenarios with type hard_error/recoverable
  const errorScenarios = scenarios.filter(
    (s) => s.type === "hard_error" || s.type === "recoverable",
  );
  errorScenarios.forEach((sc) => {
    if (!lanes[sc.lane]) return;
    const errId = `${sc.lane}-err-${sc.id.toLowerCase()}`;
    const isHard = sc.type === "hard_error";
    addNode({
      id: errId,
      lane: sc.lane,
      label: sc.reaction?.title?.slice(0, 15) || sc.id,
      sub: sc.id,
      shape: isHard ? "octagon" : "diamond-sm",
      col: 2,
      row: 0.85,
      err: isHard ? "hard" : "recover",
    });

    // Connect from nearest pipeline node
    const pipeNodes = nodes.filter(
      (n) => n.lane === sc.lane && (n.shape === "rect" || n.shape === "circle"),
    );
    if (pipeNodes.length > 0) {
      addEdge(pipeNodes[pipeNodes.length - 1].id, errId, "error");
    }

    // Recovery chips
    if (sc.type === "recoverable" && sc.reaction?.chips?.length > 0) {
      sc.reaction.chips.forEach((chip) => {
        const chipId = `${sc.lane}-rec-${slugify(chip.t)}`;
        addNode({
          id: chipId,
          lane: sc.lane,
          label: chip.t,
          sub: "",
          shape: "pill",
          col: 4,
          row: 0.9,
          chipKind: chip.k || "recover",
        });
        addEdge(errId, chipId, "tree");
      });
    }
  });

  // Build scenario paths
  const outputScenarios = scenarios.map((sc) => {
    const path = buildPath(sc, nodes, edges);
    const reactNode = reactCardIds[sc.lane] || null;
    // Find replacement card if exists
    let replaceNode = null;
    if (sc.reaction?.chips?.length > 0 && sc.type === "normal") {
      const firstChip = sc.reaction.chips[0];
      const replaceId = `${sc.lane}-r-${slugify(firstChip.t)}`;
      if (nodeSet.has(replaceId)) replaceNode = replaceId;
    }

    return {
      id: sc.id,
      lane: sc.lane,
      label: sc.label,
      type: sc.type,
      path,
      situation: sc.situation,
      reaction: sc.reaction || { title: "", body: "", chips: [] },
      replaceReaction: sc.replaceReaction || null,
      reactNode,
      replaceNode,
    };
  });

  return {
    title: title || "Project",
    subtitle: "Mechanically parsed from contract documents",
    lanes,
    nodes,
    edges,
    scenarios: outputScenarios,
  };
}

function buildPath(sc, nodes, edges) {
  const lane = sc.lane;
  const pipelineOrder = {
    search: ["s-query", "s-api", "s-render", "s-inline", "s-react"],
    gap: ["g-trigger", "g-cluster", "g-score", "g-hypo", "g-react"],
    pdf: ["p-open", "p-extract", "p-react"],
    web: ["w-open", "w-extract", "w-react"],
  };

  const nodeIds = new Set(nodes.map((n) => n.id));
  const pipeline = (pipelineOrder[lane] || []).filter((id) => nodeIds.has(id));

  if (sc.type === "hard_error" || sc.type === "recoverable") {
    const errNode = nodes.find((n) => n.sub === sc.id && n.lane === lane);
    if (errNode) {
      // Path up to error node
      const errIdx = pipeline.length - 1; // attach near end of pipeline
      return [...pipeline.slice(0, errIdx), errNode.id];
    }
  }

  if (sc.type === "navigation" && lane === "search") {
    // Search → gap cross
    const gapPipeline = (pipelineOrder.gap || []).filter((id) => nodeIds.has(id));
    const chipNode = nodes.find(
      (n) => n.lane === "search" && n.shape === "pill" && n.chipKind === "nav",
    );
    if (chipNode) return ["s-react", chipNode.id, ...gapPipeline];
  }

  // Normal: pipeline → first chip → replacement
  const path = [...pipeline];
  if (sc.reaction?.chips?.length > 0 && sc.type === "normal") {
    const firstChip = sc.reaction.chips[0];
    const chipId = `${lane}-c-${slugify(firstChip.t)}`;
    if (nodeIds.has(chipId)) {
      path.push(chipId);
      const replaceId = `${lane}-r-${slugify(firstChip.t)}`;
      if (nodeIds.has(replaceId)) path.push(replaceId);
    }
  }

  return path;
}

function slugify(s) {
  return s
    .replace(/[^a-zA-Z0-9가-힣]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}
