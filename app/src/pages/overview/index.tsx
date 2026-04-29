import { AISignals } from './AISignals';
import { HeroChart } from './HeroChart';
import { IndicesStrip } from './IndicesStrip';
import { MacroMonitor } from './MacroMonitor';
import { SectorFlow } from './SectorFlow';
import { SectorHeat } from './SectorHeat';
import { Sentiment } from './Sentiment';
import { SessionVolume } from './SessionVolume';
import { TodaysEvents } from './TodaysEvents';
import { Watchlist } from './Watchlist';
import { Workspaces } from './Workspaces';

export function Overview() {
  return (
    <div className="app-frame" style={{ fontSize: 12 }}>
      {/* TOP TICKER STRIP */}
      <IndicesStrip />

      {/* MAIN GRID */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '220px 1fr 280px',
          minHeight: 0,
        }}
      >
        {/* LEFT NAV */}
        <aside
          className="responsive-side"
          style={{
            borderRight: '1px solid var(--hairline)',
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            overflow: 'auto',
          }}
        >
          <Workspaces />
          <Watchlist />
        </aside>

        {/* CENTER */}
        <main
          style={{
            padding: 12,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <HeroChart />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              gap: 10,
            }}
          >
            <SectorHeat />
            <SectorFlow />
          </div>

          <MacroMonitor />
        </main>

        {/* RIGHT — AI INSIGHTS */}
        <aside
          className="responsive-side"
          style={{
            borderLeft: '1px solid var(--hairline)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'auto',
          }}
        >
          <AISignals />
          <Sentiment />
          <TodaysEvents />
          {/* Volume bars at the bottom */}
          <SessionVolume />
        </aside>
      </div>
    </div>
  );
}
