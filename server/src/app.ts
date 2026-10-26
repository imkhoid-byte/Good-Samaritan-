import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db';
import authRoutes from './routes/auth';
import itemRoutes from './routes/items';
import messageRoutes from './routes/messages';
import rewardRoutes from './routes/rewards';
import orgRoutes from './routes/orgs';
import tagRoutes from './routes/tags';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || process.env.URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '5mb' })); // allow base64 QR images in responses

// Initialize database schema on cold start
let dbReady = false;
app.use(async (_req, _res, next) => {
  if (!dbReady) {
    await initDb();
    dbReady = true;
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/tags', tagRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Good Samaritan API' }));

export default app;
