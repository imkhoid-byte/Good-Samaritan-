import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

router.get('/', authenticate, (req: AuthRequest, res: Response): void => {
  const items = db.prepare(`
    SELECT i.*,
      (SELECT COUNT(*) FROM messages m WHERE m.item_id = i.id AND m.is_read = 0) as unread_count
    FROM items i
    WHERE i.user_id = ?
    ORDER BY i.created_at DESC
  `).all(req.userId) as any[];

  res.json(items.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    status: item.status,
    qrCode: item.qr_code,
    rewardOffered: item.reward_offered,
    rewardNote: item.reward_note,
    createdAt: item.created_at,
    foundAt: item.found_at,
    unreadCount: item.unread_count
  })));
});

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, category = 'other', rewardOffered = 0, rewardNote } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Item name is required' });
    return;
  }

  const id = uuidv4();
  const foundUrl = `${BASE_URL}/found/${id}`;
  const qrCode = await QRCode.toDataURL(foundUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#166534', light: '#FFFFFF' }
  });

  db.prepare(`
    INSERT INTO items (id, user_id, name, description, category, qr_code, reward_offered, reward_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, name.trim(), description?.trim() || null, category, qrCode, rewardOffered, rewardNote?.trim() || null);

  // Award points for registering an item
  const txId = uuidv4();
  db.prepare('INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)').run(txId, req.userId, 10, `Registered item: ${name}`);
  db.prepare('UPDATE users SET points = points + 10 WHERE id = ?').run(req.userId);

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any;
  res.status(201).json({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    status: item.status,
    qrCode: item.qr_code,
    rewardOffered: item.reward_offered,
    rewardNote: item.reward_note,
    createdAt: item.created_at,
    foundUrl
  });
});

router.get('/:id', authenticate, (req: AuthRequest, res: Response): void => {
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as any;
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const messages = db.prepare(
    'SELECT * FROM messages WHERE item_id = ? ORDER BY created_at ASC'
  ).all(req.params.id) as any[];

  // Mark messages as read
  db.prepare('UPDATE messages SET is_read = 1 WHERE item_id = ?').run(req.params.id);

  res.json({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    status: item.status,
    qrCode: item.qr_code,
    rewardOffered: item.reward_offered,
    rewardNote: item.reward_note,
    createdAt: item.created_at,
    foundAt: item.found_at,
    foundUrl: `${BASE_URL}/found/${item.id}`,
    messages: messages.map(m => ({
      id: m.id,
      senderName: m.sender_name,
      senderEmail: m.sender_email,
      content: m.content,
      isRead: m.is_read === 1,
      createdAt: m.created_at
    }))
  });
});

router.patch('/:id/status', authenticate, (req: AuthRequest, res: Response): void => {
  const { status } = req.body;
  const validStatuses = ['active', 'lost', 'returned', 'inactive'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as any;
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const foundAt = status === 'returned' ? new Date().toISOString() : null;
  db.prepare('UPDATE items SET status = ?, found_at = ? WHERE id = ?').run(status, foundAt, req.params.id);

  if (status === 'returned' && item.status !== 'returned') {
    // Award bonus points for successful return
    const txId = uuidv4();
    db.prepare('INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)').run(txId, req.userId, 25, `Item returned: ${item.name}`);
    db.prepare('UPDATE users SET points = points + 25 WHERE id = ?').run(req.userId);
  }

  res.json({ success: true, status });
});

router.delete('/:id', authenticate, (req: AuthRequest, res: Response): void => {
  const item = db.prepare('SELECT id FROM items WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  db.prepare('DELETE FROM messages WHERE item_id = ?').run(req.params.id);
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Public: get item info when QR scanned
router.get('/public/:id', (req, res: Response): void => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id) as any;
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(item.user_id) as any;

  res.json({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    status: item.status,
    rewardOffered: item.reward_offered,
    rewardNote: item.reward_note,
    ownerName: owner?.name || 'Unknown',
    createdAt: item.created_at
  });
});

export default router;
