CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, credits INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, balance INTEGER NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider TEXT NOT NULL, package_id TEXT NOT NULL, amount_fen INTEGER NOT NULL, credits INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, paid_at TEXT);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id, created_at);
