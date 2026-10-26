import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { InStatement } from '@libsql/client';
import { getDb } from '../db';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { notify } from '../notify';
import {
  normalizeTagCode, formatTagCode, secretsMatch, generateOwnerToken, getMembership,
  toIso, normalizePhone, publicBaseUrl, EMAIL_RE
} from '../venue';

const router = Router();

type Viewer = 'owner' | 'staff' | 'public';

async function loadTag(rawCode: string): Promise<any | null> {
  const res = await getDb().execute({
    sql: `SELECT t.*, o.name as venue_name, o.venue_type, o.return_instructions
      FROM tags t JOIN organizations o ON o.id = t.org_id WHERE t.code = ?`,
    args: [normalizeTagCode(rawCode)]
  });
  return res.rows[0] ?? null;
}

async function viewerFor(req: AuthRequest, tag: any): Promise<Viewer> {
  if (await getMembership(tag.org_id, req.userId)) return 'staff';
  const token = req.header('x-owner-token');
  if (tag.owner_token && secretsMatch(token, tag.owner_token)) return 'owner';
  if (tag.owner_token && req.userId && tag.owner_user_id === req.userId) return 'owner';
  return 'public';
}

function event(tagCode: string, type: string, extra: {
  actorUserId?: string; finderName?: string | null; finderContact?: string | null;
  message?: string | null; lat?: number | null; lng?: number | null;
} = {}): InStatement {
  return {
    sql: `INSERT INTO tag_events (id, tag_code, type, cycle, actor_user_id, finder_name, finder_contact, message, lat, lng)
      VALUES (?, ?, ?, (SELECT cycle FROM tags WHERE code = ?), ?, ?, ?, ?, ?, ?)`,
    args: [
      uuidv4(), tagCode, type, tagCode, extra.actorUserId ?? null, extra.finderName ?? null,
      extra.finderContact ?? null, extra.message ?? null, extra.lat ?? null, extra.lng ?? null
    ]
  };
}

function ownerLink(tag: any, token?: string): string {
  return `${publicBaseUrl()}/t/${tag.code}${token ? `?o=${token}` : ''}`;
}

function itemName(tag: any): string {
  return tag.label || 'item';
}

function ownerRecipient(tag: any) {
  return { email: tag.owner_email, phone: tag.owner_phone };
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function cleanCoord(value: unknown, limit: number): number | null {
  const n = typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

router.get('/mine', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await getDb().execute({
    sql: `SELECT t.code, t.status, t.label, t.claimed_at, o.name as venue_name
      FROM tags t JOIN organizations o ON o.id = t.org_id
      WHERE t.owner_user_id = ? AND t.owner_token IS NOT NULL
      ORDER BY t.claimed_at DESC`,
    args: [req.userId!]
  });
  res.json(result.rows.map((t: any) => ({
    code: t.code, status: t.status, label: t.label,
    venueName: t.venue_name, claimedAt: toIso(t.claimed_at)
  })));
});

router.get('/:code', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const tag = await loadTag(req.params.code);
  if (!tag) { res.status(404).json({ error: 'Tag not found' }); return; }

  const viewer = await viewerFor(req, tag);
  const isClaimed = Boolean(tag.owner_token);
  const db = getDb();

  const base = {
    code: tag.code,
    displayCode: formatTagCode(tag.code),
    status: tag.status,
    isClaimed,
    label: isClaimed ? tag.label : null,
    venue: { name: tag.venue_name, venueType: tag.venue_type, returnInstructions: tag.return_instructions },
    viewer
  };

  if (viewer === 'public') {
    // The stub's QR carries the claim key; the item side never does, so
    // whoever finds the item can report it but can't take it over.
    const claimKey = typeof req.query.k === 'string' ? req.query.k : '';
    const canClaim = !isClaimed && tag.status !== 'returned' && secretsMatch(claimKey, tag.claim_key);

    // Scan log for the owner, at most one entry per 5 minutes so refreshes don't spam it.
    if (isClaimed && tag.status !== 'returned') {
      await db.execute({
        sql: `INSERT INTO tag_events (id, tag_code, type, cycle)
          SELECT ?, ?, 'scanned', ? WHERE NOT EXISTS (
            SELECT 1 FROM tag_events WHERE tag_code = ? AND type = 'scanned' AND created_at > datetime('now', '-5 minutes')
          )`,
        args: [uuidv4(), tag.code, Number(tag.cycle), tag.code]
      });
    }
    res.json({ ...base, canClaim });
    return;
  }

  // Owners only see the current cycle; staff see the tag's whole history.
  const eventsRes = await db.execute({
    sql: viewer === 'owner'
      ? 'SELECT * FROM tag_events WHERE tag_code = ? AND cycle = ? ORDER BY created_at DESC, rowid DESC LIMIT 100'
      : 'SELECT * FROM tag_events WHERE tag_code = ? ORDER BY created_at DESC, rowid DESC LIMIT 100',
    args: viewer === 'owner' ? [tag.code, Number(tag.cycle)] : [tag.code]
  });

  res.json({
    ...base,
    seq: viewer === 'staff' ? Number(tag.seq) : undefined,
    orgId: viewer === 'staff' ? tag.org_id : undefined,
    ownerName: tag.owner_name,
    ownerHasEmail: Boolean(tag.owner_email),
    ownerHasPhone: Boolean(tag.owner_phone),
    claimedAt: toIso(tag.claimed_at),
    returnedAt: toIso(tag.returned_at),
    events: eventsRes.rows.map((e: any) => ({
      id: e.id, type: e.type, message: e.message,
      finderName: e.finder_name, finderContact: e.finder_contact,
      lat: e.lat === null ? null : Number(e.lat), lng: e.lng === null ? null : Number(e.lng),
      createdAt: toIso(e.created_at)
    }))
  });
});

