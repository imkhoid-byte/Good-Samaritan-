import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { signToken, authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const AVATAR_COLORS = [
  '#16a34a', '#2563eb', '#9333ea', '#ea580c',
  '#0891b2', '#be185d', '#b45309', '#0d9488'
];

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Email, name and password are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const db = getDb();
  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.toLowerCase().trim()] });
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  const txId = uuidv4();
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  await db.batch([
    {
      sql: 'INSERT INTO users (id, email, name, password_hash, avatar_color, points) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, email.toLowerCase().trim(), name.trim(), passwordHash, color, 50]
    },
    {
      sql: 'INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)',
      args: [txId, id, 50, 'Welcome to Good Samaritan!']
    }
  ], 'write');

  const token = signToken(id);
  res.status(201).json({
    token,
    user: { id, email: email.toLowerCase().trim(), name: name.trim(), points: 50, subscription: 'free', avatarColor: color }
  });
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.toLowerCase().trim()] });
  const user = result.rows[0] as any;

  if (!user || !(await bcrypt.compare(password, user.password_hash as string))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken(user.id as string);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      points: Number(user.points),
      subscription: user.subscription,
      avatarColor: user.avatar_color
    }
  });
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.userId!] });
  const user = result.rows[0] as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const [itemRes, foundRes, unreadRes] = await Promise.all([
    db.execute({ sql: 'SELECT COUNT(*) as count FROM items WHERE user_id = ?', args: [req.userId!] }),
    db.execute({ sql: "SELECT COUNT(*) as count FROM items WHERE user_id = ? AND status = 'returned'", args: [req.userId!] }),
    db.execute({
      sql: 'SELECT COUNT(*) as count FROM messages m JOIN items i ON m.item_id = i.id WHERE i.user_id = ? AND m.is_read = 0',
      args: [req.userId!]
    })
  ]);

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    points: Number(user.points),
    subscription: user.subscription,
    avatarColor: user.avatar_color,
    itemCount: Number(itemRes.rows[0].count),
    foundCount: Number(foundRes.rows[0].count),
    unreadMessages: Number(unreadRes.rows[0].count)
  });
});

export default router;
