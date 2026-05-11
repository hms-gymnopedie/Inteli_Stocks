const GITHUB_URL = "https://github.com/hms-gymnopedie/Inteli_Stocks";
const WAITLIST_HREF =
  "mailto:gymnopedies7@naver.com?subject=InteliStock%20waitlist";

type Demo = {
  slug: string;
  caption: string;
  placeholder: string;
};

const DEMOS: Demo[] = [
  {
    slug: "geo-drawer",
    caption: "a. Click a region for live news + ETFs",
    placeholder: "demo recording coming",
  },
  {
    slug: "ai-hedge",
    caption: "b. AI hedge from your real holdings",
    placeholder: "demo recording coming",
  },
  {
    slug: "copy-to-portfolio",
    caption: "c. One-click strategy → portfolio",
    placeholder: "demo recording coming",
  },
];

type Feature = {
  num: string;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    num: "01",
    title: "One portfolio, two markets",
    body:
      "KR (.KS / .KQ) and US tickers in the same view. Auto-detects KRW vs USD vs JPY and hands you a unified P/L. Live yahoo prices, split-adjusted — NVDA 10:1 doesn't show as a 90% drop.",
  },
  {
    num: "02",
    title: "Backtest → real trades in one click",
    body:
      "Compose any strategy as SYMBOL:weight lines. Run buy-and-hold vs SPY with sharpe, max DD, and vol. When it wins, Copy to Portfolio materializes it as live BUYs at the historical entry prices.",
  },
  {
    num: "03",
    title: "Sell triggers with Slack alerts",
    body:
      "Every BUY can carry its rationale plus up to 5 sell conditions — by-date, stop loss %, profit target %, absolute price, trailing peak. A cron eval fires Slack the moment one trips. Idempotent: no duplicates.",
  },
  {
    num: "04",
    title: "AI hedge proposal, grounded in your book",
    body:
      "Hands your real top-10 holdings + current geopolitical hotspots to Claude or Gemini and gets a hedge proposal that names concrete tickers and sizing (trim TSM 25%, buy GLD 1% of NAV) — not generic advice.",
  },
  {
    num: "05",
    title: "Geo risk monitor with real news",
    body:
      "Interactive world map with country heat and animated trade-flow arrows by crisis level. Click-to-open region drawer pulls Google News RSS — Reuters, ISW, SCMP. Hotspots are scored against your holdings.",
  },
];

const TECH = [
  "React",
  "Vite",
  "Express",
  "TypeScript",
  "yahoo-finance2",
  "Anthropic",
  "Gemini",
  "Supabase",
  "Google Sheets",
  "Slack",
];

function DemoFigure({ demo }: { demo: Demo }) {
  return (
    <figure>
      <div className="frame">
        <video autoPlay loop muted playsInline poster={`/demos/${demo.slug}.png`}>
          <source src={`/demos/${demo.slug}.webm`} type="video/webm" />
          <img src={`/demos/${demo.slug}.png`} alt={demo.caption} />
        </video>
        <div className="placeholder" aria-hidden="true">
          {demo.placeholder}
        </div>
      </div>
      <figcaption>{demo.caption}</figcaption>
    </figure>
  );
}