router.post('/:code/claim', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const tag = await loadTag(req.params.code);
  if (!tag) { res.status(404).json({ error: 'Tag not found' }); return; }
  if (!secretsMatch(req.body.claimKey, tag.claim_key)) {
    res.status(403).json({ error: 'This link can’t claim the tag. Scan the stub you were given.' }); return;
  }
  if (tag.owner_token || tag.status === 'returned') {
    res.status(409).json({ error: 'This tag has already been claimed. Ask staff for a fresh one.' }); return;
  }

  const label = cleanText(req.body.label, 80);
  const ownerName = cleanText(req.body.ownerName, 80);
  const email = cleanText(req.body.email, 200)?.toLowerCase() ?? null;
  const phoneRaw = cleanText(req.body.phone, 30);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;

  if (!email && !phoneRaw) { res.status(400).json({ error: 'Add a phone number or email so we can reach you' }); return; }
  if (email && !EMAIL_RE.test(email)) { res.status(400).json({ error: 'That email doesn’t look right' }); return; }
  if (phoneRaw && !phone) { res.status(400).json({ error: 'That phone number doesn’t look right' }); return; }

  const ownerToken = generateOwnerToken();
  const db = getDb();
  // Guard on owner_token IS NULL so two people scanning the same stub can't both win.
  const update = await db.execute({
    sql: `UPDATE tags SET owner_token = ?, label = ?, owner_name = ?, owner_email = ?, owner_phone = ?,
        owner_user_id = ?, claimed_at = CURRENT_TIMESTAMP,
        status = CASE WHEN status = 'unclaimed' THEN 'active' ELSE status END
      WHERE code = ? AND owner_token IS NULL AND status != 'returned'`,
    args: [ownerToken, label, ownerName, email, phone, req.userId ?? null, tag.code]
  });
  if (update.rowsAffected === 0) {
    res.status(409).json({ error: 'This tag has already been claimed. Ask staff for a fresh one.' }); return;
  }
  await db.execute(event(tag.code, 'claimed', { actorUserId: req.userId }));

  const claimed = { ...tag, label };
  await notify(
    { email, phone },
    `Your ${itemName(claimed)} is tagged at ${tag.venue_name}`,
    `Tag ${formatTagCode(tag.code)}. Keep this link to check on it any time: ${ownerLink(tag, ownerToken)}`
  );

  res.status(201).json({ ownerToken, status: tag.status === 'unclaimed' ? 'active' : tag.status });
});

