import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([
  // Base ESLint and TypeScript configurations
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Next.js plugin configuration (should come early)
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Custom overrides
      "@next/next/no-html-link-for-pages": "error",
      "@next/next/no-img-element": "off",
      "@next/next/no-unwanted-polyfillio": "error",
    },
    settings: {
      next: {
        rootDir: "./",
      },
    },
  },

  // General configuration for all JS/TS/JSX/TSX files
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ignores: [
      "node_modules/**", ".next/**", "**/*.next", "**/*.config.js",
      "!**/eslint.config.mjs", "prisma/**", "public/**", "out/**",
      "coverage/**", "build/**", "dist/**", ".turbo/**", ".vercel/**",
      ".idea/**", ".vscode/**", ".DS_Store", "package-lock.json",
      "yarn.lock", "pnpm-lock.yaml", "*.env", ".env*",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readonly",
        JSX: "readonly",
      },
    },
    plugins: {
      "react-refresh": reactRefresh,
      // prettier plugin defined later
    },
    rules: {
      "no-case-declarations": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "warn", // Keep warning for unused vars
      // Prettier rule will be handled by the prettier config object below
    },
    settings: {
      react: { version: "detect" },
    },
  },

  // Prettier configuration (must be last)
  prettier,
  // Add prettier plugin rules here explicitly after the config
  {
      plugins: {
          prettier: eslintPluginPrettier
      },
      rules: {
          "prettier/prettier": [
              "error",
              {
                  singleQuote: true,
                  semi: false,
                  trailingComma: "es5",
                  tabWidth: 2,
                  printWidth: 100,
                  bracketSpacing: true,
                  endOfLine: "auto",
              },
          ],
      }
  }
]);
