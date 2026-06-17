import { create } from 'zustand'
import { parseQuickAdd, resolveDueDate } from '@shared/quickAddParser'
import { todayISO } from './lib/date'
import type {
  Counts,
  Label,
  NewTask,
  Project,
  ProjectPatch,
  Stats,
  Task,
  TaskPatch,
  ViewQuery
} from '@shared/types'

type Screen = 'tasks' | 'filters' | 'productivity'
type Theme = 'light' | 'dark'

const emptyCounts: Counts = { today: 0, inbox: 0, upcoming: 0, byProject: {}, byLabel: {} }
const emptyStats: Stats = { completedToday: 0, completedThisWeek: 0, currentStreak: 0, dailyGoal: 5 }

interface AppState {
  ready: boolean
  projects: Project[]
  labels: Label[]
  tasks: Task[]
  counts: Counts
  stats: Stats
  view: ViewQuery
  viewTitle: string
  screen: Screen
  theme: Theme
  settings: Record<string, string>
  selectedTaskId: number | null
  focusOpen: boolean
  quickAddOpen: boolean

  init: () => Promise<void>
  refresh: () => Promise<void>
  applyExternalChange: () => Promise<void>
  reloadProjects: () => Promise<void>
  reloadLabels: () => Promise<void>
  selectView: (view: ViewQuery, title: string) => void
  openScreen: (screen: Screen) => void

  quickAddTask: (text: string) => Promise<void>
  addTask: (input: NewTask) => Promise<void>
  toggleTask: (id: number, completed: boolean) => Promise<void>
  updateTask: (id: number, patch: TaskPatch) => Promise<Task>
  deleteTask: (id: number) => Promise<void>
  reorderTasks: (ids: number[]) => Promise<void>

  createProject: (name: string, color: string) => Promise<void>
  updateProject: (id: number, patch: ProjectPatch) => Promise<void>
  deleteProject: (id: number) => Promise<void>
  reorderProjects: (ids: number[]) => Promise<void>

  createLabel: (name: string, color: string) => Promise<void>
  updateLabel: (id: number, patch: { name?: string; color?: string }) => Promise<void>
  deleteLabel: (id: number) => Promise<void>

  setTheme: (theme: Theme) => Promise<void>
  setSetting: (key: string, value: string) => Promise<void>
  openTask: (id: number) => void
  closeTask: () => void
  setFocusOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  projects: [],
  labels: [],
  tasks: [],
  counts: emptyCounts,
  stats: emptyStats,
  view: { kind: 'today' },
  viewTitle: 'Today',
  screen: 'tasks',
  theme: 'light',
  settings: {},
  selectedTaskId: null,
  focusOpen: false,
  quickAddOpen: false,

  async init() {
    const [projects, labels, settings] = await Promise.all([
      window.api.projects.list(),
      window.api.labels.list(),
      window.api.settings.getAll()
    ])
    const theme: Theme = settings.theme === 'dark' ? 'dark' : 'light'
    set({ projects, labels, settings, theme })
    await get().refresh()
    set({ ready: true })
  },

  async refresh() {
    const { view, screen } = get()
    const [counts, stats] = await Promise.all([
      window.api.tasks.counts(),
      window.api.stats.summary()
    ])
    if (screen === 'tasks') {
      const tasks = await window.api.tasks.list(view)
      set({ tasks })
    }
    set({ counts, stats })
  },

  async applyExternalChange() {
    // Another process (e.g. the agent CLI) changed the DB; resync everything.
    const [projects, labels] = await Promise.all([
      window.api.projects.list(),
      window.api.labels.list()
    ])
    set({ projects, labels })
    await get().refresh()
  },

  async reloadProjects() {
    set({ projects: await window.api.projects.list() })
  },
  async reloadLabels() {
    set({ labels: await window.api.labels.list() })
  },

