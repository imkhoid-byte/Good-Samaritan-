import { Router, Response } from 'express';
import { getDb } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { TIPS, PREMIUM_PRICE_CENTS } from '../catalog';

// Premium membership, privacy settings and loss-prevention tips.
// Billing is not wired to a payment processor yet: upgrading flips the flag
// directly. Put a checkout step in front of POST /premium before charging.
const router = Router();

router.get('/premium', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();
  const r = await db.execute({ sql: 'SELECT subscription, premium_since, anonymous_mode FROM users WHERE id = ?', args: [req.userId!] });
  const u = r.rows[0] as any;
  res.json({
    subscription: u.subscription,
    premiumSince: u.premium_since,
    anonymousMode: Number(u.anonymous_mode) === 1,
    priceCents: PREMIUM_PRICE_CENTS
  });
});

router.post('/premium', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();
  await db.execute({
    sql: "UPDATE users SET subscription = 'premium', premium_since = COALESCE(premium_since, CURRENT_TIMESTAMP) WHERE id = ?",
    args: [req.userId!]
  });
  res.json({ subscription: 'premium' });
});

router.delete('/premium', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();
  // Premium-only settings switch off with the membership.
  await db.execute({
    sql: "UPDATE users SET subscription = 'free', premium_since = NULL, anonymous_mode = 0 WHERE id = ?",
    args: [req.userId!]
  });
  res.json({ subscription: 'free' });
});

router.patch('/settings', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { anonymousMode } = req.body;
  if (typeof anonymousMode !== 'boolean') {
    res.status(400).json({ error: 'anonymousMode must be true or false' }); return;
  }
  const db = getDb();
  const r = await db.execute({ sql: 'SELECT subscription FROM users WHERE id = ?', args: [req.userId!] });
  if ((r.rows[0] as any)?.subscription !== 'premium') {
    res.status(403).json({ error: 'Anonymous mode is a Premium feature' }); return;
  }
  await db.execute({ sql: 'UPDATE users SET anonymous_mode = ? WHERE id = ?', args: [anonymousMode ? 1 : 0, req.userId!] });
  res.json({ anonymousMode });
});

// Free members get the general tips. Premium members also get tips for the
// categories of items they have actually registered.
router.get('/tips', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();
  const [userRes, catRes] = await Promise.all([
    db.execute({ sql: 'SELECT subscription FROM users WHERE id = ?', args: [req.userId!] }),
    db.execute({ sql: 'SELECT DISTINCT category FROM items WHERE user_id = ?', args: [req.userId!] })
  ]);
  const isPremium = (userRes.rows[0] as any)?.subscription === 'premium';
  const categories = catRes.rows.map((r: any) => String(r.category));
  const general = TIPS.filter(t => t.category === 'general');
  const personal = TIPS.filter(t => categories.includes(t.category));
  res.json({
    isPremium,
    categories,
    general,
    personal: isPremium ? personal : [],
    lockedCount: isPremium ? 0 : personal.length
  });
});

export default router;