router.post('/:code/report', async (req: AuthRequest, res: Response): Promise<void> => {
  const tag = await loadTag(req.params.code);
  if (!tag) { res.status(404).json({ error: 'Tag not found' }); return; }
  if (tag.status === 'returned') { res.status(400).json({ error: 'This item has already been returned. Thank you!' }); return; }

  const handoff = req.body.handoff === 'owner' ? 'owner' : 'staff';
  const message = cleanText(req.body.message, 1000);
  if (handoff === 'owner') {
    if (!tag.owner_token) { res.status(400).json({ error: 'This tag isn’t linked to anyone yet. Please hand it to staff.' }); return; }
    if (!message) { res.status(400).json({ error: 'Write a short message for the owner' }); return; }
  }

  const details = {
    finderName: cleanText(req.body.finderName, 80),
    finderContact: cleanText(req.body.finderContact, 200),
    message,
    lat: cleanCoord(req.body.lat, 90),
    lng: cleanCoord(req.body.lng, 180)
  };
  if (details.lat === null || details.lng === null) { details.lat = null; details.lng = null; }

  const stmts: InStatement[] = [event(tag.code, handoff === 'owner' ? 'found_message' : 'found_to_staff', details)];
  if (tag.status !== 'at_desk') {
    stmts.push({ sql: "UPDATE tags SET status = 'found' WHERE code = ?", args: [tag.code] });
  }
  await getDb().batch(stmts, 'write');

  if (tag.owner_token) {
    const lines = [
      handoff === 'staff'
        ? `Someone found it and is taking it to ${tag.venue_name} staff.`
        : 'Someone found it and sent you a message:',
      message ? `"${message}"` : null,
      details.finderContact ? `You can reach them at: ${details.finderContact}` : null,
      `Details: ${ownerLink(tag)}`
    ];
    await notify(ownerRecipient(tag), `Good news: your ${itemName(tag)} was found`, lines.filter(Boolean).join('\n'));
  }

  res.status(201).json({ success: true });
});

router.post('/:code/staff', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const tag = await loadTag(req.params.code);
  if (!tag || !(await getMembership(tag.org_id, req.userId))) { res.status(404).json({ error: 'Tag not found' }); return; }

  const { action } = req.body;
  const actor = { actorUserId: req.userId };
  const stmts: InStatement[] = [];

  if (action === 'received') {
    stmts.push(
      { sql: "UPDATE tags SET status = 'at_desk' WHERE code = ?", args: [tag.code] },
      event(tag.code, 'received', actor)
    );
  } else if (action === 'returned' || action === 'return_and_reset') {
    stmts.push(
      { sql: "UPDATE tags SET status = 'returned', returned_at = CURRENT_TIMESTAMP WHERE code = ?", args: [tag.code] },
      event(tag.code, 'returned', actor)
    );
  }
  if (action === 'reset' || action === 'return_and_reset') {
    // Wipe the previous guest's details so the physical tag can go back in the pile.
    // The reset event is logged first so it belongs to the cycle it closes.
    stmts.push(
      event(tag.code, 'reset', actor),
      {
        sql: `UPDATE tags SET status = 'unclaimed', label = NULL, owner_name = NULL, owner_email = NULL,
          owner_phone = NULL, owner_user_id = NULL, owner_token = NULL, claimed_at = NULL, returned_at = NULL,
          cycle = cycle + 1
          WHERE code = ?`,
        args: [tag.code]
      }
    );
  }
  if (stmts.length === 0) { res.status(400).json({ error: 'Invalid action' }); return; }

  await getDb().batch(stmts, 'write');

  if (action === 'received' && tag.owner_token) {
    await notify(
      ownerRecipient(tag),
      `Your ${itemName(tag)} is waiting for you at ${tag.venue_name}`,
      [tag.return_instructions, `Details: ${ownerLink(tag)}`].filter(Boolean).join('\n')
    );
  }
  res.json({ success: true });
});

router.post('/:code/owner', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const tag = await loadTag(req.params.code);
  if (!tag || (await viewerFor(req, tag)) !== 'owner') { res.status(404).json({ error: 'Tag not found' }); return; }

  if (req.body.action === 'picked_up') {
    await getDb().batch([
      { sql: "UPDATE tags SET status = 'returned', returned_at = CURRENT_TIMESTAMP WHERE code = ?", args: [tag.code] },
      event(tag.code, 'picked_up')
    ], 'write');
    res.json({ success: true });
    return;
  }
  res.status(400).json({ error: 'Invalid action' });
});

export default router;
