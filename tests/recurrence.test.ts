import { describe, it, expect } from 'vitest'
import { nextOccurrence, recurrenceLabel } from '../src/shared/recurrence'

describe('nextOccurrence', () => {
  it('advances daily by one day', () => {
    expect(nextOccurrence('daily', '2026-06-17')).toBe('2026-06-18')
  })

  it('advances weekly by seven days', () => {
    expect(nextOccurrence('weekly', '2026-06-17')).toBe('2026-06-24')
  })

  it('advances monthly and clamps to month length', () => {
    expect(nextOccurrence('monthly', '2026-06-17')).toBe('2026-07-17')
    expect(nextOccurrence('monthly', '2026-01-31')).toBe('2026-02-28')
  })

  it('skips weekends for weekdays', () => {
    // 2026-06-19 is a Friday -> next weekday is Monday 2026-06-22
    expect(nextOccurrence('weekdays', '2026-06-19')).toBe('2026-06-22')
    // Wednesday -> Thursday
    expect(nextOccurrence('weekdays', '2026-06-17')).toBe('2026-06-18')
  })

  it('advances every:N by N days', () => {
    expect(nextOccurrence('every:3', '2026-06-17')).toBe('2026-06-20')
  })
})

describe('recurrenceLabel', () => {
  it('labels presets and custom intervals', () => {
    expect(recurrenceLabel(null)).toBe('No repeat')
    expect(recurrenceLabel('daily')).toBe('Every day')
    expect(recurrenceLabel('every:5')).toBe('Every 5 days')
  })
})
