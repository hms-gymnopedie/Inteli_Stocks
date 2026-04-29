import { Router, type Request, type Response } from 'express';

export const health = Router();

const VERSION = '0.1.0';
const STARTED_AT = Date.now();

health.get('/', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    version: VERSION,
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000), // seconds
  });
});
