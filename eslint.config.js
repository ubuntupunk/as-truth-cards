import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-refresh': reactRefresh,
      'prettier': eslintPluginPrettier, // Add the prettier plugin
    },
    rules: {
      'no-case-declarations': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ],
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'error',
      '@next/next/no-unwanted-polyfillio': 'error',
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          semi: false,
          trailingComma: 'es5',
          tabWidth: 2,
          printWidth: 100,
          bracketSpacing: true,
          endOfLine: 'auto',
        },
      ],
      '@typescript-eslint/no-unused-vars': 'off', // Disable the rule
      '@next/next/no-img-element': 'off', // Disable the rule
    },
    settings: {
      next: {
        rootDir: ['./'],
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
];
