import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, InStatement } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  generateTagCode, generateClaimKey, getMembership, toIso,
  VENUE_TYPES, TAG_STATUSES
} from '../venue';

const router = Router();

const MAX_BATCH = 500;

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT o.*, m.role,
      (SELECT COUNT(*) FROM tags t WHERE t.org_id = o.id) as tag_count,
      (SELECT COUNT(*) FROM tags t WHERE t.org_id = o.id AND t.status IN ('found', 'at_desk')) as found_count
      FROM organizations o JOIN org_members m ON m.org_id = o.id
      WHERE m.user_id = ? ORDER BY o.created_at DESC`,
    args: [req.userId!]
  });
  res.json(result.rows.map((o: any) => ({
    id: o.id, name: o.name, venueType: o.venue_type, role: o.role,
    tagCount: Number(o.tag_count), foundCount: Number(o.found_count)
  })));
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, venueType = 'other', returnInstructions } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Venue name is required' }); return; }
  if (!VENUE_TYPES.includes(venueType)) { res.status(400).json({ error: 'Invalid venue type' }); return; }

  const id = uuidv4();
  await getDb().batch([
    {
      sql: 'INSERT INTO organizations (id, name, venue_type, return_instructions) VALUES (?, ?, ?, ?)',
      args: [id, name.trim().slice(0, 100), venueType, returnInstructions?.trim().slice(0, 300) || null]
    },
    { sql: "INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, 'owner')", args: [id, req.userId!] }
  ], 'write');
  res.status(201).json({ id });
});

router.get('/:orgId', async (req: AuthRequest, res: Response): Promise<void> => {
  const role = await getMembership(req.params.orgId, req.userId);
  if (!role) { res.status(404).json({ error: 'Venue not found' }); return; }

  const db = getDb();
  const [orgRes, membersRes, batchesRes, statsRes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM organizations WHERE id = ?', args: [req.params.orgId] }),
    db.execute({
      sql: `SELECT u.id, u.name, u.email, m.role FROM org_members m JOIN users u ON u.id = m.user_id
        WHERE m.org_id = ? ORDER BY m.created_at ASC`,
      args: [req.params.orgId]
    }),
    db.execute({ sql: 'SELECT * FROM tag_batches WHERE org_id = ? ORDER BY created_at DESC', args: [req.params.orgId] }),
    db.execute({ sql: 'SELECT status, COUNT(*) as count FROM tags WHERE org_id = ? GROUP BY status', args: [req.params.orgId] })
  ]);
  const org = orgRes.rows[0] as any;

  const stats: Record<string, number> = Object.fromEntries(TAG_STATUSES.map(s => [s, 0]));
  for (const row of statsRes.rows as any[]) stats[row.status] = Number(row.count);

  res.json({
    id: org.id, name: org.name, venueType: org.venue_type,
    returnInstructions: org.return_instructions, role, stats,
    members: membersRes.rows.map((m: any) => ({ id: m.id, name: m.name, email: m.email, role: m.role })),
    batches: batchesRes.rows.map((b: any) => ({
      id: b.id, label: b.label, count: Number(b.count), createdAt: toIso(b.created_at)
    }))
  });
});

router.patch('/:orgId', async (req: AuthRequest, res: Response): Promise<void> => {
  if ((await getMembership(req.params.orgId, req.userId)) !== 'owner') {
    res.status(403).json({ error: 'Only venue owners can edit settings' }); return;
  }
  const { name, returnInstructions } = req.body;
  if (name !== undefined && !String(name).trim()) { res.status(400).json({ error: 'Venue name is required' }); return; }
  await getDb().execute({
    sql: 'UPDATE organizations SET name = COALESCE(?, name), return_instructions = COALESCE(?, return_instructions) WHERE id = ?',
    args: [
      name !== undefined ? String(name).trim().slice(0, 100) : null,
      returnInstructions !== undefined ? String(returnInstructions).trim().slice(0, 300) : null,
      req.params.orgId
    ]
  });
  res.json({ success: true });
});

router.post('/:orgId/members', async (req: AuthRequest, res: Response): Promise<void> => {
  if ((await getMembership(req.params.orgId, req.userId)) !== 'owner') {
    res.status(403).json({ error: 'Only venue owners can add staff' }); return;
  }
  const { email, role = 'staff' } = req.body;
  if (!['owner', 'staff'].includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }

  const db = getDb();
  const userRes = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [String(email || '').toLowerCase().trim()] });
  const user = userRes.rows[0] as any;
  if (!user) {
    res.status(404).json({ error: 'No account with that email. Ask them to sign up first, then add them here.' });
    return;
  }
  await db.execute({
    sql: 'INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT (org_id, user_id) DO UPDATE SET role = excluded.role',
    args: [req.params.orgId, user.id, role]
  });
  res.status(201).json({ success: true });
});

router.delete('/:orgId/members/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  if ((await getMembership(req.params.orgId, req.userId)) !== 'owner') {
    res.status(403).json({ error: 'Only venue owners can remove staff' }); return;
  }
  if (req.params.userId === req.userId) {
    res.status(400).json({ error: "You can't remove yourself" }); return;
  }
  await getDb().execute({
    sql: 'DELETE FROM org_members WHERE org_id = ? AND user_id = ?',
    args: [req.params.orgId, req.params.userId]
  });
  res.json({ success: true });
});

router.post('/:orgId/batches', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!(await getMembership(req.params.orgId, req.userId))) { res.status(404).json({ error: 'Venue not found' }); return; }

  const count = Math.floor(Number(req.body.count));
  if (!Number.isFinite(count) || count < 1 || count > MAX_BATCH) {
    res.status(400).json({ error: `Count must be between 1 and ${MAX_BATCH}` }); return;
  }
  const label = String(req.body.label || '').trim().slice(0, 80) || `Batch of ${count}`;

  const db = getDb();
  const seqRes = await db.execute({ sql: 'SELECT COALESCE(MAX(seq), 0) as max_seq FROM tags WHERE org_id = ?', args: [req.params.orgId] });
  const startSeq = Number(seqRes.rows[0].max_seq) + 1;
  const batchId = uuidv4();

  // A random 8-char code collides with an existing one roughly never; if it
  // does, the whole batch rolls back and we try again with fresh codes.
  for (let attempt = 0; attempt < 3; attempt++) {
    const codes = new Set<string>();
    while (codes.size < count) codes.add(generateTagCode());

    const stmts: InStatement[] = [{
      sql: 'INSERT INTO tag_batches (id, org_id, label, count, created_by) VALUES (?, ?, ?, ?, ?)',
      args: [batchId, req.params.orgId, label, count, req.userId!]
    }];
    let seq = startSeq;
    for (const code of codes) {
      stmts.push({
        sql: 'INSERT INTO tags (code, org_id, batch_id, seq, claim_key) VALUES (?, ?, ?, ?, ?)',
        args: [code, req.params.orgId, batchId, seq++, generateClaimKey()]
      });
    }
    try {
      await db.batch(stmts, 'write');
      res.status(201).json({ id: batchId, label, count });
      return;
    } catch (err: any) {
      if (!String(err?.message).includes('UNIQUE') || attempt === 2) throw err;
    }
  }
});

// Claim keys leave the server only here, for printing, and only to venue members.
router.get('/:orgId/batches/:batchId/print', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!(await getMembership(req.params.orgId, req.userId))) { res.status(404).json({ error: 'Venue not found' }); return; }

  const db = getDb();
  const [orgRes, batchRes, tagsRes] = await Promise.all([
    db.execute({ sql: 'SELECT name, return_instructions FROM organizations WHERE id = ?', args: [req.params.orgId] }),
    db.execute({ sql: 'SELECT * FROM tag_batches WHERE id = ? AND org_id = ?', args: [req.params.batchId, req.params.orgId] }),
    db.execute({ sql: 'SELECT code, seq, claim_key FROM tags WHERE batch_id = ? AND org_id = ? ORDER BY seq ASC', args: [req.params.batchId, req.params.orgId] })
  ]);
  const batch = batchRes.rows[0] as any;
  if (!batch) { res.status(404).json({ error: 'Batch not found' }); return; }
  const org = orgRes.rows[0] as any;

  res.json({
    venueName: org.name,
    returnInstructions: org.return_instructions,
    batch: { id: batch.id, label: batch.label, count: Number(batch.count) },
    tags: tagsRes.rows.map((t: any) => ({ code: t.code, seq: Number(t.seq), claimKey: t.claim_key }))
  });
});

router.get('/:orgId/tags', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!(await getMembership(req.params.orgId, req.userId))) { res.status(404).json({ error: 'Venue not found' }); return; }

  const status = typeof req.query.status === 'string' && TAG_STATUSES.includes(req.query.status) ? req.query.status : null;
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toUpperCase() : '';

  const where = ['t.org_id = ?'];
  const args: (string | number)[] = [req.params.orgId];
  if (status) { where.push('t.status = ?'); args.push(status); }
  if (q) {
    where.push("(t.code LIKE ? OR UPPER(COALESCE(t.label, '')) LIKE ? OR UPPER(COALESCE(t.owner_name, '')) LIKE ? OR CAST(t.seq AS TEXT) = ?)");
    const like = `%${q.replace(/[^0-9A-Z ]/g, '')}%`;
    args.push(like, like, like, q);
  }

  const result = await getDb().execute({
    sql: `SELECT t.code, t.seq, t.status, t.label, t.owner_name, t.claimed_at,
        e.type as last_event, e.created_at as last_event_at
      FROM tags t
      LEFT JOIN tag_events e ON e.id = (
        SELECT id FROM tag_events WHERE tag_code = t.code ORDER BY created_at DESC, rowid DESC LIMIT 1
      )
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(e.created_at, t.created_at) DESC, t.seq DESC
      LIMIT 200`,
    args
  });

  res.json(result.rows.map((t: any) => ({
    code: t.code, seq: Number(t.seq), status: t.status, label: t.label,
    ownerName: t.owner_name, claimedAt: toIso(t.claimed_at),
    lastEvent: t.last_event, lastEventAt: toIso(t.last_event_at)
  })));
});

export default router;
