import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['dist/', 'dev-dist/', 'coverage/', 'playwright-report/', 'test-results/', 'docs/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    rules: {
      // Shared primitives named by the screens manifests (docs/design-system.md inventory).
      'vue/multi-word-component-names': ['error', { ignores: ['Dialog', 'Spinner', 'Toast'] }],
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['*.config.{js,ts}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // ADR 0002: the functional core stays pure — no Vue, no Pinia, no outer layers.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'vue', message: 'src/core must not depend on Vue (ADR 0002).' },
            { name: 'pinia', message: 'src/core must not depend on Pinia (ADR 0002).' },
          ],
          patterns: [
            {
              group: [
                '@/features',
                '@/features/*',
                '@/infra',
                '@/infra/*',
                '@/render',
                '@/render/*',
              ],
              message: 'src/core must not import features, infra or render (ADR 0002).',
            },
          ],
        },
      ],
    },
  },
  prettier,
)
