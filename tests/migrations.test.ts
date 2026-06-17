import { describe, it, expect } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { openDatabase } from '../src/main/db/connection'
import { LATEST_VERSION } from '../src/main/db/migrations'

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), 'arbeiten-')), 'test.db')
}

describe('migrations', () => {
  it('creates the schema, records the version, and seeds Inbox', () => {
    const db = openDatabase(tempDbPath())
    const ver = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as {
      value: string
    }
    expect(parseInt(ver.value, 10)).toBe(LATEST_VERSION)

    const inbox = db.prepare(`SELECT name, is_inbox FROM projects WHERE is_inbox = 1`).get() as {
      name: string
      is_inbox: number
    }
    expect(inbox.name).toBe('Inbox')

    const goal = db.prepare(`SELECT value FROM meta WHERE key = 'daily_goal'`).get() as {
      value: string
    }
    expect(goal.value).toBe('5')
    db.close()
  })

  it('does not re-seed when reopening an existing database', () => {
    const path = tempDbPath()
    openDatabase(path).close()
    const db = openDatabase(path)
    const count = db.prepare(`SELECT COUNT(*) AS c FROM projects WHERE is_inbox = 1`).get() as {
      c: number
    }
    expect(count.c).toBe(1)
    db.close()
  })
})
