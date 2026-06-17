import { useState } from 'react'
import { useStore } from '../store'
import { PlusIcon } from './Icons'

const PLACEHOLDER = 'Task name —  try “Email boss tomorrow p1 #Work @urgent”'

export function InlineQuickAdd() {
  const quickAddTask = useStore((s) => s.quickAddTask)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    if (!text.trim() || busy) return
    setBusy(true)
    await quickAddTask(text)
    setText('')
    setBusy(false)
  }

  if (!open) {
    return (
      <button className="inline-add" onClick={() => setOpen(true)}>
        <span className="inline-add-plus">
          <PlusIcon size={16} strokeWidth={2.5} />
        </span>
        Add task
      </button>
    )
  }

  return (
    <div className="composer">
      <input
        className="composer-input"
        autoFocus
        value={text}
        placeholder={PLACEHOLDER}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
          if (e.key === 'Escape') {
            setOpen(false)
            setText('')
          }
        }}
      />
      <div className="composer-actions">
        <button
          className="btn-secondary"
          onClick={() => {
            setOpen(false)
            setText('')
          }}
        >
          Cancel
        </button>
        <button className="btn-primary" disabled={!text.trim()} onClick={() => void submit()}>
          Add task
        </button>
      </div>
    </div>
  )
}

export function QuickAddModal() {
  const open = useStore((s) => s.quickAddOpen)
  const setOpen = useStore((s) => s.setQuickAddOpen)
  const quickAddTask = useStore((s) => s.quickAddTask)
  const [text, setText] = useState('')

  if (!open) return null

  const close = (): void => {
    setOpen(false)
    setText('')
  }
  const submit = async (): Promise<void> => {
    if (!text.trim()) return
    await quickAddTask(text)
    close()
  }

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="quick-add-modal" onClick={(e) => e.stopPropagation()}>
        <input
          className="composer-input large"
          autoFocus
          value={text}
          placeholder={PLACEHOLDER}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
            if (e.key === 'Escape') close()
          }}
        />
        <div className="qa-hint">
          <span>
            <b>p1–p4</b> priority
          </span>
          <span>
            <b>#project</b>
          </span>
          <span>
            <b>@label</b>
          </span>
          <span>
            <b>today</b> / <b>tomorrow</b> / <b>mon</b>
          </span>
        </div>
        <div className="composer-actions">
          <button className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!text.trim()} onClick={() => void submit()}>
            Add task
          </button>
        </div>
      </div>
    </div>
  )
}
