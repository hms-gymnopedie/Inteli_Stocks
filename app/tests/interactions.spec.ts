import { test, expect } from '@playwright/test';

test.describe('Interactions — wired sections respond to user input', () => {
  test('Overview · clicking an index navigates to /detail', async ({ page }) => {
    await page.goto('/overview');
    // The IndicesStrip cells are <button> elements — click the S&P 500 one
    // and expect a route change to /detail.
    const firstIndexButton = page
      .getByRole('button')
      .filter({ hasText: 'S&P 500' })
      .first();
    await firstIndexButton.click();
    await expect(page).toHaveURL(/\/detail/);
  });

  test('Overview · HeroChart range tab is selectable', async ({ page }) => {
    await page.goto('/overview');
    // Range tabs are <div role="tab">. The "1M" name appears in both
    // HeroChart and (later) other panels, so scope to the first matching tab.
    const oneMonth = page.getByRole('tab', { name: '1M', exact: true }).first();
    await oneMonth.click();
    await expect(oneMonth).toHaveClass(/active/);
  });

  test('Portfolio · sort by clicking a column header', async ({ page }) => {
    await page.goto('/portfolio');
    await expect(page.getByText('NVIDIA Corp').first()).toBeVisible();
    // Header label is rendered with a sort-arrow suffix when active. Click
    // "TICKER" (currently inactive) to sort by symbol.
    const tickerHeader = page.getByText(/^TICKER/).first();
    await tickerHeader.click();
    // After sort, the table should still contain a known holding.
    await expect(page.getByText('NVIDIA Corp').first()).toBeVisible();
  });

  test('Portfolio · filter input narrows the holdings list', async ({ page }) => {
    await page.goto('/portfolio');
    await expect(page.getByText('NVIDIA Corp').first()).toBeVisible();
    const filter = page.locator('input[type="text"], input[type="search"]').first();
    await filter.fill('NVDA');
    await expect(page.getByText('NVIDIA Corp')).toBeVisible();
    // Apple should be filtered out
    await expect(page.getByText('Apple Inc')).toHaveCount(0);
  });

  test('Detail · range tab "1Y" activates', async ({ page }) => {
    await page.goto('/detail');
    const oneYear = page.getByRole('tab', { name: '1Y', exact: true }).first();
    await oneYear.click();
    await expect(oneYear).toHaveClass(/active/);
  });

  test('Tweaks · accent color change reflects on --orange CSS var', async ({
    page,
  }) => {
    await page.goto('/overview');
    // Open the Tweaks panel via the FAB
    await page.getByRole('button', { name: /Tweaks/i }).click();
    // The color input is the only <input type="color"> on the page.
    const colorInput = page.locator('input[type="color"]');
    await expect(colorInput).toBeVisible();
    // `fill` on a color input is the canonical way; Playwright dispatches
    // proper input + change events that React's onChange handler picks up.
    await colorInput.fill('#22cc99');
    await expect
      .poll(async () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--orange')
            .trim()
            .toLowerCase(),
        ),
      )
      .toBe('#22cc99');
  });

  test('Tweaks · density change updates body font-size', async ({ page }) => {
    await page.goto('/overview');
    await page.getByRole('button', { name: /Tweaks/i }).click();
    // Click "Cmp" (compact) under Density
    const compact = page.getByRole('button', { name: 'Cmp', exact: true });
    await compact.click();
    const fontSize = await page.evaluate(
      () => document.body.style.fontSize || getComputedStyle(document.body).fontSize,
    );
    expect(fontSize).toBe('11px');
  });
});
