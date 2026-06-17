import { useStore } from '../store'
import TaskListView from './TaskListView'
import FiltersLabelsView from './FiltersLabelsView'
import ProductivityView from './ProductivityView'
import { ClockIcon } from './Icons'

export default function MainView() {
  const screen = useStore((s) => s.screen)
  const viewTitle = useStore((s) => s.viewTitle)
  const taskCount = useStore((s) => s.tasks.length)
  const setFocusOpen = useStore((s) => s.setFocusOpen)

  const title =
    screen === 'filters' ? 'Filters & Labels' : screen === 'productivity' ? 'Productivity' : viewTitle

  return (
    <main className="main">
      <header className="topbar">
        <h1 className="view-title">{title}</h1>
        <div className="topbar-actions">
          {screen === 'tasks' && taskCount > 0 && (
            <span className="task-count">
              {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
            </span>
          )}
          <button className="focus-btn" onClick={() => setFocusOpen(true)}>
            <ClockIcon size={16} />
            Focus
          </button>
        </div>
      </header>
      <div className="content">
        <div className="content-inner">
          {screen === 'tasks' && <TaskListView />}
          {screen === 'filters' && <FiltersLabelsView />}
          {screen === 'productivity' && <ProductivityView />}
        </div>
      </div>
    </main>
  )
}
