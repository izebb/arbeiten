import Database from 'better-sqlite3'
import { migrate } from './migrations'
import type { DB } from './types'

/** Opens (or creates) the SQLite database, applies pragmas + migrations. */
export function openDatabase(path: string): DB {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}
