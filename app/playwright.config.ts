import { defineConfig, devices } from '@playwright/test';

const PORT = 5180;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  // Visual-regression friendly defaults: keep snapshot diffs strict but
  // tolerate sub-pixel anti-aliasing and disable animations globally so
  // pulses/spinners don't introduce noise between runs.
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.02,
      // Allow tiny per-pixel intensity wobble — anti-aliased edges differ
      // slightly even on the same machine across font cache states.
      threshold: 0.2,
    },
  },
  // Pin snapshot file naming so baselines live next to the spec under
  // tests/__screenshots__/<spec>/<name>.png (no project / platform suffix).
  // Self-hosted baselines are taken on this developer's machine; CI is not
  // running visual regression yet (B4-CI does not include it).
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // From the app/ directory, run the root npm workspace dev script so both
    // Vite (5180) and the Express API (3001) come up together.
    command: 'npm run dev --prefix ..',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
