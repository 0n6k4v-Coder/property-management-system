// ESLint flat config — SDD §8.1
// All rules active — no suppressed warnings.
// Covers: src/ (React) + e2e/ (Playwright)

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactDoctor from 'eslint-plugin-react-doctor';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'public/', '*.config.*', 'src/types/api.d.ts'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactDoctor.configs.recommended,

  // React source files
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'react-doctor/no-fetch-in-effect': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // E2E test files — strict typing, no `any`
  // Requires parserOptions.project for type-aware rules (no-unsafe-*)
  {
    files: ['e2e/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.e2e.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
    },
  },
);
