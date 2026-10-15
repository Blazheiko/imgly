import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.ts'],
      restoreMocks: true,
      // Vitest skips CSS by default, which empties a `?raw` import; the token tests read tokens.css.
      css: { include: [/tokens\.css/] },
    },
  }),
)
