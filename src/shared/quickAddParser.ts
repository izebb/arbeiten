import type { Priority } from './types'

export interface QuickAddResult {
  content: string
  priority: Priority
  dueText?: string
  project?: string
  labels: string[]
}

const PRIORITY_RE = /\bp([1-4])\b/i
const LABEL_RE = /@([\p{L}\p{N}_-]+)/gu
const PROJECT_RE = /#([\p{L}\p{N}_-]+)/u
const ISO_RE = /\b(\d{4}-\d{2}-\d{2})\b/
const DUE_RE =
  /\b(today|tomorrow|tom|tod|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6
}

function tidy(s: string): string {
  return s.replace(/\s{2,}/g, ' ').trim()
}

/** Parses Todoist-style quick-add tokens out of a raw input string. */
export function parseQuickAdd(input: string): QuickAddResult {
  let working = input
  let priority: Priority = 4
  const labels: string[] = []
  let project: string | undefined
  let dueText: string | undefined

  const pm = working.match(PRIORITY_RE)
  if (pm) {
    priority = Number(pm[1]) as Priority
    working = working.replace(pm[0], ' ')
  }

  working = working.replace(LABEL_RE, (_m, name: string) => {
    labels.push(name)
    return ' '
  })

  const projm = working.match(PROJECT_RE)
  if (projm) {
    project = projm[1]
    working = working.replace(projm[0], ' ')
  }

  const iso = working.match(ISO_RE)
  if (iso) {
    dueText = iso[1]
    working = working.replace(iso[0], ' ')
  } else {
    const dm = working.match(DUE_RE)
    if (dm) {
      dueText = dm[1].toLowerCase()
      working = working.replace(dm[0], ' ')
    }
  }

  return { content: tidy(working), priority, dueText, project, labels }
}

function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Resolves a due-text token into a YYYY-MM-DD string (or null if unknown). */
export function resolveDueDate(dueText: string | undefined, today: Date = new Date()): string | null {
  if (!dueText) return null
  const t = dueText.toLowerCase().trim()
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  if (t === 'today' || t === 'tod') return fmt(base)
  if (t === 'tomorrow' || t === 'tom') {
    base.setDate(base.getDate() + 1)
    return fmt(base)
  }
  if (t === 'next week') {
    base.setDate(base.getDate() + 7)
    return fmt(base)
  }
  if (t in WEEKDAYS) {
    const target = WEEKDAYS[t]
    let delta = (target - base.getDay() + 7) % 7
    // Treat a bare weekday as the next future occurrence (today counts as today).
    if (delta === 0) delta = 0
    base.setDate(base.getDate() + delta)
    return fmt(base)
  }
  return null
}
