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
    }
  ];
  await db.batch(stmts, 'write');
}
