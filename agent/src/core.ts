import Database from 'better-sqlite3'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { migrate } from '../../src/main/db/migrations'
import { createRepositories, type Repositories } from '../../src/main/db/repositories'
import { resolveDueDate } from '@shared/quickAddParser'
import type { Priority, RecurrenceRule, Task, ViewQuery } from '@shared/types'

/** Default Arbeiten DB location (override with ARBEITEN_DB). */
export function dbPath(): string {
  if (process.env.ARBEITEN_DB) return process.env.ARBEITEN_DB
  // Packaged app productName is "Arbeiten".
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Arbeiten', 'arbeiten.db')
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Arbeiten', 'arbeiten.db')
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'Arbeiten', 'arbeiten.db')
}

/** Opens (creating + migrating if needed) the DB and returns repositories + the handle. */
export function open(): { repos: Repositories; db: Database.Database } {
  const path = dbPath()
  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return { repos: createRepositories(db), db }
}

/** Opens the DB, runs `fn`, then closes — convenient for one-shot CLI/MCP calls. */
export function withRepos<T>(fn: (repos: Repositories) => T): T {
  const { repos, db } = open()
  try {
    return fn(repos)
  } finally {
    db.close()
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

function resolveDue(due: string | null | undefined): string | null {
  if (!due) return null
  if (ISO.test(due)) return due
  return resolveDueDate(due)
}

export interface AddTaskInput {
  content: string
  project?: string
  due?: string | null
  priority?: number
  labels?: string[]
  duration?: number | null
  recurrence?: string | null
  parentId?: number | null
}

/** Adds a task, resolving project/label names (creating them if absent) and natural dates. */
export function addTask(repos: Repositories, input: AddTaskInput): Task {
  let projectId: number | undefined
  if (input.project) {
    const existing = repos.projects
      .list()
      .find((p) => p.name.toLowerCase() === input.project!.toLowerCase())
    projectId = existing ? existing.id : repos.projects.create({ name: input.project }).id
  }

  const labelIds: number[] = []
  if (input.labels?.length) {
    const all = repos.labels.list()
    for (const name of input.labels) {
      const found = all.find((l) => l.name.toLowerCase() === name.toLowerCase())
      labelIds.push(found ? found.id : repos.labels.create({ name }).id)
    }
  }

  return repos.tasks.create({
    content: input.content,
    projectId,
    parentId: input.parentId ?? null,
    dueDate: resolveDue(input.due),
    priority: (input.priority as Priority) ?? 4,
    durationMinutes: input.duration ?? null,
    recurrence: (input.recurrence as RecurrenceRule | null) ?? null,
    labelIds
  })
}

export interface UpdateTaskInput {
  content?: string
  project?: string
  due?: string | null
  priority?: number
  labels?: string[]
  duration?: number | null
  recurrence?: string | null
  description?: string
}

export function updateTask(repos: Repositories, id: number, input: UpdateTaskInput): Task {
  const patch: Record<string, unknown> = {}
  if (input.content !== undefined) patch.content = input.content
  if (input.description !== undefined) patch.description = input.description
  if (input.priority !== undefined) patch.priority = input.priority
  if (input.duration !== undefined) patch.durationMinutes = input.duration
  if (input.recurrence !== undefined) patch.recurrence = input.recurrence
  if (input.due !== undefined) patch.dueDate = resolveDue(input.due)
  if (input.project !== undefined) {
    const existing = repos.projects
      .list()
      .find((p) => p.name.toLowerCase() === input.project!.toLowerCase())
    patch.projectId = existing ? existing.id : repos.projects.create({ name: input.project! }).id
  }
  if (input.labels !== undefined) {
    const all = repos.labels.list()
    patch.labelIds = input.labels.map((name) => {
      const found = all.find((l) => l.name.toLowerCase() === name.toLowerCase())
      return found ? found.id : repos.labels.create({ name }).id
    })
  }
  return repos.tasks.update(id, patch)
}

/** Parses a view string like "today", "project:Work", "label:errand", "search:milk", "priority:1". */
export function parseView(view: string): ViewQuery {
  const [kind, ...rest] = view.split(':')
  const arg = rest.join(':')
  switch (kind) {
    case 'inbox':
    case 'today':
    case 'upcoming':
      return { kind }
    case 'search':
      return { kind: 'search', text: arg }
    case 'priority':
      return { kind: 'priority', priority: (Number(arg) || 4) as Priority }
    case 'project':
    case 'label': {
      // resolved against names by the caller via resolveView
      return { kind, text: arg }
    }
    default:
      return { kind: 'today' }
  }
}

/** Resolves a view string into a ViewQuery, mapping project/label names to ids. */
export function resolveView(repos: Repositories, view: string): ViewQuery {
  const q = parseView(view)
  if (q.kind === 'project' && (q as { text?: string }).text) {
    const name = (q as { text?: string }).text!.toLowerCase()
    const p = repos.projects.list().find((x) => x.name.toLowerCase() === name)
    return { kind: 'project', projectId: p?.id }
  }
  if (q.kind === 'label' && (q as { text?: string }).text) {
    const name = (q as { text?: string }).text!.toLowerCase()
    const l = repos.labels.list().find((x) => x.name.toLowerCase() === name)
    return { kind: 'label', labelId: l?.id }
  }
  return q
}
