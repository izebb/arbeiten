import type { DB } from './types'
import { nextOccurrence } from '@shared/recurrence'
import type {
  FocusSession,
  Label,
  LabelPatch,
  NewComment,
  NewFocusSession,
  NewLabel,
  NewProject,
  NewTask,
  Priority,
  Project,
  ProjectPatch,
  Stats,
  Task,
  TaskComment,
  TaskPatch,
  ViewQuery
} from '@shared/types'

const nowISO = (): string => new Date().toISOString()

function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---- Row mappers ----

interface ProjectRow {
  id: number
  name: string
  color: string
  parent_id: number | null
  position: number
  is_inbox: number
  is_favorite: number
  created_at: string
}
const mapProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  color: r.color,
  parentId: r.parent_id,
  position: r.position,
  isInbox: !!r.is_inbox,
  isFavorite: !!r.is_favorite,
  createdAt: r.created_at
})

interface TaskRow {
  id: number
  project_id: number
  parent_id: number | null
  content: string
  description: string
  priority: number
  due_date: string | null
  recurrence_rule: string | null
  duration_minutes: number | null
  is_completed: number
  completed_at: string | null
  position: number
  created_at: string
  updated_at: string
  label_ids: string | null
  comment_count: number
  subtask_count: number
}
const mapTask = (r: TaskRow): Task => ({
  id: r.id,
  projectId: r.project_id,
  parentId: r.parent_id,
  content: r.content,
  description: r.description,
  priority: r.priority as Priority,
  dueDate: r.due_date,
  recurrence: (r.recurrence_rule as Task['recurrence']) ?? null,
  durationMinutes: r.duration_minutes,
  isCompleted: !!r.is_completed,
  completedAt: r.completed_at,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  labelIds: r.label_ids ? String(r.label_ids).split(',').map(Number) : [],
  commentCount: r.comment_count ?? 0,
  subtaskCount: r.subtask_count ?? 0
})

const TASK_SELECT = `
  SELECT t.*,
    (SELECT GROUP_CONCAT(label_id) FROM task_labels tl WHERE tl.task_id = t.id) AS label_ids,
    (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count,
    (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id) AS subtask_count
  FROM tasks t`

export interface Repositories {
  projects: {
    list(): Project[]
    create(input: NewProject): Project
    update(id: number, patch: ProjectPatch): Project
    delete(id: number): void
    reorder(orderedIds: number[]): void
  }
  tasks: {
    list(query: ViewQuery): Task[]
    get(id: number): Task | null
    create(input: NewTask): Task
    update(id: number, patch: TaskPatch): Task
    setComplete(id: number, completed: boolean): Task | null
    delete(id: number): void
    reorder(orderedIds: number[]): void
    subtasks(parentId: number): Task[]
  }
  labels: {
    list(): Label[]
    create(input: NewLabel): Label
    update(id: number, patch: LabelPatch): Label
    delete(id: number): void
  }
  comments: {
    listForTask(taskId: number): TaskComment[]
    create(input: NewComment): TaskComment
    delete(id: number): void
  }
  focus: {
    create(input: NewFocusSession): number
    complete(input: { id: number; actualSeconds: number; completed: boolean }): void
  }
  stats: {
    summary(): Stats
  }
  settings: {
    getAll(): Record<string, string>
    set(key: string, value: string): void
  }
}

