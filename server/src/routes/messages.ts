import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';

const router = Router();

router.post('/found/:itemId', async (req: Request, res: Response): Promise<void> => {
  const { senderName, senderEmail, content } = req.body;

  if (!senderName || !senderEmail || !content) {
    res.status(400).json({ error: 'Name, email and message are required' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }

  const db = getDb();
  const itemRes = await db.execute({ sql: 'SELECT * FROM items WHERE id = ?', args: [req.params.itemId] });
  const item = itemRes.rows[0] as any;
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }
  if (item.status === 'returned' || item.status === 'inactive') {
    res.status(400).json({ error: 'This item is no longer active' }); return;
  }

  await db.batch([
    {
      sql: 'INSERT INTO messages (id, item_id, sender_name, sender_email, content) VALUES (?, ?, ?, ?, ?)',
      args: [uuidv4(), req.params.itemId, senderName.trim(), senderEmail.trim().toLowerCase(), content.trim()]
    },
    {
      sql: 'INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)',
      args: [uuidv4(), item.user_id, 15, `Someone found your item: ${item.name}`]
    },
    { sql: 'UPDATE users SET points = points + 15 WHERE id = ?', args: [item.user_id] }
  ], 'write');

  res.status(201).json({ success: true, message: 'Your message has been sent to the owner!' });
});

export default router;
