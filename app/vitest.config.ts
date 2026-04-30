import { defineConfig } from 'vitest/config';

// Pure-JS unit tests for `src/lib/format.ts` etc. — node env, no DOM needed.
// Playwright owns E2E (`tests/`); vitest only collects `*.test.ts` under `src/`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
