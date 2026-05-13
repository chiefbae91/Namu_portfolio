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

export default getDb;
