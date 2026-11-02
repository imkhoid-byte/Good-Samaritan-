import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, InStatement } from '../db';
import { notify } from '../notify';
import { charityById, FINDER_MATCH_CENTS } from '../catalog';

const router = Router();
const BASE_URL = process.env.BASE_URL || process.env.URL || 'http://localhost:3000';

router.post('/found/:itemId', async (req: Request, res: Response): Promise<void> => {
  const { senderName, senderEmail, content, charityId } = req.body;

  if (!senderName || !senderEmail || !content) {
    res.status(400).json({ error: 'Name, email and message are required' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }
  const charity = charityId ? charityById(charityId) : undefined;
  if (charityId && !charity) {
    res.status(400).json({ error: 'Unknown charity' });
    return;
  }

  const db = getDb();
  const itemRes = await db.execute({
    sql: 'SELECT i.*, u.email AS owner_email, u.subscription FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = ?',
    args: [req.params.itemId]
  });
  const item = itemRes.rows[0] as any;
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }
  if (item.status === 'returned' || item.status === 'inactive') {
    res.status(400).json({ error: 'This item is no longer active' }); return;
  }

  const email = senderEmail.trim().toLowerCase();
  const stmts: InStatement[] = [
    {
      sql: 'INSERT INTO messages (id, item_id, sender_name, sender_email, content) VALUES (?, ?, ?, ?, ?)',
      args: [uuidv4(), req.params.itemId, senderName.trim(), email, content.trim()]
    },
    {
      sql: 'INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)',
      args: [uuidv4(), item.user_id, 15, `Someone found your item: ${item.name}`]
    },
    { sql: 'UPDATE users SET points = points + 15 WHERE id = ?', args: [item.user_id] }
  ];

  // Kindness match: the platform donates to the finder's chosen charity,
  // once per finder per item so repeat messages don't multiply it.
  let donatedCents = 0;
  if (charity) {
    const source = `finder:${req.params.itemId}:${email}`;
    const prior = await db.execute({ sql: 'SELECT id FROM donations WHERE source = ?', args: [source] });
    if (!prior.rows[0]) {
      donatedCents = FINDER_MATCH_CENTS;
      stmts.push({
        sql: 'INSERT INTO donations (id, user_id, donor_label, charity_id, cents, source) VALUES (?, NULL, ?, ?, ?, ?)',
        args: [uuidv4(), senderName.trim().split(' ')[0], charity.id, donatedCents, source]
      });
    }
  }
  await db.batch(stmts, 'write');

  // Instant alerts are a Premium perk; free members see it on their dashboard.
  if (item.subscription === 'premium') {
    await notify(
      { email: item.owner_email },
      `Good news: someone found your ${item.name}`,
      `${senderName.trim()} wrote:\n"${content.trim()}"\n\nReply to them at ${email}\nDetails: ${BASE_URL}/items/${item.id}`
    );
  }

  res.status(201).json({
    success: true,
    message: 'Your message has been sent to the owner!',
    donation: donatedCents ? { cents: donatedCents, charity: charity!.name } : null
  });
});

export default router;
