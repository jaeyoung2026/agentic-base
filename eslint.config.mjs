import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "max-lines": ["error", { max: 700, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 350, skipBlankLines: true, skipComments: true }],
    },
  },
  globalIgnores(["specs/**", "scripts/**", ".codex/**", ".claude/**", "coverage/**"]),
]);

export default eslintConfig;
