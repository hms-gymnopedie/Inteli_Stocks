import express from 'express';
import cors from 'cors';
import { health } from './routes/health.js';

const app = express();

// Allow direct hits from the Vite dev server during development.
// In production, the reverse proxy / CDN handles CORS.
app.use(cors({ origin: 'http://localhost:5180' }));
app.use(express.json());

// --- Routes ---
// GET /api/health — liveness probe
app.use('/api/health', health);

// Future route mounts (B2-MD / B2-FRED / B2-SEC / B2-AI will add their routers here):
// app.use('/api/market',    market);
// app.use('/api/portfolio', portfolio);
// app.use('/api/security',  security);
// app.use('/api/macro',     macro);
// app.use('/api/ai',        ai);

// --- Start ---
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`InteliStock API listening on http://localhost:${port}`);
});