export function createRepositories(db: DB): Repositories {
  const inboxId = (): number =>
    (db.prepare(`SELECT id FROM projects WHERE is_inbox = 1`).get() as { id: number }).id

  const getTaskRow = (id: number): TaskRow | undefined =>
    db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id) as TaskRow | undefined

  const requireTask = (id: number): Task => {
    const row = getTaskRow(id)
    if (!row) throw new Error(`Task ${id} not found`)
    return mapTask(row)
  }

  const setTaskLabels = (taskId: number, labelIds: number[]): void => {
    db.prepare(`DELETE FROM task_labels WHERE task_id = ?`).run(taskId)
    const ins = db.prepare(`INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)`)
    for (const lid of labelIds) ins.run(taskId, lid)
  }

  // ---- projects ----
  const projects: Repositories['projects'] = {
    list() {
      const rows = db
        .prepare(`SELECT * FROM projects ORDER BY is_inbox DESC, position ASC, id ASC`)
        .all() as ProjectRow[]
      return rows.map(mapProject)
    },
    create(input) {
      const parentId = input.parentId ?? null
      const max = db
        .prepare(
          `SELECT COALESCE(MAX(position), -1) AS m FROM projects WHERE parent_id IS ?`
        )
        .get(parentId) as { m: number }
      const info = db
        .prepare(
          `INSERT INTO projects (name, color, parent_id, position, is_favorite, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(input.name, input.color ?? '#808080', parentId, max.m + 1, input.isFavorite ? 1 : 0, nowISO())
      return mapProject(
        db.prepare(`SELECT * FROM projects WHERE id = ?`).get(info.lastInsertRowid as number) as ProjectRow
      )
    },
    update(id, patch) {
      const sets: string[] = []
      const vals: unknown[] = []
      if (patch.name !== undefined) (sets.push('name = ?'), vals.push(patch.name))
      if (patch.color !== undefined) (sets.push('color = ?'), vals.push(patch.color))
      if (patch.parentId !== undefined) (sets.push('parent_id = ?'), vals.push(patch.parentId))
      if (patch.isFavorite !== undefined) (sets.push('is_favorite = ?'), vals.push(patch.isFavorite ? 1 : 0))
      if (sets.length) {
        vals.push(id)
        db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
      }
      return mapProject(db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as ProjectRow)
    },
    delete(id) {
      const row = db.prepare(`SELECT is_inbox FROM projects WHERE id = ?`).get(id) as
        | { is_inbox: number }
        | undefined
      if (row?.is_inbox) throw new Error('Cannot delete the Inbox project')
      db.prepare(`DELETE FROM projects WHERE id = ?`).run(id)
    },
    reorder(orderedIds) {
      const upd = db.prepare(`UPDATE projects SET position = ? WHERE id = ?`)
      const tx = db.transaction((ids: number[]) => ids.forEach((id, i) => upd.run(i, id)))
      tx(orderedIds)
    }
  }

  // ---- tasks ----
  const tasks: Repositories['tasks'] = {
    list(query) {
      const today = localDateString(new Date())
      let where = ''
      let order = 'ORDER BY t.position ASC, t.id ASC'
      const params: Record<string, unknown> = {}

      switch (query.kind) {
        case 'inbox':
          where = `t.parent_id IS NULL AND t.is_completed = 0 AND t.project_id = @inbox`
          params.inbox = inboxId()
          break
        case 'today':
          where = `t.parent_id IS NULL AND t.is_completed = 0 AND t.due_date IS NOT NULL AND t.due_date <= @today`
          params.today = today
          order = 'ORDER BY t.due_date ASC, t.priority ASC, t.position ASC'
          break
        case 'upcoming':
          where = `t.parent_id IS NULL AND t.is_completed = 0 AND t.due_date IS NOT NULL AND t.due_date >= @today`
          params.today = today
          order = 'ORDER BY t.due_date ASC, t.priority ASC, t.position ASC'
          break
        case 'project':
          where = `t.parent_id IS NULL AND t.is_completed = 0 AND t.project_id = @pid`
          params.pid = query.projectId
          break
        case 'label':
          where = `t.is_completed = 0 AND t.id IN (SELECT task_id FROM task_labels WHERE label_id = @lid)`
          params.lid = query.labelId
          break
        case 'search':
          where = `t.is_completed = 0 AND t.content LIKE @text`
          params.text = `%${query.text ?? ''}%`
          break
      }

      const rows = db.prepare(`${TASK_SELECT} WHERE ${where} ${order}`).all(params) as TaskRow[]
      return rows.map(mapTask)
    },
    get(id) {
      const row = getTaskRow(id)
      return row ? mapTask(row) : null
    },
    subtasks(parentId) {
      const rows = db
        .prepare(`${TASK_SELECT} WHERE t.parent_id = ? ORDER BY t.position ASC, t.id ASC`)
        .all(parentId) as TaskRow[]
      return rows.map(mapTask)
    },
    create(input) {
      const projectId = input.projectId ?? inboxId()
      const parentId = input.parentId ?? null
      const max = db
        .prepare(
          `SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE project_id = ? AND parent_id IS ?`
        )
        .get(projectId, parentId) as { m: number }
      const now = nowISO()
      const info = db
        .prepare(
          `INSERT INTO tasks
             (project_id, parent_id, content, description, priority, due_date,
              recurrence_rule, duration_minutes, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          projectId,
          parentId,
          input.content,
          input.description ?? '',
          input.priority ?? 4,
          input.dueDate ?? null,
          input.recurrence ?? null,
          input.durationMinutes ?? null,
          max.m + 1,
          now,
          now
        )
      const id = info.lastInsertRowid as number
      if (input.labelIds?.length) setTaskLabels(id, input.labelIds)
      return requireTask(id)
    },
    update(id, patch) {
      const sets: string[] = []
      const vals: unknown[] = []
      const col = (c: string, v: unknown): void => {
        sets.push(`${c} = ?`)
        vals.push(v)
      }
      if (patch.content !== undefined) col('content', patch.content)
      if (patch.projectId !== undefined) col('project_id', patch.projectId)
      if (patch.description !== undefined) col('description', patch.description)
      if (patch.priority !== undefined) col('priority', patch.priority)
      if (patch.dueDate !== undefined) col('due_date', patch.dueDate)
      if (patch.recurrence !== undefined) col('recurrence_rule', patch.recurrence)
      if (patch.durationMinutes !== undefined) col('duration_minutes', patch.durationMinutes)
      col('updated_at', nowISO())
      vals.push(id)
      db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
      if (patch.labelIds !== undefined) setTaskLabels(id, patch.labelIds)
      return requireTask(id)
    },
    setComplete(id, completed) {
      const task = tasks.get(id)
      if (!task) return null

      if (completed && task.recurrence && task.dueDate) {
        // Recurring: reschedule to the next occurrence instead of completing.
        const next = nextOccurrence(task.recurrence, task.dueDate)
        db.prepare(`UPDATE tasks SET due_date = ?, updated_at = ? WHERE id = ?`).run(next, nowISO(), id)
        return requireTask(id)
      }

      if (completed) {
        db.prepare(`UPDATE tasks SET is_completed = 1, completed_at = ?, updated_at = ? WHERE id = ?`).run(
          nowISO(),
          nowISO(),
          id
        )
      } else {
        db.prepare(
          `UPDATE tasks SET is_completed = 0, completed_at = NULL, updated_at = ? WHERE id = ?`
        ).run(nowISO(), id)
      }
      return requireTask(id)
    },
    delete(id) {
      db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id)
    },
    reorder(orderedIds) {
      const upd = db.prepare(`UPDATE tasks SET position = ? WHERE id = ?`)
      const tx = db.transaction((ids: number[]) => ids.forEach((id, i) => upd.run(i, id)))
      tx(orderedIds)
    }
  }

  // ---- labels ----
  const labels: Repositories['labels'] = {
    list() {
      return db.prepare(`SELECT * FROM labels ORDER BY name COLLATE NOCASE ASC`).all() as Label[]
    },
    create(input) {
      const info = db
        .prepare(`INSERT INTO labels (name, color) VALUES (?, ?)`)
        .run(input.name, input.color ?? '#808080')
      return db.prepare(`SELECT * FROM labels WHERE id = ?`).get(info.lastInsertRowid as number) as Label
    },
    update(id, patch) {
      const sets: string[] = []
      const vals: unknown[] = []
      if (patch.name !== undefined) (sets.push('name = ?'), vals.push(patch.name))
      if (patch.color !== undefined) (sets.push('color = ?'), vals.push(patch.color))
      if (sets.length) {
        vals.push(id)
        db.prepare(`UPDATE labels SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
      }
      return db.prepare(`SELECT * FROM labels WHERE id = ?`).get(id) as Label
    },
    delete(id) {
      db.prepare(`DELETE FROM labels WHERE id = ?`).run(id)
    }
  }

  // ---- comments ----
  const comments: Repositories['comments'] = {
    listForTask(taskId) {
      return db
        .prepare(`SELECT id, task_id AS taskId, body, created_at AS createdAt FROM comments WHERE task_id = ? ORDER BY created_at ASC`)
        .all(taskId) as TaskComment[]
    },
    create(input) {
      const info = db
        .prepare(`INSERT INTO comments (task_id, body, created_at) VALUES (?, ?, ?)`)
        .run(input.taskId, input.body, nowISO())
      return db
        .prepare(`SELECT id, task_id AS taskId, body, created_at AS createdAt FROM comments WHERE id = ?`)
        .get(info.lastInsertRowid as number) as TaskComment
    },
    delete(id) {
      db.prepare(`DELETE FROM comments WHERE id = ?`).run(id)
    }
  }

  // ---- focus ----
  const focus: Repositories['focus'] = {
    create(input) {
      const info = db
        .prepare(
          `INSERT INTO focus_sessions (task_id, mode, started_at, planned_seconds) VALUES (?, ?, ?, ?)`
        )
        .run(input.taskId, input.mode, nowISO(), input.plannedSeconds)
      return info.lastInsertRowid as number
    },
    complete(input) {
      db.prepare(
        `UPDATE focus_sessions SET ended_at = ?, actual_seconds = ?, completed = ? WHERE id = ?`
      ).run(nowISO(), input.actualSeconds, input.completed ? 1 : 0, input.id)
    }
  }

  // ---- stats ----
  const stats: Repositories['stats'] = {
    summary() {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const sevenDaysAgo = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6
      ).toISOString()

      const completedToday = (
        db
          .prepare(`SELECT COUNT(*) AS c FROM tasks WHERE is_completed = 1 AND completed_at >= ?`)
          .get(startOfToday) as { c: number }
      ).c
      const completedThisWeek = (
        db
          .prepare(`SELECT COUNT(*) AS c FROM tasks WHERE is_completed = 1 AND completed_at >= ?`)
          .get(sevenDaysAgo) as { c: number }
      ).c

      const completionDays = (
        db
          .prepare(`SELECT completed_at FROM tasks WHERE is_completed = 1 AND completed_at IS NOT NULL`)
          .all() as { completed_at: string }[]
      ).map((r) => localDateString(new Date(r.completed_at)))
      const daySet = new Set(completionDays)

      let streak = 0
      const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      if (!daySet.has(localDateString(cursor))) cursor.setDate(cursor.getDate() - 1)
      while (daySet.has(localDateString(cursor))) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      }

      const goalRow = db.prepare(`SELECT value FROM meta WHERE key = 'daily_goal'`).get() as
        | { value: string }
        | undefined
      const dailyGoal = goalRow ? parseInt(goalRow.value, 10) : 5

      return { completedToday, completedThisWeek, currentStreak: streak, dailyGoal }
    }
  }

  // ---- settings ----
  const settings: Repositories['settings'] = {
    getAll() {
      const rows = db.prepare(`SELECT key, value FROM meta`).all() as { key: string; value: string }[]
      return Object.fromEntries(rows.map((r) => [r.key, r.value]))
    },
    set(key, value) {
      db.prepare(
        `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(key, value)
    }
  }

  return { projects, tasks, labels, comments, focus, stats, settings }
}

export type { FocusSession }
