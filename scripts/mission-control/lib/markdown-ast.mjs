/**
 * Markdown AST 헬퍼 — remark 기반.
 *
 * Phase 2의 regex 파싱은 fragile하다(`####`, `Verdict:`, `|` 코드블록 안 매칭 등).
 * 이 모듈은 unified + remark-parse + remark-frontmatter + remark-gfm으로
 * 정확한 AST를 만들고, validator가 기대하는 shape으로 정규화한다.
 */

import YAML from "yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { toString as mdastToString } from "mdast-util-to-string";

const processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);

export function parseMarkdown(markdown) {
  return processor.parse(markdown);
}

export function getFrontmatter(ast) {
  const node = ast.children.find((child) => child.type === "yaml");
  if (!node) return {};
  try {
    return YAML.parse(node.value ?? "") ?? {};
  } catch {
    return {};
  }
}

export function nodeToString(node) {
  return mdastToString(node).trim();
}

function isHeading(node, depth) {
  return node.type === "heading" && (depth === undefined || node.depth === depth);
}

export function getSection(ast, depth, headingText) {
  const target = headingText.trim().toLowerCase();
  const children = ast.children;
  let startIndex = -1;

  for (let i = 0; i < children.length; i += 1) {
    if (!isHeading(children[i], depth)) continue;
    if (nodeToString(children[i]).toLowerCase() !== target) continue;
    startIndex = i;
    break;
  }
  if (startIndex === -1) return [];

  const result = [];
  for (let i = startIndex + 1; i < children.length; i += 1) {
    if (children[i].type === "heading" && children[i].depth <= depth) break;
    result.push(children[i]);
  }
  return result;
}

export function hasSection(ast, depth, headingText) {
  const target = headingText.trim().toLowerCase();
  return ast.children.some(
    (child) => isHeading(child, depth) && nodeToString(child).toLowerCase() === target,
  );
}

export function getSubsections(nodes, depth) {
  const subsections = [];
  let current = null;
  for (const node of nodes) {
    if (isHeading(node, depth)) {
      if (current) subsections.push(current);
      current = { heading: nodeToString(node), nodes: [] };
      continue;
    }
    if (current) current.nodes.push(node);
  }
  if (current) subsections.push(current);
  return subsections;
}

export function getTableRows(nodes) {
  const tableNode = nodes.find((node) => node.type === "table");
  if (!tableNode || tableNode.children.length < 2) return [];

  const headers = tableNode.children[0].children.map((cell) =>
    nodeToString(cell).toLowerCase().trim(),
  );

  return tableNode.children.slice(1).flatMap((row) => {
    const cells = row.children.map((cell) => nodeToString(cell).trim());
    if (cells.every((cell) => cell === "")) return [];
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return [record];
  });
}

/**
 * run:shell code blocks를 추출한다. lang은 "run:shell" 또는 "run" + meta="shell" 둘 다 허용.
 * 가장 가까운 상위 ### 헤딩을 함께 기록한다.
 */
export function getRunShellBlocks(nodes) {
  const blocks = [];
  let currentHeading = "run";
  for (const node of nodes) {
    if (node.type === "heading" && node.depth === 3) {
      currentHeading = nodeToString(node);
      continue;
    }
    if (node.type !== "code") continue;
    const lang = node.lang ?? "";
    const meta = node.meta ?? "";
    const isRunShell = lang === "run:shell" || (lang === "run" && meta === "shell");
    if (!isRunShell) continue;
    const command = (node.value ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("#"))
      ?.replace(/^\$\s*/, "");
    if (command) blocks.push({ heading: currentHeading, command });
  }
  return blocks;
}

/**
 * 한 노드 그룹에서 인라인 코드(`promise:foo` 등) 모두 모아준다.
 * Sufficiency Review 같은 산문 안의 `evidence: ...` 검출용.
 */
export function collectInlineCode(nodes) {
  const out = [];
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "inlineCode" && typeof node.value === "string") {
      out.push(node.value);
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return out;
}

/**
 * 한 섹션의 list item을 [`- Verdict: met`, `- Evidence: ...`] 형태로 평평하게 추출.
 */
export function getListItemTexts(nodes) {
  const texts = [];
  for (const node of nodes) {
    if (node.type !== "list") continue;
    for (const item of node.children) {
      texts.push(nodeToString(item).trim());
    }
  }
  return texts;
}
