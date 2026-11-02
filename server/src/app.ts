import express, { NextFunction, Request, Response } from 'express';
import 'express-async-errors';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, ConfigError } from './db';
import authRoutes from './routes/auth';
import itemRoutes from './routes/items';
import messageRoutes from './routes/messages';
import rewardRoutes from './routes/rewards';
import orgRoutes from './routes/orgs';
import tagRoutes from './routes/tags';
import shopRoutes from './routes/shop';
import accountRoutes from './routes/account';
import communityRoutes from './routes/community';
import partnerRoutes from './routes/partners';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || process.env.URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '5mb' })); // allow base64 QR images in responses

// Initialize database schema on cold start. Concurrent requests share one
// attempt; a failed attempt is retried on the next request.
let dbReady: Promise<void> | null = null;
app.use((_req, _res, next) => {
  if (!dbReady) {
    dbReady = initDb().catch(err => {
      dbReady = null;
      throw err;
    });
  }
  dbReady.then(() => next(), next);
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/partners', partnerRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Good Samaritan API' }));

// Any error thrown in a route (sync or async) ends here as a JSON response,
// so the client shows a real message instead of a request that never returns.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api] error:', err);
  if (err instanceof ConfigError) {
    res.status(503).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Something went wrong on our side. Please try again in a moment.' });
});

export default app;
