import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...nextTypescript,
  {
    ignores: [".maintenance/**", ".next/**", "out/**", ".pages-preview/**", "node_modules/**", "coverage/**"]
  }
];

export default eslintConfig;
