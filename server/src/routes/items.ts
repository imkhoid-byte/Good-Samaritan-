import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { getDb } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const BASE_URL = process.env.BASE_URL || process.env.URL || 'http://localhost:3000';

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT i.*,
      (SELECT COUNT(*) FROM messages m WHERE m.item_id = i.id AND m.is_read = 0) as unread_count
      FROM items i WHERE i.user_id = ? ORDER BY i.created_at DESC`,
    args: [req.userId!]
  });

  res.json(result.rows.map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    status: item.status,
    qrCode: item.qr_code,
    rewardOffered: Number(item.reward_offered),
    rewardNote: item.reward_note,
    createdAt: item.created_at,
    foundAt: item.found_at,
    unreadCount: Number(item.unread_count)
  })));
});

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, category = 'other', rewardOffered = 0, rewardNote } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Item name is required' });
    return;
  }

  const id = uuidv4();
  const txId = uuidv4();
  const foundUrl = `${BASE_URL}/found/${id}`;
  const qrCode = await QRCode.toDataURL(foundUrl, {
    width: 300, margin: 2,
    color: { dark: '#166534', light: '#FFFFFF' }
  });

  const db = getDb();
  await db.batch([
    {
      sql: 'INSERT INTO items (id, user_id, name, description, category, qr_code, reward_offered, reward_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, req.userId!, name.trim(), description?.trim() || null, category, qrCode, rewardOffered, rewardNote?.trim() || null]
    },
    {
      sql: 'INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)',
      args: [txId, req.userId!, 10, `Registered item: ${name}`]
    },
    {
      sql: 'UPDATE users SET points = points + 10 WHERE id = ?',
      args: [req.userId!]
    }
  ], 'write');

  res.status(201).json({ id, name: name.trim(), description: description?.trim() || null, category, status: 'active', qrCode, rewardOffered, rewardNote: rewardNote?.trim() || null, createdAt: new Date().toISOString(), foundUrl });
});

router.get('/public/:id', async (req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const itemRes = await db.execute({ sql: 'SELECT * FROM items WHERE id = ?', args: [req.params.id] });
  const item = itemRes.rows[0] as any;
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  const ownerRes = await db.execute({ sql: 'SELECT name FROM users WHERE id = ?', args: [item.user_id] });
  const owner = ownerRes.rows[0] as any;

  res.json({
    id: item.id, name: item.name, description: item.description,
    category: item.category, status: item.status,
    rewardOffered: Number(item.reward_offered), rewardNote: item.reward_note,
    ownerName: owner?.name || 'Unknown', createdAt: item.created_at
  });
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();
  const itemRes = await db.execute({ sql: 'SELECT * FROM items WHERE id = ? AND user_id = ?', args: [req.params.id, req.userId!] });
  const item = itemRes.rows[0] as any;
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  const msgsRes = await db.execute({ sql: 'SELECT * FROM messages WHERE item_id = ? ORDER BY created_at ASC', args: [req.params.id] });
  await db.execute({ sql: 'UPDATE messages SET is_read = 1 WHERE item_id = ?', args: [req.params.id] });

  res.json({
    id: item.id, name: item.name, description: item.description,
    category: item.category, status: item.status, qrCode: item.qr_code,
    rewardOffered: Number(item.reward_offered), rewardNote: item.reward_note,
    createdAt: item.created_at, foundAt: item.found_at,
    foundUrl: `${BASE_URL}/found/${item.id}`,
    messages: msgsRes.rows.map((m: any) => ({
      id: m.id, senderName: m.sender_name, senderEmail: m.sender_email,
      content: m.content, isRead: m.is_read === 1, createdAt: m.created_at
    }))
  });
});

router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!['active', 'lost', 'returned', 'inactive'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' }); return;
  }

  const db = getDb();
  const itemRes = await db.execute({ sql: 'SELECT * FROM items WHERE id = ? AND user_id = ?', args: [req.params.id, req.userId!] });
  const item = itemRes.rows[0] as any;
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  const foundAt = status === 'returned' ? new Date().toISOString() : null;
  const stmts: any[] = [{ sql: 'UPDATE items SET status = ?, found_at = ? WHERE id = ?', args: [status, foundAt, req.params.id] }];

  if (status === 'returned' && item.status !== 'returned') {
    stmts.push(
      { sql: 'INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)', args: [uuidv4(), req.userId!, 25, `Item returned: ${item.name}`] },
      { sql: 'UPDATE users SET points = points + 25 WHERE id = ?', args: [req.userId!] }
    );
  }
  await db.batch(stmts, 'write');
  res.json({ success: true, status });
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();
  const itemRes = await db.execute({ sql: 'SELECT id FROM items WHERE id = ? AND user_id = ?', args: [req.params.id, req.userId!] });
  if (!itemRes.rows[0]) { res.status(404).json({ error: 'Item not found' }); return; }

  await db.batch([
    { sql: 'DELETE FROM messages WHERE item_id = ?', args: [req.params.id] },
    { sql: 'DELETE FROM items WHERE id = ?', args: [req.params.id] }
  ], 'write');
  res.json({ success: true });
});

export default router;
