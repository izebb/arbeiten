import { describe, it, expect } from 'vitest'
import { parseQuickAdd, resolveDueDate } from '../src/shared/quickAddParser'

describe('parseQuickAdd', () => {
  it('extracts content, priority, due, project and labels', () => {
    const r = parseQuickAdd('Buy milk tomorrow p1 #Shopping @errand')
    expect(r.content).toBe('Buy milk')
    expect(r.priority).toBe(1)
    expect(r.dueText).toBe('tomorrow')
    expect(r.project).toBe('Shopping')
    expect(r.labels).toEqual(['errand'])
  })

  it('defaults priority to 4 and leaves plain text untouched', () => {
    const r = parseQuickAdd('Just a task')
    expect(r.content).toBe('Just a task')
    expect(r.priority).toBe(4)
    expect(r.dueText).toBeUndefined()
    expect(r.project).toBeUndefined()
    expect(r.labels).toEqual([])
  })

  it('collects multiple labels', () => {
    const r = parseQuickAdd('Email boss @work @urgent')
    expect(r.content).toBe('Email boss')
    expect(r.labels).toEqual(['work', 'urgent'])
  })

  it('ignores out-of-range priority tokens', () => {
    const r = parseQuickAdd('Task p5')
    expect(r.priority).toBe(4)
    expect(r.content).toBe('Task p5')
  })

  it('captures ISO dates', () => {
    const r = parseQuickAdd('Pay rent 2026-07-01')
    expect(r.dueText).toBe('2026-07-01')
    expect(r.content).toBe('Pay rent')
  })
})

describe('resolveDueDate', () => {
  const today = new Date(2026, 5, 17) // Wednesday 2026-06-17

  it('resolves relative words', () => {
    expect(resolveDueDate('today', today)).toBe('2026-06-17')
    expect(resolveDueDate('tomorrow', today)).toBe('2026-06-18')
    expect(resolveDueDate('next week', today)).toBe('2026-06-24')
  })

  it('resolves weekdays to the next occurrence', () => {
    expect(resolveDueDate('mon', today)).toBe('2026-06-22')
    expect(resolveDueDate('fri', today)).toBe('2026-06-19')
  })

  it('passes through ISO dates and returns null for unknown text', () => {
    expect(resolveDueDate('2026-12-25', today)).toBe('2026-12-25')
    expect(resolveDueDate('someday', today)).toBeNull()
    expect(resolveDueDate(undefined, today)).toBeNull()
  })
})
