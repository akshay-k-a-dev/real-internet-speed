import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        AbortController: "readonly",
        Blob: "readonly",
        document: "readonly",
        fetch: "readonly",
        performance: "readonly",
        ReadableStream: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        window: "readonly"
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "no-unused-vars": "off"
    }
  }
];
