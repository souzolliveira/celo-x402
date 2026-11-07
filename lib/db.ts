import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
let database: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (database) return database;

  const { DatabaseSync: Sqlite } = require("node:sqlite") as typeof import("node:sqlite");
  const directory = process.env.VERCEL ? path.join("/tmp", "brief") : path.join(process.cwd(), "data");
  fs.mkdirSync(directory, { recursive: true });
  database = new Sqlite(path.join(directory, "turista.sqlite"));
  database.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      document TEXT NOT NULL,
      phone TEXT NOT NULL,
      kyc_status TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_account (
      wallet TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      balance_atomic TEXT NOT NULL,
      low_balance_atomic TEXT NOT NULL,
      topup_notified INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_purchase (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('onchain', 'pix')),
      amount_atomic TEXT NOT NULL,
      tx_hash TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS spend (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL,
      service TEXT NOT NULL,
      amount_atomic TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return database;
}
