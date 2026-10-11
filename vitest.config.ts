import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only this repo's tests. Without this, `aqe init` installs fixture tests
    // under .claude/ and they join every run.
    include: ['tests/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Coverage is about the ECU update module, not the tooling installed beside it.
      include: ['src/**/*.ts'],
      exclude: ['node_modules/', '.claude/**', '.agentic-qe/**', '**/*.config.{js,ts}'],
    },
  },
})
