import { test, expect, type Page } from '@playwright/test';

/** Fail the test if any uncaught JS error / unexpected console.error fires.
 *  Filters out browser-level "Failed to load resource" lines which are
 *  environmental (e.g. Yahoo Finance rate-limits / IP blocks on CI runners,
 *  503s from FRED/Anthropic when API keys aren't configured) and aren't
 *  React or app-level bugs. The data layer already falls back to mock data
 *  on 5xx, so these failures don't break the UI — only the noisy log line. */
function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.startsWith('Failed to load resource:')) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

test.describe('Smoke — every route renders without console errors', () => {
  test('shell loads the brand and nav', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto('/');
    await expect(page.getByText('InteliStock', { exact: true })).toBeVisible();
    for (const label of ['Overview', 'Portfolio', 'Geo Risk', 'Detail']) {
      await expect(
        page.getByRole('link', { name: label, exact: true }),
      ).toBeVisible();
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('Overview shows tickers, sectors, macro', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto('/overview');
    // Indices strip — "S&P 500" appears in HeroChart label and SectorHeat
    // label too, so scope to the first match.
    await expect(page.getByText('S&P 500').first()).toBeVisible();
    await expect(page.getByText('KOSPI')).toBeVisible();
    // Macro
    await expect(page.getByText('CPI YoY')).toBeVisible();
    // Sector heatmap (one of the constituents)
    await expect(page.getByText('NVDA').first()).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('Portfolio shows NAV and holdings table', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto('/portfolio');
    await expect(page.getByText(/Net Asset Value/i)).toBeVisible();
    // Holdings header columns. The default-sorted column appends " ↓" so use
    // a prefix regex.
    await expect(page.getByText(/^TICKER/).first()).toBeVisible();
    await expect(page.getByText(/^WEIGHT/).first()).toBeVisible();
    // First row symbol from mock data
    await expect(page.getByText('NVDA').first()).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('Geo Risk shows the world map and hotspots', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto('/geo');
    await expect(page.getByText('GLOBAL RISK INDEX')).toBeVisible();
    // The TopoJSON map renders an SVG with at least one country path —
    // assert presence of the map container's SVG.
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
    // A known hotspot
    await expect(page.getByText(/Taiwan Strait/)).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('Detail shows NVDA header, valuation, peers', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto('/detail');
    await expect(page.getByText('NVIDIA Corp')).toBeVisible();
    await expect(page.getByText(/MKT CAP/)).toBeVisible();
    await expect(page.getByText('AMD').first()).toBeVisible(); // peer
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('API /api/health responds via Vite proxy', async ({ request }) => {
    const r = await request.get('/api/health');
    expect(r.ok()).toBe(true);
    const body = (await r.json()) as { ok: boolean; version: string };
    expect(body.ok).toBe(true);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
