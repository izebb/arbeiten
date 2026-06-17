// Renderer-side date helpers for due-date chips.

export function todayISO(): string {
  return localISO(new Date())
}

export function localISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export type DueTone = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'future'

export interface DueChip {
  label: string
  tone: DueTone
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Returns a Todoist-style due label + tone for a YYYY-MM-DD string. */
export function describeDue(due: string | null, now: Date = new Date()): DueChip | null {
  if (!due) return null
  const target = parse(due)
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((target.getTime() - base.getTime()) / 86_400_000)

  if (diffDays < 0) {
    const label =
      diffDays === -1 ? 'Yesterday' : `${MONTHS[target.getMonth()]} ${target.getDate()}`
    return { label, tone: 'overdue' }
  }
  if (diffDays === 0) return { label: 'Today', tone: 'today' }
  if (diffDays === 1) return { label: 'Tomorrow', tone: 'tomorrow' }
  if (diffDays < 7) return { label: WEEKDAYS[target.getDay()], tone: 'upcoming' }

  const sameYear = target.getFullYear() === now.getFullYear()
  const label = `${MONTHS[target.getMonth()]} ${target.getDate()}${sameYear ? '' : ' ' + target.getFullYear()}`
  return { label, tone: 'future' }
}

/** Group header label for the Upcoming view. */
export function dueGroupLabel(due: string, now: Date = new Date()): string {
  const target = parse(due)
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((target.getTime() - base.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  const wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    target.getDay()
  ]
  return `${MONTHS[target.getMonth()]} ${target.getDate()} · ${wd}`
}
