import { Router } from 'express';

/**
 * /api/ai/* — owned by B2-AI. Proxies Claude API.
 * If ANTHROPIC_API_KEY is unset, endpoints should respond 503
 * with {ok:false, reason:'anthropic_not_configured'} so the frontend
 * can fall back to mock streams gracefully.
 *
 * Endpoints to add (server-sent events for streaming):
 *   GET  /signals               → stream of AISignal
 *   GET  /insights?portfolioId  → stream of AIInsight
 *   POST /verdict               → AIVerdict (body: { symbol })
 *   POST /hedge                 → HedgeProposal (body: { exposure })
 *
 * Use prompt caching for system messages.
 * Default model: claude-opus-4-7.
 */
export const ai = Router();
