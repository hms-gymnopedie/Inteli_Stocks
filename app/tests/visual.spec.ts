import { test, expect, type Page } from '@playwright/test';

/**
 * Visual regression suite — STEP 2 (skeleton).
 *
 * Single capture: /overview at desktop, no clock mock. Just enough to
 * prove the snapshot framework works end-to-end and produce the first
 * baseline file.
 *
 * Subsequent steps will:
 *   - add tablet + mobile viewports
 *   - install page.clock so the LiveClock and "Xs ago" suffixes are stable
 *   - cover the other routes (/portfolio, /geo, /detail, /detail/AAPL,
 *     /settings) and the ⌘K modal
 *
 * Re-baseline locally with `npm run test:visual:update`.
 */

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
 * it flips to `live`. We wait for either terminal state.
 */
async function waitForFetchSettled(page: Page) {
  const indicator = page.locator('.fetch-indicator');
  if ((await indicator.count()) === 0) return;
  await expect
    .poll(
      async () => {
        const cls = (await indicator.first().getAttribute('class')) ?? '';
        return cls.includes('loading');
      },
      { timeout: 10_000, message: 'fetch indicator never left loading' },
    )
    .toBe(false);
}

test.describe('Visual regression — skeleton', () => {
  test('overview @ desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/overview');
    await waitForFetchSettled(page);
    await freezeAnimations(page);
    await page.evaluate(() => document.fonts?.ready);
    await expect(page).toHaveScreenshot('overview-desktop.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });
});
