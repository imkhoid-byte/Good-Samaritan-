import crypto from 'crypto';
import { getDb } from './db';

// No 0/O, 1/I/L or U: codes get read aloud and typed in from printed stickers.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomString(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

export const generateTagCode = () => randomString(8);
export const generateClaimKey = () => randomString(12);
export const generateOwnerToken = () => crypto.randomBytes(24).toString('base64url');

// Accepts "gs-7k2m-q9xa", "7K2M Q9XA" etc. as typed by staff or guests.
export function normalizeTagCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^GS(?=.{8}$)/, '');
}

export function formatTagCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function secretsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// SQLite CURRENT_TIMESTAMP is UTC without a zone ("2026-10-26 12:00:00"),
// which some browsers parse as local time or not at all.
export function toIso(value: unknown): string | null {
  if (!value) return null;
  const s = String(value);
  return s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
}

export async function getMembership(orgId: string, userId: string | undefined): Promise<'owner' | 'staff' | null> {
  if (!userId) return null;
  const res = await getDb().execute({
    sql: 'SELECT role FROM org_members WHERE org_id = ? AND user_id = ?',
    args: [orgId, userId]
  });
  return (res.rows[0]?.role as 'owner' | 'staff' | undefined) ?? null;
}

export const VENUE_TYPES = ['coat_check', 'event', 'airport', 'hospital', 'hotel', 'school', 'other'];

export const TAG_STATUSES = ['unclaimed', 'active', 'found', 'at_desk', 'returned'];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Loose on input, strict on output: Twilio needs E.164. Ten bare digits are
// assumed to be a North American number.
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export function publicBaseUrl(): string {
  return process.env.BASE_URL || process.env.URL || 'http://localhost:3000';
}
