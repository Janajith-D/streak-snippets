import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  js.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked,

  eslintConfigPrettier,

  {
    files: ["**/*.ts", "**/*.tsx"],

    languageOptions: {
      parser: tseslint.parser,

      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },

      ecmaVersion: "latest",
      sourceType: "module",
    },

    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "unused-imports": unusedImports,
    },

    rules: {
      /*
       * Existing Rules
       */
      curly: "warn",
      eqeqeq: "warn",
      semi: "warn",
      "no-throw-literal": "warn",

      /*
       * General Quality
       */
      "no-console": "off",

      "no-duplicate-imports": "warn",

      "no-unreachable": "error",

      "no-var": "error",

      "prefer-const": "warn",

      "object-shorthand": "warn",

      "prefer-template": "warn",

      /*
       * TypeScript
       */
      "@typescript-eslint/no-explicit-any": "warn",

      "@typescript-eslint/no-empty-function": "warn",

      "@typescript-eslint/no-non-null-assertion": "warn",

      "@typescript-eslint/consistent-type-imports": "warn",

      /*
       * VS Code Extension / LSP Safety
       */
      "@typescript-eslint/no-floating-promises": "error",

      "@typescript-eslint/await-thenable": "error",

      "@typescript-eslint/no-misused-promises": "error",

      /*
       * Unused Imports
       */
      "unused-imports/no-unused-imports": "warn",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];