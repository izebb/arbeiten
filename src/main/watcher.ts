import { watch, type FSWatcher } from 'node:fs'
import { basename, dirname } from 'node:path'
import type { DB } from './db/types'

/**
 * Reads SQLite's data_version. This counter only changes when commits are made by
 * a *different* connection than the one querying it — so on the app's own DB handle
 * it changes only when an external process (e.g. the agent CLI) writes.
 */
function readVersion(db: DB): number {
  return db.pragma('data_version', { simple: true }) as number
}

/**
 * Watches the database files for changes from other processes and invokes `onChange`
 * when the data actually changed. Uses fs.watch for an immediate trigger plus a slow
 * interval as a safety net (some filesystems drop watch events). Returns a disposer.
 */
export function watchExternalChanges(db: DB, dbPath: string, onChange: () => void): () => void {
  let last = readVersion(db)
  let debounce: NodeJS.Timeout | null = null
  let watcher: FSWatcher | null = null

  const check = (): void => {
    let v: number
    try {
      v = readVersion(db)
    } catch {
      return
    }
    if (v !== last) {
      last = v
      onChange()
    }
  }

  const schedule = (): void => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(check, 150)
  }

  try {
    const base = basename(dbPath)
    watcher = watch(dirname(dbPath), (_event, filename) => {
      // WAL writes touch arbeiten.db-wal/-shm; match the whole family.
      if (!filename || filename.startsWith(base)) schedule()
    })
  } catch {
    // Directory watching unavailable — rely on the interval below.
  }

  const interval = setInterval(check, 2000)

  return () => {
    if (debounce) clearTimeout(debounce)
    clearInterval(interval)
    watcher?.close()
  }
}
