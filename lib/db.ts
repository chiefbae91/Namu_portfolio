import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'portfolio.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      currency TEXT DEFAULT 'USD',
      hidden INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      ticker TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      price REAL DEFAULT 0,
      fee REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      notes TEXT DEFAULT '',
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS cash_flow (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT DEFAULT '',
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      ticker TEXT NOT NULL,
      option_type TEXT NOT NULL,
      action TEXT NOT NULL,
      strike REAL NOT NULL,
      expiry TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      premium REAL NOT NULL,
      fee REAL DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS option_closes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      option_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      premium REAL NOT NULL,
      fee REAL DEFAULT 0,
      FOREIGN KEY (option_id) REFERENCES options(id)
    );

    CREATE TABLE IF NOT EXISTS lot_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sell_tx_id INTEGER NOT NULL,
      buy_tx_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      FOREIGN KEY (sell_tx_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (buy_tx_id) REFERENCES transactions(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS trading_hints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      hint_date TEXT NOT NULL,
      type TEXT NOT NULL,
      price REAL,
      current_price REAL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate price column from REAL to TEXT for multi-price support
  try {
    const cols = db.prepare('PRAGMA table_info(trading_hints)').all() as any[];
    const priceCol = cols.find((c: any) => c.name === 'price');
    if (priceCol && priceCol.type.toUpperCase() === 'REAL') {
      db.exec(`
        ALTER TABLE trading_hints RENAME TO trading_hints_old;
        CREATE TABLE trading_hints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticker TEXT NOT NULL,
          hint_date TEXT NOT NULL,
          type TEXT NOT NULL,
          price TEXT,
          current_price REAL,
          note TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO trading_hints
          SELECT id, ticker, hint_date, type,
            CASE WHEN price IS NULL THEN NULL ELSE CAST(price AS TEXT) END,
            current_price, note, created_at
          FROM trading_hints_old;
        DROP TABLE trading_hints_old;
      `);
    }
  } catch { /* migration failed or already done */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO settings (key, value) VALUES ('app_name', 'Namu Portfolio');
  `);

  // Safe migrations for existing DBs
  const migrations = [
    "ALTER TABLE transactions ADD COLUMN notes TEXT DEFAULT ''",
    "ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'USD'",
    "ALTER TABLE transactions ADD COLUMN lot_method TEXT DEFAULT 'average_cost'",
    "ALTER TABLE accounts ADD COLUMN hidden INTEGER DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'USD'",
    "ALTER TABLE transactions ADD COLUMN dividend_id INTEGER DEFAULT NULL",
    "ALTER TABLE transactions ADD COLUMN subtype TEXT DEFAULT NULL",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* already exists */ }
  }
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export default getDb;
