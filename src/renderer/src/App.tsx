import { useEffect } from 'react'
import { useStore } from './store'
import Sidebar from './components/Sidebar'
import MainView from './components/MainView'
import TaskEditor from './components/TaskEditor'
import FocusPanel from './components/FocusPanel'
import { QuickAddModal } from './components/QuickAdd'

export default function App() {
  const ready = useStore((s) => s.ready)
  const theme = useStore((s) => s.theme)
  const selectedTaskId = useStore((s) => s.selectedTaskId)
  const init = useStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  if (!ready) {
    return (
      <div className="boot">
        <div className="boot-spinner" />
      </div>
    )
  }

  return (
    <div className="app">
      <Sidebar />
      <MainView />
      {selectedTaskId != null && <TaskEditor taskId={selectedTaskId} />}
      <FocusPanel />
      <QuickAddModal />
    </div>
  )
}
