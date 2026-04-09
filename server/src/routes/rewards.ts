import { Router, Response } from 'express';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const BADGES = [
  { id: 'newcomer', name: 'Newcomer', description: 'Welcome to Good Samaritan!', icon: '🌱', pointsRequired: 0 },
  { id: 'helper', name: 'Helper', description: 'Earned 100 Good Samaritan points', icon: '🤝', pointsRequired: 100 },
  { id: 'guardian', name: 'Guardian', description: 'Registered 5 or more items', icon: '🛡️', pointsRequired: 200 },
  { id: 'champion', name: 'Community Champion', description: 'Earned 500 Good Samaritan points', icon: '🏆', pointsRequired: 500 },
  { id: 'hero', name: 'Samaritan Hero', description: 'Earned 1000 Good Samaritan points', icon: '⭐', pointsRequired: 1000 },
];

router.get('/', authenticate, (req: AuthRequest, res: Response): void => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any;
  const transactions = db.prepare(
    'SELECT * FROM reward_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(req.userId) as any[];

  const itemCount = (db.prepare('SELECT COUNT(*) as count FROM items WHERE user_id = ?').get(req.userId) as any).count;
  const returnedCount = (db.prepare("SELECT COUNT(*) as count FROM items WHERE user_id = ? AND status = 'returned'").get(req.userId) as any).count;

  const earnedBadges = BADGES.filter(b => {
    if (b.id === 'guardian') return itemCount >= 5;
    return user.points >= b.pointsRequired;
  });

  const nextBadge = BADGES.find(b => {
    if (b.id === 'guardian') return itemCount < 5;
    return user.points < b.pointsRequired;
  });

  res.json({
    points: user.points,
    subscription: user.subscription,
    badges: earnedBadges,
    nextBadge: nextBadge || null,
    stats: {
      itemsRegistered: itemCount,
      itemsReturned: returnedCount
    },
    transactions: transactions.map(t => ({
      id: t.id,
      amount: t.amount,
      reason: t.reason,
      createdAt: t.created_at
    }))
  });
});

export default router;
