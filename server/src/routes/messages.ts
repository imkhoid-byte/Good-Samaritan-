import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';

const router = Router();

// Public: finder sends a message to item owner
router.post('/found/:itemId', (req: Request, res: Response): void => {
  const { senderName, senderEmail, content } = req.body;

  if (!senderName || !senderEmail || !content) {
    res.status(400).json({ error: 'Name, email and message are required' });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.itemId) as any;
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  if (item.status === 'returned' || item.status === 'inactive') {
    res.status(400).json({ error: 'This item is no longer active' });
    return;
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO messages (id, item_id, sender_name, sender_email, content) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.params.itemId, senderName.trim(), senderEmail.trim().toLowerCase(), content.trim());

  // Award points to owner for getting their item found
  const txId = uuidv4();
  db.prepare('INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)').run(
    txId, item.user_id, 15, `Someone found your item: ${item.name}`
  );
  db.prepare('UPDATE users SET points = points + 15 WHERE id = ?').run(item.user_id);

  res.status(201).json({ success: true, message: 'Your message has been sent to the owner!' });
});

export default router;
