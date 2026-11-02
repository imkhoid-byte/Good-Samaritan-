import { createClient as createLibsqlRemote } from '@libsql/client/web';
import type { Client as LibsqlClient } from '@libsql/client';
import { neon } from '@neondatabase/serverless';

// One small database interface with three backends, chosen from the environment:
//
//   TURSO_DATABASE_URL    → Turso (libSQL over HTTP)
//   NETLIFY_DATABASE_URL  → Netlify DB (Neon Postgres over HTTP)
//   neither, locally      → a SQLite file in server/data/
//
// Queries are written once in SQLite style (`?` placeholders, CURRENT_TIMESTAMP,
// datetime('now', '-5 minutes')) and translated for Postgres in toPostgres().
// Timestamps are stored as UTC text ("YYYY-MM-DD HH:MM:SS") on every backend so
// the client parses them the same way.

export type InValue = string | number | bigint | boolean | null | undefined;
export type InStatement = string | { sql: string; args?: InValue[] };

export interface ResultSet {
  rows: any[];
  rowsAffected: number;
}

export interface Db {
  dialect: 'sqlite' | 'postgres';
  execute(stmt: InStatement): Promise<ResultSet>;
  /** Runs every statement in one transaction: all succeed or none do. */
  batch(stmts: InStatement[], mode?: 'write' | 'read'): Promise<ResultSet[]>;
}

