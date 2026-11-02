import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { CHARITIES, charityById, POINTS_PER_DOLLAR, MIN_DONATION_POINTS } from '../catalog';

const router = Router();
const STORY_POINTS = 20;

// Live impact numbers for the landing and community pages.
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const q = (sql: string) => db.execute(sql).then(r => Number((r.rows[0] as any).n) || 0);
  const [members, items, tags, returnedItems, returnedTags, finderReports, donatedCents] = await Promise.all([
    q('SELECT COUNT(*) AS n FROM users'),
    q('SELECT COUNT(*) AS n FROM items'),
    q("SELECT COUNT(*) AS n FROM tags WHERE status != 'unclaimed'"),
    q("SELECT COUNT(*) AS n FROM items WHERE status = 'returned'"),
    q("SELECT COUNT(*) AS n FROM tag_events WHERE type = 'returned'"),
    q("SELECT (SELECT COUNT(*) FROM messages) + (SELECT COUNT(*) FROM tag_events WHERE type IN ('found_message', 'found_to_staff')) AS n"),
    q('SELECT COALESCE(SUM(cents), 0) AS n FROM donations')
  ]);
  res.json({
    members,
    itemsProtected: items + tags,
    itemsReturned: returnedItems + returnedTags,
    finderReports,
    donatedCents
  });
});

router.get('/stories', async (_req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const result = await db.execute(`
    SELECT s.*, u.name AS author_name, u.avatar_color, u.anonymous_mode
    FROM stories s JOIN users u ON u.id = s.user_id
    ORDER BY s.created_at DESC LIMIT 50`);
  res.json(result.rows.map((s: any) => {
    const anon = Number(s.anonymous_mode) === 1;
    return {
      id: s.id,
      title: s.title,
      body: s.body,
      hearts: Number(s.hearts),
      createdAt: s.created_at,
      authorName: anon ? 'A Good Samaritan' : String(s.author_name).split(' ')[0],
      avatarColor: anon ? '#6b7280' : s.avatar_color
    };
  }));
});

router.post('/stories', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, body, itemId } = req.body;
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'A title and your story are required' }); return;
  }
  if (title.length > 120 || body.length > 2000) {
    res.status(400).json({ error: 'Story is too long' }); return;
  }
  const db = getDb();
  if (itemId) {
    const own = await db.execute({ sql: 'SELECT id FROM items WHERE id = ? AND user_id = ?', args: [itemId, req.userId!] });
    if (!own.rows[0]) { res.status(404).json({ error: 'Item not found' }); return; }
  }
  // Points only for the first story about an item, so stories can't be farmed.
  let award = 0;
  if (itemId) {
    const prior = await db.execute({ sql: 'SELECT id FROM stories WHERE item_id = ?', args: [itemId] });
    if (!prior.rows[0]) award = STORY_POINTS;
  }
  const id = uuidv4();
  const stmts: any[] = [{
    sql: 'INSERT INTO stories (id, user_id, item_id, title, body) VALUES (?, ?, ?, ?, ?)',
    args: [id, req.userId!, itemId || null, title.trim(), body.trim()]
  }];
  if (award) {
    stmts.push(
      { sql: 'INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)', args: [uuidv4(), req.userId!, award, 'Shared a story of kindness'] },
      { sql: 'UPDATE users SET points = points + ? WHERE id = ?', args: [award, req.userId!] }
    );
  }
  await db.batch(stmts, 'write');
  res.status(201).json({ id, pointsEarned: award });
});

router.post('/stories/:id/heart', async (req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const r = await db.execute({ sql: 'UPDATE stories SET hearts = hearts + 1 WHERE id = ? RETURNING hearts', args: [req.params.id] });
  if (!r.rows[0]) { res.status(404).json({ error: 'Story not found' }); return; }
  res.json({ hearts: Number((r.rows[0] as any).hearts) });
});

router.get('/charities', async (_req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const totals = await db.execute('SELECT charity_id, SUM(cents) AS cents, COUNT(*) AS gifts FROM donations GROUP BY charity_id');
  const byId = new Map(totals.rows.map((r: any) => [String(r.charity_id), { cents: Number(r.cents), gifts: Number(r.gifts) }]));
  res.json({
    pointsPerDollar: POINTS_PER_DOLLAR,
    minDonationPoints: MIN_DONATION_POINTS,
    charities: CHARITIES.map(c => ({ ...c, raisedCents: byId.get(c.id)?.cents || 0, gifts: byId.get(c.id)?.gifts || 0 }))
  });
});

// Redeem points as a donation. Points are deducted only if the balance covers
// them; the conditional UPDATE makes double-spends impossible.
router.post('/donate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { charityId } = req.body;
  const points = Math.floor(Number(req.body.points));
  const charity = charityById(charityId);
  if (!charity) { res.status(400).json({ error: 'Choose a charity' }); return; }
  if (!Number.isFinite(points) || points < MIN_DONATION_POINTS || points % POINTS_PER_DOLLAR !== 0) {
    res.status(400).json({ error: `Donate in steps of ${POINTS_PER_DOLLAR} points (minimum ${MIN_DONATION_POINTS})` }); return;
  }

  const db = getDb();
  // A single conditional UPDATE deducts points only if the balance covers
  // them, so concurrent donations can never overspend. The records are then
  // written together; if that fails, the points are put back.
  const upd = await db.execute({
    sql: 'UPDATE users SET points = points - ? WHERE id = ? AND points >= ? RETURNING points, name',
    args: [points, req.userId!, points]
  });
  const user = upd.rows[0] as any;
  if (!user) { res.status(400).json({ error: 'Not enough points' }); return; }

  const cents = (points / POINTS_PER_DOLLAR) * 100;
  try {
    await db.batch([
      {
        sql: 'INSERT INTO donations (id, user_id, donor_label, charity_id, cents, source) VALUES (?, ?, ?, ?, ?, ?)',
        args: [uuidv4(), req.userId!, String(user.name).split(' ')[0], charity.id, cents, 'points']
      },
      {
        sql: 'INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)',
        args: [uuidv4(), req.userId!, -points, `Donated $${(cents / 100).toFixed(2)} to ${charity.name}`]
      }
    ], 'write');
  } catch (err) {
    await db.execute({ sql: 'UPDATE users SET points = points + ? WHERE id = ?', args: [points, req.userId!] }).catch(() => {});
    throw err;
  }
  res.status(201).json({ cents, charity: charity.name, points: Number(user.points) });
});

export default router;
