/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-execution-to-agent",
      severity: "error",
      comment: "Execution Plane must not import Agent Plane",
      from: { path: "^src/execution" },
      to: { path: "^src/agent" },
    },
    {
      name: "no-agent-to-app",
      severity: "error",
      comment: "Agent Plane must not import Product Plane routes",
      from: { path: "^src/agent" },
      to: { path: "^src/app" },
    },
    {
      name: "no-agent-to-features",
      severity: "error",
      comment: "Agent Plane must not import UI features",
      from: { path: "^src/agent" },
      to: { path: "^src/features" },
    },
    {
      name: "no-agent-to-stores",
      severity: "error",
      comment: "Agent Plane must not import client stores",
      from: { path: "^src/agent" },
      to: { path: "^src/stores" },
    },
    {
      name: "no-execution-to-features",
      severity: "error",
      comment: "Execution Plane must not import UI features",
      from: { path: "^src/execution" },
      to: { path: "^src/features" },
    },
    {
      name: "no-execution-to-stores",
      severity: "error",
      comment: "Execution Plane must not import client stores",
      from: { path: "^src/execution" },
      to: { path: "^src/stores" },
    },
    {
      name: "no-core-to-product",
      severity: "error",
      comment: "Core (domain, agent, execution, lib) must not import product",
      from: { path: "^src/(domain|agent|execution|lib)" },
      to: { path: "^src/product" },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "No circular dependencies",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
