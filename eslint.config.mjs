import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "node_modules/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      globals: {
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        URL: "readonly",
        window: "readonly",
      },
    },
  },
]);
