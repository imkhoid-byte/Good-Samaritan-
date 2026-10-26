import { createClient, Client, InStatement } from '@libsql/client';

let _client: Client | null = null;

export function getDb(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL || 'file:data/good_samaritan.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;
    _client = createClient({ url, authToken });
  }
  return _client;
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
    { sql: 'CREATE INDEX IF NOT EXISTS idx_tag_events_tag ON tag_events(tag_code, created_at)', args: [] }
  ];
  await db.batch(stmts, 'write');
}
