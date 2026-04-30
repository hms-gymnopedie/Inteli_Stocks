import { test, expect, type Page } from '@playwright/test';

/**
 * Visual regression suite.
 *
 * Captures a deterministic screenshot per (route, viewport) combo and
 * compares against committed baselines under tests/__screenshots__/.
 *
 * Determinism strategy:
 *   1. `page.clock.install` pins time so the topbar LiveClock and any
 *      "12s ago" suffix in the FetchIndicator render the same bytes
 *      every run.
 *   2. Animations are globally disabled via toHaveScreenshot defaults
 *      AND we inject a stylesheet that nukes transitions, animations,
 *      and caret colour for components that style themselves with
 *      `animation:` shorthands the screenshot freezer doesn't catch
 *      (e.g. the FetchIndicator dot pulse).
 *   3. We wait for the FetchIndicator to leave the `loading` state so
 *      the initial fetch storm has drained — the data-driven panels
 *      render their settled output, not skeletons.
 *   4. Viewports are pinned exactly (no devicePixelRatio surprises).
 *
 * Re-baseline locally with `npm run test:visual:update`.
 */

/** Frozen wall clock — Thursday, 30 April 2026, 13:42:18 UTC. */
const FROZEN_TIME = new Date('2026-04-30T13:42:18Z');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 900, height: 1100 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const ROUTES = [
  { name: 'overview', path: '/overview' },
  { name: 'portfolio', path: '/portfolio' },
  { name: 'geo', path: '/geo' },
  { name: 'detail-default', path: '/detail' },
  { name: 'detail-aapl', path: '/detail/AAPL' },
  { name: 'settings', path: '/settings' },
] as const;

/**
 * Inject CSS that freezes everything that could shimmer between runs:
 *  - keyframe animations (FetchIndicator dot pulse, refresh-button spin)
 *  - transitions (hover focus rings, theme switches)
 *  - blinking caret in any input
 */
async function freezeAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

/**
 * Wait for the topbar FetchIndicator to leave the `loading` state. On
 * first paint the indicator is `idle` ("Waiting"); once a fetch lands
 * it flips to `live`. We wait for either terminal state — but bail
 * gracefully after a reasonable timeout: long-lived SSE streams (Geo
 * Risk's streamAlerts, Overview's streamSignals/streamInsights) stay
 * accounted for as "pending" even after their first chunk arrives, so
 * the indicator may never go to `live` until the stream ends. After
 * the bail-out, we still capture the page — the panels themselves
 * render their settled output regardless of the indicator class.
 */
async function waitForFetchSettled(page: Page) {
  const indicator = page.locator('.fetch-indicator');
  if ((await indicator.count()) === 0) return;
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const cls = (await indicator.first().getAttribute('class')) ?? '';
    if (!cls.includes('loading')) return;
    await page.waitForTimeout(200);
  }
  // Indicator stuck on loading (likely an SSE stream is still open).
  // That's OK — proceed to capture; data panels are independently
  // settled and the indicator itself is frozen by freezeAnimations
  // before we screenshot.
}

/**
 * Common setup: install fake clock BEFORE goto, set viewport, navigate,
 * wait for fetch storm to drain, freeze animations, wait for fonts.
 *
 * Clock has to land before goto so React's first render already sees
 * the frozen time — otherwise the LiveClock / ageSeconds counters would
 * tick once before we freeze.
 */
async function preparePage(
  page: Page,
  path: string,
  width: number,
  height: number,
) {
  await page.clock.install({ time: FROZEN_TIME });
  await page.setViewportSize({ width, height });
  await page.goto(path);
  await waitForFetchSettled(page);
  await freezeAnimations(page);
  await page.evaluate(() => document.fonts?.ready);
}

test.describe('Visual regression — routes × viewports', () => {
  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      test(`${route.name} @ ${viewport.name}`, async ({ page }) => {
        await preparePage(page, route.path, viewport.width, viewport.height);
        await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
          fullPage: true,
          animations: 'disabled',
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  }
});

test.describe('Visual regression — ⌘K modal overlay', () => {
  for (const viewport of VIEWPORTS) {
    test(`overview cmdk @ ${viewport.name}`, async ({ page }) => {
      await preparePage(page, '/overview', viewport.width, viewport.height);
      // Open the global ⌘K search modal. The SymbolSearch listener
      // accepts either Meta+K (macOS) or Ctrl+K — Meta is canonical.
      await page.keyboard.press('Meta+K');
      // Wait for the modal node to mount + become visible. The modal
      // is portalled to the App shell (not a separate overlay root).
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      // Re-freeze animations after the modal mounts: it ships its own
      // backdrop blur transition that the earlier injection didn't
      // cover for newly-inserted nodes.
      await freezeAnimations(page);
      await expect(page).toHaveScreenshot(`overview-cmdk-${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
