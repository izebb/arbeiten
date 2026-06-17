import { useState } from 'react'
import { useStore } from '../store'
import { describeDue } from '../lib/date'
import { formatDuration } from '@shared/time'
import { CalendarIcon, ClockIcon, CommentIcon, EditIcon, GripIcon, TrashIcon } from './Icons'
import type { Task } from '@shared/types'

const PRIORITY_COLOR: Record<number, string> = {
  1: 'var(--p1)',
  2: 'var(--p2)',
  3: 'var(--p3)',
  4: 'var(--p4)'
}

export default function TaskRow({
  task,
  showProject,
  dragHandleProps
}: {
  task: Task
  showProject?: boolean
  dragHandleProps?: Record<string, unknown>
}) {
  const toggleTask = useStore((s) => s.toggleTask)
  const openTask = useStore((s) => s.openTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const projects = useStore((s) => s.projects)
  const labels = useStore((s) => s.labels)
  const [checking, setChecking] = useState(false)

  const project = projects.find((p) => p.id === task.projectId)
  const due = describeDue(task.dueDate)
  const taskLabels = labels.filter((l) => task.labelIds.includes(l.id))
  const pc = PRIORITY_COLOR[task.priority]

  const onCheck = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setChecking(true)
    setTimeout(() => void toggleTask(task.id, true), 180)
  }

  const hasMeta =
    due || (showProject && project && !project.isInbox) || taskLabels.length > 0 || task.durationMinutes || task.commentCount > 0 || task.subtaskCount > 0

  return (
    <div className="task-row" onClick={() => openTask(task.id)}>
      {dragHandleProps && (
        <span
          className="drag-handle"
          title="Drag to reorder"
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
        >
          <GripIcon size={16} />
        </span>
      )}
      <button
        className={`checkbox p${task.priority}${checking ? ' checked' : ''}`}
        style={{ borderColor: pc, color: pc }}
        title="Complete task"
        onClick={onCheck}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" className="check-mark">
          <polyline
            points="20 6 9 17 4 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="task-main">
        <div className="task-content">{task.content}</div>
        {task.description && <div className="task-desc">{task.description}</div>}
        {hasMeta && (
          <div className="task-meta">
            {due && (
              <span className={`due-chip due-${due.tone}`}>
                <CalendarIcon size={12} />
                {due.label}
                {task.recurrence && <span className="recur-dot">↻</span>}
              </span>
            )}
            {task.durationMinutes ? (
              <span className="meta-chip">
                <ClockIcon size={12} />
                {formatDuration(task.durationMinutes)}
              </span>
            ) : null}
            {task.subtaskCount > 0 && (
              <span className="meta-chip">
                {0}/{task.subtaskCount}
              </span>
            )}
            {task.commentCount > 0 && (
              <span className="meta-chip">
                <CommentIcon size={12} />
                {task.commentCount}
              </span>
            )}
            {taskLabels.map((l) => (
              <span key={l.id} className="label-chip" style={{ color: l.color }}>
                {l.name}
              </span>
            ))}
            {showProject && project && !project.isInbox && (
              <span className="task-project">
                {project.name}
                <span className="project-dot tiny" style={{ background: project.color }} />
              </span>
            )}
          </div>
        )}
      </div>

      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title="Edit" onClick={() => openTask(task.id)}>
          <EditIcon size={16} />
        </button>
        <button
          className="icon-btn"
          title="Delete"
          onClick={() => {
            if (window.confirm('Delete this task?')) void deleteTask(task.id)
          }}
        >
          <TrashIcon size={16} />
        </button>
      </div>
    </div>
  )
}
