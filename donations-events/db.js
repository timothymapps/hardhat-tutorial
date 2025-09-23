// db.js
import Database from 'better-sqlite3';

export const db = new Database('events.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS donations_events (
    name TEXT NOT NULL,
    txHash TEXT NOT NULL,
    blockNumber INTEGER NOT NULL,
    logIndex INTEGER NOT NULL,
    removed INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    jsonArgs TEXT NOT NULL,
    PRIMARY KEY (blockNumber, logIndex)
  );

  CREATE INDEX IF NOT EXISTS idx_donations_events_name ON donations_events (name);
  CREATE INDEX IF NOT EXISTS idx_donations_events_block ON donations_events (blockNumber);
`);

export const insertEvt = db.prepare(`
  INSERT OR IGNORE INTO donations_events
    (name, txHash, blockNumber, logIndex, removed, ts, jsonArgs)
  VALUES
    (@name, @txHash, @blockNumber, @logIndex, @removed, @ts, @jsonArgs)
`);

export const lastNByName = db.prepare(`
  SELECT name, txHash, blockNumber, logIndex, removed, ts, jsonArgs
  FROM donations_events
  WHERE name = @name
  ORDER BY blockNumber DESC, logIndex DESC
  LIMIT @limit
`);

export const recentConfirmed = db.prepare(`
  SELECT name, txHash, blockNumber, logIndex, removed, ts, jsonArgs
  FROM donations_events
  WHERE removed = 0 AND @tip - blockNumber >= @minConf
  ORDER BY blockNumber DESC, logIndex DESC
  LIMIT @limit
`);