/** Minimal Postgres driver surface, so tests can plug in a local server. */
export interface PgDriver {
  query(text: string, params: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
  transaction(queries: { text: string; params: unknown[] }[]): Promise<{ rows: any[]; rowCount: number | null }[]>;
}

export class ConfigError extends Error {}

// True when running as a Netlify Function / AWS Lambda.
const IS_SERVERLESS = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

function normalize(stmt: InStatement): { sql: string; args: InValue[] } {
  return typeof stmt === 'string' ? { sql: stmt, args: [] } : { sql: stmt.sql, args: stmt.args ?? [] };
}

const PG_NOW = "to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')";

export function toPostgres(sql: string): string {
  const translated = sql
    .replace(/datetime\('now',\s*'(-?\d+) (seconds?|minutes?|hours?|days?)'\)/gi,
      (_m, n, unit) => `to_char((now() at time zone 'utc') + interval '${n} ${unit}', 'YYYY-MM-DD HH24:MI:SS')`)
    .replace(/\bCURRENT_TIMESTAMP\b/g, PG_NOW)
    .replace(/\bDATETIME\b/g, 'TEXT')
    // Insertion-order tiebreak: SQLite's rowid, Postgres's physical row id.
    .replace(/\browid\b/g, 'ctid');

  // `?` → `$1, $2…`, skipping anything inside single-quoted strings.
  let out = '';
  let n = 0;
  let inString = false;
  for (const ch of translated) {
    if (ch === "'") inString = !inString;
    out += !inString && ch === '?' ? `$${++n}` : ch;
  }
  return out;
}

function pgArgs(args: InValue[]): unknown[] {
  return args.map(a => (a === undefined ? null : typeof a === 'bigint' ? a.toString() : a));
}

export function postgresDb(driver: PgDriver): Db {
  const prep = (stmt: InStatement) => {
    const { sql, args } = normalize(stmt);
    return { text: toPostgres(sql), params: pgArgs(args) };
  };
  const wrap = (r: { rows: any[]; rowCount: number | null }): ResultSet => ({ rows: r.rows, rowsAffected: r.rowCount ?? 0 });
  return {
    dialect: 'postgres',
    async execute(stmt) {
      const q = prep(stmt);
      return wrap(await driver.query(q.text, q.params));
    },
    async batch(stmts) {
      if (stmts.length === 0) return [];
      return (await driver.transaction(stmts.map(prep))).map(wrap);
    }
  };
}

function neonDriver(url: string): PgDriver {
  const sql = neon(url, { fullResults: true });
  return {
    query: (text, params) => sql.query(text, params),
    transaction: queries => sql.transaction(queries.map(q => sql.query(q.text, q.params)))
  };
}

function libsqlDb(client: LibsqlClient): Db {
  const wrap = (r: any): ResultSet => ({ rows: r.rows, rowsAffected: r.rowsAffected });
  const toLibsql = (stmt: InStatement) => {
    const { sql, args } = normalize(stmt);
    return { sql, args: args.map(a => (a === undefined ? null : a)) as any[] };
  };
  return {
    dialect: 'sqlite',
    async execute(stmt) {
      return wrap(await client.execute(toLibsql(stmt)));
    },
    async batch(stmts, mode = 'write') {
      return (await client.batch(stmts.map(toLibsql), mode)).map(wrap);
    }
  };
}

let _db: Db | null = null;

/** Test hook: run the app against any Postgres driver. */
export function useDb(db: Db): void {
  _db = db;
}

export function getDb(): Db {
  if (_db) return _db;

  if (process.env.TURSO_DATABASE_URL) {
    // The web client has no native code, so it bundles cleanly into functions.
    _db = libsqlDb(createLibsqlRemote({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }));
  } else if (process.env.NETLIFY_DATABASE_URL) {
    _db = postgresDb(neonDriver(process.env.NETLIFY_DATABASE_URL));
  } else if (IS_SERVERLESS) {
    // Serverless filesystems are read-only and wiped between invocations.
    throw new ConfigError('Database not configured. Enable Netlify DB for this site (or set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN), then redeploy.');
  } else {
    // Local development. Required lazily so the native SQLite binary is only
    // loaded when actually used, never inside a deployed function.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@libsql/client') as typeof import('@libsql/client');
    _db = libsqlDb(createClient({ url: 'file:data/good_samaritan.db' }));
  }
  return _db;
}

export async function initDb(): Promise<void> {
  const db = getDb();
  const stmts: InStatement[] = [
    {
      sql: `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_color TEXT NOT NULL DEFAULT '#16a34a',
        points INTEGER NOT NULL DEFAULT 0,
        subscription TEXT NOT NULL DEFAULT 'free',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      args: []
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'other',
        qr_code TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        reward_offered INTEGER NOT NULL DEFAULT 0,
        reward_note TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        found_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: []
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        content TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id)
      )`,
      args: []
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS reward_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: []
    },
    // Venue mode: an organization (coat check, airport, hospital…) prints
    // blank tags in batches; guests claim them on first scan, no account needed.
    {
      sql: `CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        venue_type TEXT NOT NULL DEFAULT 'other',
        return_instructions TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      args: []
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS org_members (
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (org_id, user_id),
        FOREIGN KEY (org_id) REFERENCES organizations(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: []
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS tag_batches (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        label TEXT NOT NULL,
        count INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (org_id) REFERENCES organizations(id)
      )`,
      args: []
    },
    // claim_key is printed on the guest's stub and only works while the tag is
    // unclaimed; owner_token is issued at claim time and rotates on every reuse.
    // cycle increments on each reset so a new guest never sees the last one's events.
    {
      sql: `CREATE TABLE IF NOT EXISTS tags (
        code TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        claim_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unclaimed',
        label TEXT,
        owner_name TEXT,
        owner_email TEXT,
        owner_phone TEXT,
        owner_user_id TEXT,
        owner_token TEXT,
        cycle INTEGER NOT NULL DEFAULT 0,
        claimed_at DATETIME,
        returned_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (org_id) REFERENCES organizations(id),
        FOREIGN KEY (batch_id) REFERENCES tag_batches(id)
      )`,
      args: []
    },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_tags_org ON tags(org_id, status)', args: [] },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_tags_owner_user ON tags(owner_user_id)', args: [] },
    {
      sql: `CREATE TABLE IF NOT EXISTS tag_events (
        id TEXT PRIMARY KEY,
        tag_code TEXT NOT NULL,
        type TEXT NOT NULL,
        cycle INTEGER NOT NULL DEFAULT 0,
        actor_user_id TEXT,
        finder_name TEXT,
        finder_contact TEXT,
        message TEXT,
        lat REAL,
        lng REAL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tag_code) REFERENCES tags(code)
      )`,
      args: []
    },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_tag_events_tag ON tag_events(tag_code, created_at)', args: [] },
    // Tag shop. Line items are stored as JSON because the catalog is static
    // and prices are snapshotted at order time.
    {
      sql: `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        items_json TEXT NOT NULL,
        total_cents INTEGER NOT NULL,
        ship_name TEXT NOT NULL,
        ship_address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'placed',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: []
    },
    // Charitable giving. user_id is null for donations made on behalf of an
    // anonymous finder (the platform's "kindness match").
    {
      sql: `CREATE TABLE IF NOT EXISTS donations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        donor_label TEXT NOT NULL,
        charity_id TEXT NOT NULL,
        cents INTEGER NOT NULL,
        source TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      args: []
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        item_id TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        hearts INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: []
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS partner_inquiries (
        id TEXT PRIMARY KEY,
        org_name TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        email TEXT NOT NULL,
        partner_type TEXT NOT NULL,
        message TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      args: []
    }
  ];
  await db.batch(stmts, 'write');

  // Columns added after the first release, for databases created before them.
  const additions: [string, string][] = [
    ['anonymous_mode', 'INTEGER NOT NULL DEFAULT 0'],
    ['premium_since', 'DATETIME']
  ];
  let have = new Set<string>();
  if (db.dialect === 'sqlite') {
    // SQLite has no ADD COLUMN IF NOT EXISTS, so check the live schema.
    const cols = await db.execute('PRAGMA table_info(users)');
    have = new Set(cols.rows.map((r: any) => String(r.name)));
  }
  for (const [name, def] of additions) {
    if (have.has(name)) continue;
    const ifNotExists = db.dialect === 'postgres' ? 'IF NOT EXISTS ' : '';
    try {
      await db.execute(`ALTER TABLE users ADD COLUMN ${ifNotExists}${name} ${def}`);
    } catch (err: any) {
      // Two cold starts can race to add the same column; that's fine.
      if (!/duplicate column|already exists/i.test(String(err?.message))) throw err;
    }
  }
}
