import { useStore } from '../store'
import TaskRow from './TaskRow'
import { InlineQuickAdd } from './QuickAdd'
import { dueGroupLabel } from '../lib/date'
import { InboxIcon, TodayIcon } from './Icons'
import type { Task } from '@shared/types'

function EmptyState({ kind }: { kind: string }) {
  const map: Record<string, { icon: React.ReactNode; title: string; sub: string }> = {
    today: {
      icon: <TodayIcon size={40} />,
      title: 'Looks clear for today',
      sub: 'Enjoy the calm, or add a task to get going.'
    },
    inbox: {
      icon: <InboxIcon size={40} />,
      title: 'Your Inbox is empty',
      sub: 'Capture a task and organize it later.'
    }
  }
  const e = map[kind] ?? {
    icon: <TodayIcon size={40} />,
    title: 'No tasks here yet',
    sub: 'Add your first task below.'
  }
  return (
    <div className="empty-state">
      <div className="empty-icon">{e.icon}</div>
      <div className="empty-title">{e.title}</div>
      <div className="empty-sub">{e.sub}</div>
    </div>
  )
}

export default function TaskListView() {
  const tasks = useStore((s) => s.tasks)
  const view = useStore((s) => s.view)
  const showProject = view.kind !== 'project' && view.kind !== 'inbox'

  if (view.kind === 'upcoming') {
    const groups = new Map<string, Task[]>()
    for (const t of tasks) {
      const key = t.dueDate ?? 'No date'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }
    const keys = [...groups.keys()].sort()
    return (
      <div className="task-list">
        <InlineQuickAdd />
        {tasks.length === 0 && <EmptyState kind="upcoming" />}
        {keys.map((k) => (
          <section key={k} className="task-group">
            <h2 className="group-head">{dueGroupLabel(k)}</h2>
            {groups.get(k)!.map((t) => (
              <TaskRow key={t.id} task={t} showProject />
            ))}
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="task-list">
      <InlineQuickAdd />
      {tasks.length === 0 ? (
        <EmptyState kind={view.kind} />
      ) : (
        tasks.map((t) => <TaskRow key={t.id} task={t} showProject={showProject} />)
      )}
    </div>
  )
}
