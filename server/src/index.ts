import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import itemRoutes from './routes/items';
import messageRoutes from './routes/messages';
import rewardRoutes from './routes/rewards';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/rewards', rewardRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Good Samaritan API' });
});

app.listen(PORT, () => {
  console.log(`Good Samaritan API running on port ${PORT}`);
});

export default app;
