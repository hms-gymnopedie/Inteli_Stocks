import express from 'express';
import cors from 'cors';
import { health } from './routes/health.js';
import { market } from './routes/market.js';
import { security } from './routes/security.js';
import { portfolio } from './routes/portfolio.js';
import { macro } from './routes/macro.js';
import { ai } from './routes/ai.js';

const app = express();

// Allow direct hits from the Vite dev server during development.
// In production, the reverse proxy / CDN handles CORS.
app.use(cors({ origin: 'http://localhost:5180' }));
app.use(express.json());

// --- Routes ---
app.use('/api/health',    health);
app.use('/api/market',    market);    // B2-MD
app.use('/api/security',  security);  // B2-MD + B2-SEC (filings)
app.use('/api/portfolio', portfolio); // B2-MD
app.use('/api/macro',     macro);     // B2-FRED
app.use('/api/ai',        ai);        // B2-AI

// --- Start ---
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`InteliStock API listening on http://localhost:${port}`);
});
