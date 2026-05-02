/**
 * Extract flow structure from contract documents using LLM.
 */
import { callLLM } from "./llm.mjs";

const PROMPT = `You are a system architecture analyst. Given the project specification documents below, extract the complete flow structure for an interactive visualization.

The visualization has:
- **Lanes**: Horizontal swimlanes, each representing a major epic or feature area
- **Nodes**: States in the system (triggers, processes, reactions/outputs, interaction chips, errors)
- **Edges**: Connections between nodes (flow, tree branching, error paths, cross-lane)
- **Scenarios**: Named paths through the graph with descriptions

Output a single JSON object with this exact schema:

\`\`\`json
{
  "title": "Project name",
  "subtitle": "One-line description",
  "lanes": {
    "lane_id": { "label": "DISPLAY NAME", "color": "#hex" }
  },
  "nodes": [
    {
      "id": "unique-id",
      "lane": "lane_id",
      "label": "Node label (short)",
      "sub": "Subtitle text",
      "shape": "circle|rect|pill|card|octagon|diamond-sm",
      "col": 0,
      "row": 0.0,
      "chipKind": "nav|recover|''",
      "err": "hard|recover|null",
      "w": 190,
      "h": 115
    }
  ],
  "edges": [
    { "source": "node-id", "target": "node-id", "type": "flow|tree|error|cross" }
  ],
  "scenarios": [
    {
      "id": "SC1",
      "lane": "lane_id",
      "label": "Short description",
      "type": "normal|hard_error|recoverable|navigation|progress",
      "path": ["node-id", "node-id"],
      "situation": "Context description (Given/When context)",
      "reaction": {
        "title": "Output/result title",
        "body": "Expected behavior or output description",
        "chips": [{ "t": "Action label", "k": "nav|recover|none|''" }]
      },
      "replaceReaction": null,
      "reactNode": "node-id-of-card-or-null",
      "replaceNode": "node-id-of-replacement-card-or-null"
    }
  ]
}
\`\`\`

Rules:
1. **Shapes**: "circle" for user-triggered entry points, "rect" for processing steps, "card" for output/reaction displays (needs w/h), "pill" for interaction buttons/chips, "octagon" for hard errors (unrecoverable), "diamond-sm" for recoverable errors.
2. **col**: Integer column index (0=trigger, 1=process, 2=process+, 3=output/reaction, 4=interactions-L1, 5=result-L1, 6=interactions-L2). Used for x-positioning.
3. **row**: Float 0.0 to 1.0 for vertical position within the lane. Space nodes evenly.
4. **Edge types**: "flow" for normal pipeline, "tree" for branching interactions, "error" for exception paths, "cross" for inter-lane connections.
5. **Chip tree branching (CRITICAL)**: Every reaction "card" node MUST have follow-up "pill" nodes representing the user's next actions (chips, buttons). This is the most important visual feature.
   - **L1 branching**: Each reaction card → 2-3 pill nodes (col 4). Each pill → a replacement card (col 5, w:160 h:70).
   - **L2 branching**: Each replacement card → 2-3 more pill nodes (col 6). This shows the depth of user exploration.
   - Structure: card(col3) →tree→ pill(col4) →tree→ card(col5) →tree→ pill(col6)
   - If the documents describe AI reaction scenarios with chips (like "갭 분석 보기", "방법 분석", "클러스터별 정리"), each chip MUST be a separate pill node.
   - NEVER skip L2 branching. Every replacement card should have at least 2 pill children.
6. **Scenarios**: Each GWT scenario or user story flow is a path through nodes. The path MUST extend through the chip tree — from trigger all the way to L1 or L2 pills. Include replaceReaction for scenarios that go through replacement cards.
7. **Colors**: Use distinct, vibrant colors for each lane. Blues, teals, purples, oranges, greens.
8. Cards: w:190 h:115 for main outputs, w:160 h:70 for secondary results.
9. If documents use Given-When-Then format, map Given→trigger/process setup, When→action node, Then→output card.
10. Include error/edge case scenarios. Every node in a path must exist in the nodes array.
11. Create max 5-7 lanes even if there are many epics — group related epics into lanes.
12. Extract AT LEAST 15 scenarios. For each epic, include the primary happy path + 1-2 error paths. Map GWT scenarios (SC-*) directly.
13. Every lane MUST have at least one FULL chip tree: card → 3 pills → 2 replacement cards → 2-3 L2 pills each.
14. Output must be LARGE and detailed. Aim for 50+ nodes, 50+ edges, 15+ scenarios. Most of the nodes should be pill and card nodes in the chip trees.

Be thorough but practical. The visualization must be readable.`;

export async function extractFlow(files, { model, title } = {}) {
  const content = files.map((f) => `## ${f.name}\n\n${f.content}`).join("\n\n---\n\n");
  console.log(`  Extracting flow (${Math.round(content.length / 1024)}KB)...`);
  const data = await callLLM(PROMPT, content, { model });
  if (title) data.title = title;
  if (!data.lanes) data.lanes = {};
  if (!data.nodes) data.nodes = [];
  if (!data.edges) data.edges = [];
  if (!data.scenarios) data.scenarios = [];
  return data;
}
