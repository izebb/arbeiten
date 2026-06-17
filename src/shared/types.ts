// Shared domain + API types, imported by main, preload, and renderer.

export type Priority = 1 | 2 | 3 | 4 // 1 = P1 (highest), 4 = none
export type FocusMode = 'timer' | 'pomodoro'

/** Recurrence presets stored verbatim in tasks.recurrence_rule. */
export type RecurrenceRule = 'daily' | 'weekdays' | 'weekly' | 'monthly' | `every:${number}`

export interface Project {
  id: number
  name: string
  color: string
  parentId: number | null
  position: number
  isInbox: boolean
  isFavorite: boolean
  createdAt: string
}

export interface Label {
  id: number
  name: string
  color: string
}

export interface Task {
  id: number
  projectId: number
  parentId: number | null
  content: string
  description: string
  priority: Priority
  dueDate: string | null // YYYY-MM-DD
  recurrence: RecurrenceRule | null
  durationMinutes: number | null
  isCompleted: boolean
  completedAt: string | null
  position: number
  createdAt: string
  updatedAt: string
  labelIds: number[]
  commentCount: number
  subtaskCount: number
}

export interface TaskComment {
  id: number
  taskId: number
  body: string
  createdAt: string
}

export interface FocusSession {
  id: number
  taskId: number | null
  mode: FocusMode
  startedAt: string
  endedAt: string | null
  plannedSeconds: number
  actualSeconds: number
  completed: boolean
}

export interface Stats {
  completedToday: number
  completedThisWeek: number
  currentStreak: number
  dailyGoal: number
}

export interface Counts {
  today: number
  inbox: number
  upcoming: number
  byProject: Record<number, number>
  byLabel: Record<number, number>
}

// ---- Input DTOs ----

export interface NewProject {
  name: string
  color?: string
  parentId?: number | null
  isFavorite?: boolean
}
export type ProjectPatch = Partial<Pick<Project, 'name' | 'color' | 'parentId' | 'isFavorite'>>

export interface NewLabel {
  name: string
  color?: string
}
export type LabelPatch = Partial<Pick<Label, 'name' | 'color'>>

export interface NewTask {
  content: string
  projectId?: number | null
  parentId?: number | null
  description?: string
  priority?: Priority
  dueDate?: string | null
  recurrence?: RecurrenceRule | null
  durationMinutes?: number | null
  labelIds?: number[]
}
export interface TaskPatch {
  content?: string
  projectId?: number | null
  description?: string
  priority?: Priority
  dueDate?: string | null
  recurrence?: RecurrenceRule | null
  durationMinutes?: number | null
  labelIds?: number[]
}

export interface NewComment {
  taskId: number
  body: string
}

export interface NewFocusSession {
  taskId: number | null
  mode: FocusMode
  plannedSeconds: number
}

export type ViewKind = 'inbox' | 'today' | 'upcoming' | 'project' | 'label' | 'search' | 'priority'
export interface ViewQuery {
  kind: ViewKind
  projectId?: number
  labelId?: number
  text?: string
  priority?: Priority
}

// ---- IPC API surface (exposed on window.api) ----

export interface Api {
  projects: {
    list(): Promise<Project[]>
    create(input: NewProject): Promise<Project>
    update(id: number, patch: ProjectPatch): Promise<Project>
    delete(id: number): Promise<void>
    reorder(orderedIds: number[]): Promise<void>
  }
  tasks: {
    list(query: ViewQuery): Promise<Task[]>
    get(id: number): Promise<Task | null>
    create(input: NewTask): Promise<Task>
    update(id: number, patch: TaskPatch): Promise<Task>
    setComplete(id: number, completed: boolean): Promise<Task | null>
    delete(id: number): Promise<void>
    reorder(orderedIds: number[]): Promise<void>
    subtasks(parentId: number): Promise<Task[]>
    counts(): Promise<Counts>
  }
  labels: {
    list(): Promise<Label[]>
    create(input: NewLabel): Promise<Label>
    update(id: number, patch: LabelPatch): Promise<Label>
    delete(id: number): Promise<void>
  }
  comments: {
    listForTask(taskId: number): Promise<TaskComment[]>
    create(input: NewComment): Promise<TaskComment>
    delete(id: number): Promise<void>
  }
  focus: {
    create(input: NewFocusSession): Promise<number>
    complete(input: { id: number; actualSeconds: number; completed: boolean }): Promise<void>
    notify(input: { title: string; body: string }): Promise<void>
  }
  stats: {
    summary(): Promise<Stats>
  }
  settings: {
    getAll(): Promise<Record<string, string>>
    set(key: string, value: string): Promise<void>
  }
  /** Subscribe to changes made by another process (e.g. the agent CLI). Returns an unsubscribe fn. */
  onExternalChange(callback: () => void): () => void
}

/** IPC channel the main process uses to notify renderers of external DB changes. */
export const EXTERNAL_CHANGE_CHANNEL = 'external-change'

/** Namespaced method names used to build IPC channels + the preload bridge. */
export const API_METHODS = {
  projects: ['list', 'create', 'update', 'delete', 'reorder'],
  tasks: ['list', 'get', 'create', 'update', 'setComplete', 'delete', 'reorder', 'subtasks', 'counts'],
  labels: ['list', 'create', 'update', 'delete'],
  comments: ['listForTask', 'create', 'delete'],
  focus: ['create', 'complete', 'notify'],
  stats: ['summary'],
  settings: ['getAll', 'set']
} as const

export type ApiNamespace = keyof typeof API_METHODS

export const channelName = (ns: string, method: string): string => `${ns}:${method}`
