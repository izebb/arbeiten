import { describe, it, expect } from 'vitest'
import { formatClock, formatDuration } from '../src/shared/time'

describe('formatClock', () => {
  it('formats minutes:seconds', () => {
    expect(formatClock(90)).toBe('1:30')
    expect(formatClock(5)).toBe('0:05')
  })
  it('formats hours:minutes:seconds past an hour', () => {
    expect(formatClock(3661)).toBe('1:01:01')
  })
  it('clamps negatives to zero', () => {
    expect(formatClock(-10)).toBe('0:00')
  })
})

describe('formatDuration', () => {
  it('formats minute estimates', () => {
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(90)).toBe('1h 30m')
    expect(formatDuration(120)).toBe('2h')
  })
})
