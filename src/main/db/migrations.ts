import type { DB } from './types'

interface Migration {
  version: number
  up(db: DB): void
}

const migrations: Migration[] = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT '#808080',
          parent_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
          position INTEGER NOT NULL DEFAULT 0,
          is_inbox INTEGER NOT NULL DEFAULT 0,
          is_favorite INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE labels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL DEFAULT '#808080'
        );

        CREATE TABLE tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          priority INTEGER NOT NULL DEFAULT 4,
          due_date TEXT,
          recurrence_rule TEXT,
          duration_minutes INTEGER,
          is_completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE task_labels (
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
          PRIMARY KEY (task_id, label_id)
        );

        CREATE TABLE comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE focus_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
          mode TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          planned_seconds INTEGER NOT NULL,
          actual_seconds INTEGER NOT NULL DEFAULT 0,
          completed INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX idx_tasks_project ON tasks(project_id);
        CREATE INDEX idx_tasks_parent ON tasks(parent_id);
        CREATE INDEX idx_tasks_due ON tasks(due_date);
        CREATE INDEX idx_tasks_completed ON tasks(is_completed);
      `)

      const now = new Date().toISOString()
      db.prepare(
        `INSERT INTO projects (name, color, position, is_inbox, is_favorite, created_at)
         VALUES (?, ?, ?, 1, 0, ?)`
      ).run('Inbox', '#246fe0', 0, now)

      const defaults: Record<string, string> = {
        theme: 'light',
        pomodoro_focus: '25',
        pomodoro_short_break: '5',
        pomodoro_long_break: '15',
        pomodoro_long_interval: '4',
        daily_goal: '5'
      }
      const ins = db.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)`)
      for (const [k, v] of Object.entries(defaults)) ins.run(k, v)
    }
  }
]

export const LATEST_VERSION = migrations[migrations.length - 1].version

function getVersion(db: DB): number {
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined
  return row ? parseInt(row.value, 10) : 0
}

/** Creates the meta table (if needed) and applies all pending migrations. */
export function migrate(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  const current = getVersion(db)
  const pending = migrations.filter((m) => m.version > current).sort((a, b) => a.version - b.version)
  if (pending.length === 0) return

  const setVersion = db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  )
  const run = db.transaction(() => {
    for (const m of pending) {
      m.up(db)
      setVersion.run(String(m.version))
    }
  })
  run()
}
