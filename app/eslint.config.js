import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

const featureNames = ['upload', 'transcription', 'export', 'history', 'realtime']

const crossFeatureDeepImportRules = featureNames.map((feature) => ({
  files: [`src/features/${feature}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: featureNames
          .filter((name) => name !== feature)
          .flatMap((name) => [`@/features/${name}/*`, `@/features/${name}/**`]),
      },
    ],
  },
}))

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Allow underscore-prefixed unused vars (e.g. _event)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Enforce consistent type imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],
      // Warn on console.log (allow warn/error)
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
    },
  },
  // shadcn/ui generated files co-export components and variant helpers by design
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Keep common components feature-agnostic.
  {
    files: ['src/components/common/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@/features/*', '@/features/*/**'],
        },
      ],
    },
  },
  // Enforce feature public API imports outside feature internals.
  {
    files: [
      'src/App.tsx',
      'src/main.tsx',
      'src/routes/**/*.{ts,tsx}',
      'src/shared/**/*.{ts,tsx}',
      'src/config/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@/features/*/**'],
        },
      ],
    },
  },
  ...crossFeatureDeepImportRules,
  prettierConfig,
])