  selectView(view, title) {
    set({ view, viewTitle: title, screen: 'tasks', selectedTaskId: null })
    void get().refresh()
  },
  openScreen(screen) {
    set({ screen, selectedTaskId: null })
    void get().refresh()
  },

  async quickAddTask(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    const parsed = parseQuickAdd(trimmed)
    const { view, projects, labels } = get()

    let projectId: number | undefined
    let dueDate: string | null = resolveDueDate(parsed.dueText)

    if (view.kind === 'project' && view.projectId) projectId = view.projectId
    if (view.kind === 'today' && !dueDate) dueDate = todayISO()

    if (parsed.project) {
      const p = projects.find((x) => x.name.toLowerCase() === parsed.project!.toLowerCase())
      if (p) projectId = p.id
    }

    const labelIds: number[] = []
    for (const name of parsed.labels) {
      let l = labels.find((x) => x.name.toLowerCase() === name.toLowerCase())
      if (!l) l = await window.api.labels.create({ name })
      labelIds.push(l.id)
    }
    if (labelIds.length) await get().reloadLabels()

    await window.api.tasks.create({
      content: parsed.content || trimmed,
      projectId,
      dueDate,
      priority: parsed.priority,
      labelIds
    })
    await get().refresh()
  },

  async addTask(input) {
    await window.api.tasks.create(input)
    await get().refresh()
  },
  async toggleTask(id, completed) {
    await window.api.tasks.setComplete(id, completed)
    await get().refresh()
  },
  async updateTask(id, patch) {
    const t = await window.api.tasks.update(id, patch)
    await get().refresh()
    return t
  },
  async deleteTask(id) {
    await window.api.tasks.delete(id)
    if (get().selectedTaskId === id) set({ selectedTaskId: null })
    await get().refresh()
  },
  async reorderTasks(ids) {
    const map = new Map(get().tasks.map((t) => [t.id, t]))
    const reordered = ids.map((id) => map.get(id)).filter((t): t is Task => !!t)
    set({ tasks: reordered })
    await window.api.tasks.reorder(ids)
  },

  async createProject(name, color) {
    await window.api.projects.create({ name, color })
    await get().reloadProjects()
    await get().refresh()
  },
  async updateProject(id, patch) {
    await window.api.projects.update(id, patch)
    await get().reloadProjects()
  },
  async deleteProject(id) {
    await window.api.projects.delete(id)
    await get().reloadProjects()
    const { view } = get()
    if (view.kind === 'project' && view.projectId === id) {
      get().selectView({ kind: 'today' }, 'Today')
    } else {
      await get().refresh()
    }
  },
  async reorderProjects(ids) {
    const map = new Map(get().projects.map((p) => [p.id, p]))
    set({ projects: ids.map((id) => map.get(id)).filter((p): p is Project => !!p) })
    await window.api.projects.reorder(ids)
    await get().reloadProjects()
  },

  async createLabel(name, color) {
    await window.api.labels.create({ name, color })
    await get().reloadLabels()
    await get().refresh()
  },
  async updateLabel(id, patch) {
    await window.api.labels.update(id, patch)
    await get().reloadLabels()
  },
  async deleteLabel(id) {
    await window.api.labels.delete(id)
    await get().reloadLabels()
    const { view } = get()
    if (view.kind === 'label' && view.labelId === id) get().selectView({ kind: 'today' }, 'Today')
    else await get().refresh()
  },

  async setTheme(theme) {
    set({ theme })
    await window.api.settings.set('theme', theme)
  },
  async setSetting(key, value) {
    await window.api.settings.set(key, value)
    set({ settings: { ...get().settings, [key]: value } })
  },
  openTask(id) {
    set({ selectedTaskId: id })
  },
  closeTask() {
    set({ selectedTaskId: null })
  },
  setFocusOpen(open) {
    set({ focusOpen: open })
  },
  setQuickAddOpen(open) {
    set({ quickAddOpen: open })
  }
}))
