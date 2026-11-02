import { Router, Response } from 'express';
import { getDb } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const BADGES = [
  { id: 'newcomer', name: 'Newcomer', description: 'Welcome to Good Samaritan!', icon: '🌱', pointsRequired: 0 },
  { id: 'helper', name: 'Helper', description: 'Earned 100 Good Samaritan points', icon: '🤝', pointsRequired: 100 },
  { id: 'guardian', name: 'Guardian', description: 'Registered 5 or more items', icon: '🛡️', pointsRequired: 200 },
  { id: 'champion', name: 'Community Champion', description: 'Earned 500 Good Samaritan points', icon: '🏆', pointsRequired: 500 },
  { id: 'hero', name: 'Samaritan Hero', description: 'Earned 1000 Good Samaritan points', icon: '⭐', pointsRequired: 1000 },
];

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();

  const [userRes, txRes, itemRes, returnedRes, donatedRes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.userId!] }),
    db.execute({ sql: 'SELECT * FROM reward_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', args: [req.userId!] }),
    db.execute({ sql: 'SELECT COUNT(*) as count FROM items WHERE user_id = ?', args: [req.userId!] }),
    db.execute({ sql: "SELECT COUNT(*) as count FROM items WHERE user_id = ? AND status = 'returned'", args: [req.userId!] }),
    db.execute({ sql: 'SELECT COALESCE(SUM(cents), 0) as cents FROM donations WHERE user_id = ?', args: [req.userId!] })
  ]);

  const user = userRes.rows[0] as any;
  const points = Number(user.points);
  const itemCount = Number(itemRes.rows[0].count);

  const earnedBadges = BADGES.filter(b => {
    if (b.id === 'guardian') return itemCount >= 5;
    return points >= b.pointsRequired;
  });
  const nextBadge = BADGES.find(b => {
    if (b.id === 'guardian') return itemCount < 5;
    return points < b.pointsRequired;
  });

  res.json({
    points,
    subscription: user.subscription,
    badges: earnedBadges,
    nextBadge: nextBadge || null,
    stats: {
      itemsRegistered: itemCount,
      itemsReturned: Number(returnedRes.rows[0].count),
      donatedCents: Number(donatedRes.rows[0].cents)
    },
    transactions: txRes.rows.map((t: any) => ({
      id: t.id, amount: Number(t.amount), reason: t.reason, createdAt: t.created_at
    }))
  });
});

export default router;
