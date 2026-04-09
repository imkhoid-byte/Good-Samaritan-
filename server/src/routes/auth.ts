import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { signToken, authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const AVATAR_COLORS = [
  '#16a34a', '#2563eb', '#9333ea', '#ea580c',
  '#0891b2', '#be185d', '#b45309', '#0d9488'
];

router.post('/register', (req: Request, res: Response): void => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Email, name and password are required' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  db.prepare(
    'INSERT INTO users (id, email, name, password_hash, avatar_color) VALUES (?, ?, ?, ?, ?)'
  ).run(id, email.toLowerCase().trim(), name.trim(), passwordHash, color);

  // Welcome bonus
  const txId = uuidv4();
  db.prepare(
    'INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)'
  ).run(txId, id, 50, 'Welcome to Good Samaritan!');
  db.prepare('UPDATE users SET points = points + 50 WHERE id = ?').run(id);

  const token = signToken(id);
  res.status(201).json({ token, user: { id, email, name, points: 50, subscription: 'free', avatarColor: color } });
});

router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      points: user.points,
      subscription: user.subscription,
      avatarColor: user.avatar_color
    }
  });
});

router.get('/me', authenticate, (req: AuthRequest, res: Response): void => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const itemCount = (db.prepare('SELECT COUNT(*) as count FROM items WHERE user_id = ?').get(req.userId) as any).count;
  const foundCount = (db.prepare("SELECT COUNT(*) as count FROM items WHERE user_id = ? AND status = 'returned'").get(req.userId) as any).count;
  const unreadMessages = (db.prepare(
    'SELECT COUNT(*) as count FROM messages m JOIN items i ON m.item_id = i.id WHERE i.user_id = ? AND m.is_read = 0'
  ).get(req.userId) as any).count;

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    points: user.points,
    subscription: user.subscription,
    avatarColor: user.avatar_color,
    itemCount,
    foundCount,
    unreadMessages
  });
});

export default router;
