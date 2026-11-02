import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { notify } from '../notify';

const router = Router();
const TYPES = ['brand', 'education', 'nonprofit', 'csr', 'other'];

router.post('/inquiries', async (req: Request, res: Response): Promise<void> => {
  const { orgName, contactName, email, partnerType, message } = req.body;
  if (!orgName?.trim() || !contactName?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'Organization, name and email are required' }); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid email address' }); return;
  }
  if (!TYPES.includes(partnerType)) {
    res.status(400).json({ error: 'Choose a partnership type' }); return;
  }
  const db = getDb();
  await db.execute({
    sql: 'INSERT INTO partner_inquiries (id, org_name, contact_name, email, partner_type, message) VALUES (?, ?, ?, ?, ?, ?)',
    args: [uuidv4(), orgName.trim(), contactName.trim(), email.trim().toLowerCase(), partnerType, message?.trim()?.slice(0, 2000) || null]
  });
  if (process.env.PARTNERS_EMAIL) {
    await notify({ email: process.env.PARTNERS_EMAIL }, `New partner inquiry: ${orgName.trim()}`,
      `${contactName.trim()} <${email.trim()}> (${partnerType})\n\n${message?.trim() || ''}`);
  }
  res.status(201).json({ success: true });
});

export default router;
