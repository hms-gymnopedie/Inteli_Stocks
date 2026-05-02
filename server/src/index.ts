import express from 'express';
import cors from 'cors';
import { health } from './routes/health.js';
import { market } from './routes/market.js';
import { security } from './routes/security.js';
import { portfolio } from './routes/portfolio.js';
import { macro } from './routes/macro.js';
import { ai } from './routes/ai.js';
import { settings } from './routes/settings.js';
import { auth } from './routes/auth.js';
import { googleRouter } from './routes/google.js';
import { sim } from './routes/sim.js';
import { geo } from './routes/geo.js';
import { requireAuth } from './auth.js';

const app = express();

// Allow direct hits from the Vite dev server during development.
// In production, the reverse proxy / CDN handles CORS.
app.use(cors({ origin: 'http://localhost:5180' }));
app.use(express.json());

// --- Routes ---
app.use('/api/health',    health);
app.use('/api/auth',      auth);      // B5-AU — /me + /config (no auth gate)
app.use('/api/market',    market);    // B2-MD
app.use('/api/security',  security);  // B2-MD + B2-SEC (filings)
// B5-CR — portfolio routes run behind requireAuth.
// In local mode requireAuth is a no-op (req.user=null), so local-file path
// is preserved. In Supabase mode it validates the JWT and populates req.user.
app.use('/api/portfolio', requireAuth, portfolio); // B2-MD + B5-CR
app.use('/api/macro',     macro);     // B2-FRED
app.use('/api/ai',        ai);        // B2-AI
app.use('/api/settings',  settings);  // Settings page backend
app.use('/api/google',    googleRouter); // B5-GS — OAuth + Sheets sync
app.use('/api/sim',       sim);          // B8-SIM — strategy backtest + leaderboard
app.use('/api/geo',       geo);          // B13-E6 — Gemini-grounded geo risk

// --- Start ---
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`InteliStock API listening on http://localhost:${port}`);
});
