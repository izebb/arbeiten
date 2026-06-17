import { useStore } from '../store'
import { TargetIcon, CheckIcon, ChartIcon } from './Icons'

function Ring({ value, goal }: { value: number; goal: number }) {
  const r = 54
  const c = 2 * Math.PI * r
  const pct = Math.min(1, goal > 0 ? value / goal : 0)
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="ring">
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="var(--red)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="64" textAnchor="middle" className="ring-num">
        {value}
      </text>
      <text x="70" y="86" textAnchor="middle" className="ring-sub">
        of {goal}
      </text>
    </svg>
  )
}

export default function ProductivityView() {
  const stats = useStore((s) => s.stats)
  const setSetting = useStore((s) => s.setSetting)
  const refresh = useStore((s) => s.refresh)

  const changeGoal = async (delta: number): Promise<void> => {
    const next = Math.max(1, stats.dailyGoal + delta)
    await setSetting('daily_goal', String(next))
    await refresh()
  }

  const goalMet = stats.completedToday >= stats.dailyGoal

  return (
    <div className="productivity">
      <section className="prod-hero">
        <Ring value={stats.completedToday} goal={stats.dailyGoal} />
        <div className="prod-hero-body">
          <h2>{goalMet ? 'Daily goal reached 🎉' : 'Daily goal'}</h2>
          <p className="muted">
            {goalMet
              ? `You've completed ${stats.completedToday} tasks today.`
              : `${stats.dailyGoal - stats.completedToday} task${
                  stats.dailyGoal - stats.completedToday === 1 ? '' : 's'
                } to reach your goal.`}
          </p>
          <div className="goal-stepper">
            <span>Daily goal</span>
            <button className="step-btn" onClick={() => void changeGoal(-1)}>
              −
            </button>
            <strong>{stats.dailyGoal}</strong>
            <button className="step-btn" onClick={() => void changeGoal(1)}>
              +
            </button>
          </div>
        </div>
      </section>

      <section className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--due-today)' }}>
            <CheckIcon size={22} />
          </div>
          <div className="stat-num">{stats.completedToday}</div>
          <div className="stat-label">Completed today</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--p3)' }}>
            <ChartIcon size={22} />
          </div>
          <div className="stat-num">{stats.completedThisWeek}</div>
          <div className="stat-label">Last 7 days</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--red)' }}>
            <TargetIcon size={22} />
          </div>
          <div className="stat-num">
            {stats.currentStreak}
            <span className="stat-unit">d</span>
          </div>
          <div className="stat-label">Current streak</div>
        </div>
      </section>
    </div>
  )
}