export default function App() {
  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          <span>InteliStock</span>
        </div>
        <nav className="links" aria-label="primary">
          <a href="#features">Features</a>
          <a href="#pricing">Self-host</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-h">
        <h1 id="hero-h">
          Your portfolio.
          <br />
          Your <span className="accent">AI</span>.
          <br />
          Your data.
          <br />
          On your machine.
        </h1>
        <p className="subhead">
          A local-first stock-market intelligence dashboard. KR + US in one
          book, backtests that materialize as live trades, AI hedging grounded
          in what you actually hold.
        </p>
        <div className="cta-row">
          <a
            className="btn primary"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub →
          </a>
          <a className="btn" href={WAITLIST_HREF}>
            Join waitlist
          </a>
        </div>
        <div className="beta-note">
          Currently in beta · self-host only
        </div>
      </section>

      <section className="block" aria-label="product demos">
        <p className="kicker">Live preview</p>
        <h2 className="h2">What it looks like in motion.</h2>
        <p className="lead">
          Three short loops covering the parts of the product that don't
          screenshot well — geo risk drilldown, AI hedge composition, and the
          one-click backtest-to-portfolio handoff.
        </p>
        <div className="demo-strip">
          {DEMOS.map((d) => (
            <DemoFigure key={d.slug} demo={d} />
          ))}
        </div>
      </section>

      <section className="block" id="features" aria-labelledby="features-h">
        <p className="kicker">Features</p>
        <h2 className="h2" id="features-h">
          Five things it actually does.
        </h2>
        <p className="lead">
          No teaser features, no waitlist-only flagship. Everything here ships
          in the self-host build today.
        </p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article className="feature-card" key={f.num}>
              <div className="num">{f.num}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
              <div className="tag">Available today</div>
            </article>
          ))}
        </div>
      </section>

      <section className="block" id="pricing" aria-labelledby="pricing-h">
        <p className="kicker">How to run it</p>
        <h2 className="h2" id="pricing-h">
          Self-host today. Hosted later.
        </h2>
        <p className="lead">
          Pick whichever fits. The self-host build is the full product — the
          hosted tier is just a convenience layer on top.
        </p>
        <div className="compare">
          <div className="compare-col featured">
            <h3>Self-host</h3>
            <div className="price">
              Free<span className="unit">/ MIT-soon</span>
            </div>
            <ul>
              <li>Full product, no feature gates</li>
              <li>Bring your own Anthropic / Gemini keys</li>
              <li>Your portfolio data stays on your machine</li>
              <li>Slack webhook for sell-trigger alerts</li>
              <li>Optional Supabase + Google Sheets sync</li>
            </ul>
            <div className="col-cta">
              <a
                className="btn primary"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                Clone from GitHub →
              </a>
            </div>
          </div>

          <div className="compare-col">
            <h3>Hosted</h3>
            <div className="price">
              ₩9,900<span className="unit">/ month — coming soon</span>
            </div>
            <ul>
              <li>Same product, zero setup</li>
              <li>Managed keys, managed cron, managed alerts</li>
              <li>Data residency in Seoul region</li>
              <li>Email support, 24h response</li>
              <li>Migrate to self-host any time</li>
            </ul>
            <div className="col-cta">
              <a className="btn" href={WAITLIST_HREF}>
                Join the waitlist
              </a>
            </div>
          </div>
        </div>

        <details className="howto">
          <summary>How to record the demo GIFs</summary>
          <div className="howto-body">
            <p>
              Drop the recorded files into <code>landing/public/demos/</code>{" "}
              using exactly these filenames — no code change needed:
            </p>
            <ul>
              <li>
                <code>geo-drawer.webm</code> + <code>geo-drawer.png</code> —
                from <code>/georisk</code>: hover the world map, click a
                hotspot, show the drawer with live news headlines and ETF list.
              </li>
              <li>
                <code>ai-hedge.webm</code> + <code>ai-hedge.png</code> — from{" "}
                <code>/georisk</code> bottom panel: click "Generate hedge
                proposal", let the streaming reasoning fill in, end on the
                concrete ticker + sizing list.
              </li>
              <li>
                <code>copy-to-portfolio.webm</code> +{" "}
                <code>copy-to-portfolio.png</code> — from the Backtest tab: run
                a strategy, scroll to metrics vs SPY, click{" "}
                <code>Copy to Portfolio</code>, end on Portfolio with the new
                BUYs visible.
              </li>
            </ul>
            <p>
              Recording settings: <strong>Kap.app</strong> on Mac (free),
              window mode, <code>800×450</code> resolution, 8–12 seconds each.
              Export as <code>.webm</code> and a <code>.png</code> poster (open
              the .webm, pause on a representative frame, "Save Frame As"). No
              audio.
            </p>
          </div>
        </details>
      </section>

      <footer className="tech-footer">
        <div className="tech-row">
          <span className="label">Built on</span>
          {TECH.map((t, i) => (
            <span key={t}>
              {t}
              {i < TECH.length - 1 ? <span className="sep"> · </span> : null}
            </span>
          ))}
        </div>
        <div className="sig">
          built by hms-gymnopedie <span className="dot">·</span> MIT-soon
        </div>
      </footer>
    </div>
  );
}
