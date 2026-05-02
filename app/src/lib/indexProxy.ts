/**
 * Maps non-tradable index symbols to their commonly-used tradable ETF proxy
 * so the user can navigate from an IndicesStrip cell to a Detail page that
 * actually has a quoteable instrument.
 *
 * Returning `null` means there's no sensible proxy and the click should be
 * a no-op rather than navigating to a 404 / blank Detail page.
 */
const PROXIES: Record<string, string> = {
  '^GSPC': 'SPY',   // S&P 500 → SPDR S&P 500 ETF
  '^IXIC': 'QQQ',   // NASDAQ Composite → Invesco QQQ Trust
  '^DJI':  'DIA',   // Dow Jones Industrial → SPDR DJIA Trust
  '^VIX':  'VIXY',  // CBOE Volatility Index → ProShares VIX ST Futures
  '^TNX':  'TLT',   // 10-Year Treasury Yield → iShares 20+ Yr Treasury Bond
  '^KS11': 'EWY',   // KOSPI → iShares MSCI South Korea ETF
  '^KQ11': 'EWY',   // KOSDAQ → iShares MSCI South Korea ETF (closest proxy)
};

/**
 * Returns the tradable proxy ticker for an index symbol, or null if there's
 * no sensible proxy. Callers should treat null as "do nothing" rather than
 * navigating to /detail/<garbage>.
 */
export function indexToProxy(symbol: string): string | null {
  return PROXIES[symbol] ?? null;
}
