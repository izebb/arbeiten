import type { RecurrenceRule } from './types'

const DAY = 'YYYY-MM-DD'.length

/** Parses a YYYY-MM-DD string to a local-midnight Date. */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, DAY).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Formats a Date to a local YYYY-MM-DD string. */
export function formatDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  const day = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  // Clamp to the last day of the resulting month (e.g. Jan 31 -> Feb 28).
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, lastDay))
  return r
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

/**
 * Returns the next occurrence (YYYY-MM-DD) after `fromDay` for the given rule.
 * `fromDay` is normally the task's current due date.
 */
export function nextOccurrence(rule: RecurrenceRule, fromDay: string): string {
  const base = parseDay(fromDay)

  if (rule === 'daily') return formatDay(addDays(base, 1))
  if (rule === 'weekly') return formatDay(addDays(base, 7))
  if (rule === 'monthly') return formatDay(addMonths(base, 1))
  if (rule === 'weekdays') {
    let next = addDays(base, 1)
    while (isWeekend(next)) next = addDays(next, 1)
    return formatDay(next)
  }
  if (rule.startsWith('every:')) {
    const n = parseInt(rule.slice('every:'.length), 10)
    return formatDay(addDays(base, Number.isFinite(n) && n > 0 ? n : 1))
  }
  return formatDay(addDays(base, 1))
}

const RULE_LABELS: Record<string, string> = {
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month'
}

/** Human label for a recurrence rule, used in the UI. */
export function recurrenceLabel(rule: RecurrenceRule | null): string {
  if (!rule) return 'No repeat'
  if (rule in RULE_LABELS) return RULE_LABELS[rule]
  if (rule.startsWith('every:')) return `Every ${rule.slice('every:'.length)} days`
  return 'Custom'
}
