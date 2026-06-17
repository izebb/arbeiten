import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useInterval } from '../hooks/useInterval'
import { chime } from '../lib/chime'
import { formatClock } from '@shared/time'
import { CloseIcon, PauseIcon, PlayIcon, ResetIcon, ClockIcon } from './Icons'

type Mode = 'timer' | 'pomodoro'
type TimerKind = 'countdown' | 'stopwatch'
type Phase = 'focus' | 'short' | 'long'

function num(settings: Record<string, string>, key: string, fallback: number): number {
  const v = parseInt(settings[key], 10)
  return Number.isFinite(v) && v > 0 ? v : fallback
}

export default function FocusPanel() {
  const open = useStore((s) => s.focusOpen)
  const setOpen = useStore((s) => s.setFocusOpen)
  const settings = useStore((s) => s.settings)
  const tasks = useStore((s) => s.tasks)

  const focusMin = num(settings, 'pomodoro_focus', 25)
  const shortMin = num(settings, 'pomodoro_short_break', 5)
  const longMin = num(settings, 'pomodoro_long_break', 15)
  const longEvery = num(settings, 'pomodoro_long_interval', 4)

  const [mode, setMode] = useState<Mode>('pomodoro')
  const [timerKind, setTimerKind] = useState<TimerKind>('countdown')
  const [countdownMin, setCountdownMin] = useState(25)
  const [taskId, setTaskId] = useState<number | null>(null)

  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0) // remaining (countdown/pomodoro) or elapsed (stopwatch)
  const [phase, setPhase] = useState<Phase>('focus')
  const [cycles, setCycles] = useState(0)
  const sessionRef = useRef<number | null>(null)

  const phaseLen = (p: Phase): number =>
    (p === 'focus' ? focusMin : p === 'short' ? shortMin : longMin) * 60

  const startSession = async (planned: number): Promise<void> => {
    sessionRef.current = await window.api.focus.create({
      taskId,
      mode: mode === 'pomodoro' ? 'pomodoro' : 'timer',
      plannedSeconds: planned
    })
  }
  const endSession = async (actual: number, completed: boolean): Promise<void> => {
    if (sessionRef.current != null) {
      await window.api.focus.complete({ id: sessionRef.current, actualSeconds: actual, completed })
      sessionRef.current = null
    }
  }

  const announce = (title: string, body: string): void => {
    chime()
    void window.api.focus.notify({ title, body })
  }

  // --- controls ---
  const start = async (): Promise<void> => {
    if (running) return
    if (mode === 'timer') {
      if (timerKind === 'countdown') {
        if (seconds <= 0) setSeconds(countdownMin * 60)
        await startSession(countdownMin * 60)
      } else {
        await startSession(0)
      }
    } else {
      if (seconds <= 0) setSeconds(phaseLen(phase))
      if (phase === 'focus') await startSession(phaseLen('focus'))
    }
    setRunning(true)
  }

  const pause = (): void => setRunning(false)

  const reset = (): void => {
    setRunning(false)
    void endSession(0, false)
    if (mode === 'pomodoro') {
      setPhase('focus')
      setCycles(0)
      setSeconds(0)
    } else {
      setSeconds(0)
    }
  }

  const tick = (): void => {
    if (mode === 'timer' && timerKind === 'stopwatch') {
      setSeconds((s) => s + 1)
      return
    }
    setSeconds((s) => {
      if (s <= 1) {
        // completion handled below
        return 0
      }
      return s - 1
    })
  }

  useInterval(running ? tick : () => {}, running ? 1000 : null)

  // Handle countdown / pomodoro reaching zero (effect, not during render).
  useEffect(() => {
    if (!running) return
    if (mode === 'timer' && timerKind === 'stopwatch') return
    if (seconds !== 0) return
    let cancelled = false
    void (async () => {
      if (mode === 'pomodoro') {
        if (phase === 'focus') {
          const nextCycles = cycles + 1
          await endSession(phaseLen('focus'), true)
          announce('Focus session complete', 'Time for a break ☕')
          if (cancelled) return
          const next: Phase = nextCycles % longEvery === 0 ? 'long' : 'short'
          setCycles(nextCycles)
          setPhase(next)
          setSeconds(phaseLen(next))
        } else {
          announce('Break over', 'Back to focus 🍅')
          if (cancelled) return
          setPhase('focus')
          setSeconds(phaseLen('focus'))
          await startSession(phaseLen('focus'))
        }
      } else if (mode === 'timer' && timerKind === 'countdown') {
        setRunning(false)
        await endSession(countdownMin * 60, true)
        announce("Time's up!", 'Your countdown has finished.')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, running])

  const dotsDone = cycles === 0 ? 0 : cycles % longEvery === 0 ? longEvery : cycles % longEvery
  const display = useMemo(() => formatClock(seconds), [seconds])
  const phaseLabel = mode === 'timer' ? (timerKind === 'countdown' ? 'Countdown' : 'Stopwatch') : phase === 'focus' ? 'Focus' : phase === 'short' ? 'Short break' : 'Long break'

  return (
    <>
      {running && !open && (
        <button className="focus-pill" onClick={() => setOpen(true)}>
          <ClockIcon size={15} />
          <span>{display}</span>
          <span className="focus-pill-phase">{phaseLabel}</span>
        </button>
      )}

      <div className={`focus-drawer${open ? ' open' : ''}`}>
        <header className="focus-head">
          <h2>Focus</h2>
          <button className="icon-btn" onClick={() => setOpen(false)}>
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="focus-tabs">
          <button
            className={mode === 'pomodoro' ? 'active' : ''}
            onClick={() => {
              setMode('pomodoro')
              reset()
            }}
          >
            Pomodoro
          </button>
          <button
            className={mode === 'timer' ? 'active' : ''}
            onClick={() => {
              setMode('timer')
              setRunning(false)
              setSeconds(0)
            }}
          >
            Timer
          </button>
        </div>

        <div className={`focus-clock phase-${mode === 'pomodoro' ? phase : 'focus'}`}>
          <div className="focus-phase">{phaseLabel}</div>
          <div className="focus-time">{mode === 'timer' && timerKind === 'stopwatch' ? formatClock(seconds) : display}</div>
          {mode === 'pomodoro' && (
            <div className="pomo-dots">
              {Array.from({ length: longEvery }).map((_, i) => (
                <span key={i} className={`pomo-dot${i < dotsDone ? ' done' : ''}`} />
              ))}
            </div>
          )}
        </div>

        {mode === 'timer' && (
          <div className="timer-config">
            <div className="seg">
              <button className={timerKind === 'countdown' ? 'active' : ''} onClick={() => { setTimerKind('countdown'); setRunning(false); setSeconds(0) }}>
                Countdown
              </button>
              <button className={timerKind === 'stopwatch' ? 'active' : ''} onClick={() => { setTimerKind('stopwatch'); setRunning(false); setSeconds(0) }}>
                Stopwatch
              </button>
            </div>
            {timerKind === 'countdown' && (
              <label className="minutes">
                Minutes
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={countdownMin}
                  onChange={(e) => setCountdownMin(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            )}
          </div>
        )}

        <label className="focus-task">
          Attach task
          <select value={taskId ?? ''} onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">No task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.content}
              </option>
            ))}
          </select>
        </label>

        <div className="focus-controls">
          {!running ? (
            <button className="ctrl primary" onClick={() => void start()}>
              <PlayIcon size={20} /> Start
            </button>
          ) : (
            <button className="ctrl primary" onClick={pause}>
              <PauseIcon size={20} /> Pause
            </button>
          )}
          <button className="ctrl" onClick={reset}>
            <ResetIcon size={18} /> Reset
          </button>
        </div>
      </div>

      {open && <div className="focus-scrim" onClick={() => setOpen(false)} />}
    </>
  )
}
