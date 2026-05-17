/**
 * Magnus Bot — SQLite Connection
 * Copyright © DJAMEL
 */
"use strict";

const path = require("path");
const fs   = require("fs-extra");

const dbDir  = path.join(process.cwd(), "database/data");
const dbPath = path.join(dbDir, "magnus.sqlite");

fs.ensureDirSync(dbDir);

let db;
try {
  const Database = require("better-sqlite3");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      threadID TEXT PRIMARY KEY,
      data     TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS users (
      userID TEXT PRIMARY KEY,
      data   TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS globals (
      key  TEXT PRIMARY KEY,
      data TEXT NOT NULL DEFAULT '{}'
    );
  `);
} catch (e) {
  console.warn("[DB] better-sqlite3 not available, using in-memory fallback:", e.message);
  db = {
    prepare: () => ({
      get: () => null,
      run: () => {},
      all: () => [],
    }),
    exec: () => {},
  };
}

module.exports = db;
