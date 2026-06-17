import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import { localISO, todayISO } from '../lib/date'
import { recurrenceLabel } from '@shared/recurrence'
import { CalendarIcon, CloseIcon, FlagIcon, ClockIcon, TagIcon, TrashIcon, PlusIcon } from './Icons'
import type { Priority, RecurrenceRule, Task, TaskComment, TaskPatch } from '@shared/types'

const DURATIONS = [0, 15, 25, 30, 45, 60, 90, 120]
const RECURRENCES: (RecurrenceRule | '')[] = ['', 'daily', 'weekdays', 'weekly', 'monthly', 'every:3']

export default function TaskEditor({ taskId }: { taskId: number }) {
  const projects = useStore((s) => s.projects)
  const labels = useStore((s) => s.labels)
  const updateTask = useStore((s) => s.updateTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const closeTask = useStore((s) => s.closeTask)
  const openTask = useStore((s) => s.openTask)

  const [task, setTask] = useState<Task | null>(null)
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [subText, setSubText] = useState('')
  const [commentText, setCommentText] = useState('')

  const load = useCallback(async () => {
    const t = await window.api.tasks.get(taskId)
    setTask(t)
    if (t) {
      setContent(t.content)
      setDescription(t.description)
    }
    setSubtasks(await window.api.tasks.subtasks(taskId))
    setComments(await window.api.comments.listForTask(taskId))
  }, [taskId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeTask()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeTask])

  if (!task) return null

  const patch = async (p: TaskPatch): Promise<void> => {
    await updateTask(taskId, p)
    setTask(await window.api.tasks.get(taskId))
  }

  const saveContent = (): void => {
    if (content.trim() && content !== task.content) void patch({ content: content.trim() })
  }
  const saveDescription = (): void => {
    if (description !== task.description) void patch({ description })
  }

  const toggleLabel = (id: number): void => {
    const next = task.labelIds.includes(id)
      ? task.labelIds.filter((x) => x !== id)
      : [...task.labelIds, id]
    void patch({ labelIds: next })
  }

  const addSubtask = async (): Promise<void> => {
    if (!subText.trim()) return
    await window.api.tasks.create({
      content: subText.trim(),
      parentId: taskId,
      projectId: task.projectId
    })
    setSubText('')
    await load()
    await useStore.getState().refresh()
  }

  const toggleSubtask = async (id: number, done: boolean): Promise<void> => {
    await window.api.tasks.setComplete(id, done)
    await load()
    await useStore.getState().refresh()
  }

  const addComment = async (): Promise<void> => {
    if (!commentText.trim()) return
    await window.api.comments.create({ taskId, body: commentText.trim() })
    setCommentText('')
    setComments(await window.api.comments.listForTask(taskId))
    await useStore.getState().refresh()
  }

  const removeComment = async (id: number): Promise<void> => {
    await window.api.comments.delete(id)
    setComments(await window.api.comments.listForTask(taskId))
    await useStore.getState().refresh()
  }

  const project = projects.find((p) => p.id === task.projectId)

  return (
    <div className="modal-overlay" onClick={closeTask}>
      <div className="task-editor" onClick={(e) => e.stopPropagation()}>
        <header className="editor-head">
          <span className="editor-project">
            <span className="project-dot" style={{ background: project?.color ?? '#808080' }} />
            {project?.name ?? 'Inbox'}
          </span>
          <button className="icon-btn" onClick={closeTask} title="Close">
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="editor-body">
          <div className="editor-main">
            <div className="editor-title-row">
              <button
                className={`checkbox p${task.priority}`}
                style={{ borderColor: priorityVar(task.priority), color: priorityVar(task.priority) }}
                onClick={async () => {
                  await useStore.getState().toggleTask(taskId, true)
                  closeTask()
                }}
                title="Complete task"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" className="check-mark">
                  <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" strokeWidth="3" />
                </svg>
              </button>
              <input
                className="editor-title"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={saveContent}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
              />
            </div>

            <textarea
              className="editor-desc"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
            />

            <div className="editor-sub">
              <h3>Sub-tasks</h3>
              {subtasks.map((s) => (
                <div key={s.id} className="subtask-row">
                  <button
                    className={`checkbox small p${s.priority}`}
                    style={{ borderColor: priorityVar(s.priority), color: priorityVar(s.priority) }}
                    onClick={() => void toggleSubtask(s.id, !s.isCompleted)}
                  >
                    {s.isCompleted && (
                      <svg viewBox="0 0 24 24" width="11" height="11" className="check-mark">
                        <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" strokeWidth="3" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`subtask-content${s.isCompleted ? ' done' : ''}`}
                    onClick={() => openTask(s.id)}
                  >
                    {s.content}
                  </span>
                </div>
              ))}
              <div className="subtask-add">
                <PlusIcon size={15} />
                <input
                  placeholder="Add sub-task"
                  value={subText}
                  onChange={(e) => setSubText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addSubtask()
                  }}
                />
              </div>
            </div>

            <div className="editor-comments">
              <h3>Comments</h3>
              {comments.map((c) => (
                <div key={c.id} className="comment-row">
                  <div className="comment-body">{c.body}</div>
                  <button className="icon-btn" onClick={() => void removeComment(c.id)} title="Delete">
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
              <div className="comment-add">
                <input
                  placeholder="Add a comment"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addComment()
                  }}
                />
                <button className="btn-primary sm" disabled={!commentText.trim()} onClick={() => void addComment()}>
                  Comment
                </button>
              </div>
            </div>
          </div>

          <aside className="editor-side">
            <Field label="Project" icon={null}>
              <select
                value={task.projectId}
                onChange={(e) => void patch({ projectId: Number(e.target.value) })}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Due date" icon={<CalendarIcon size={15} />}>
              <input
                type="date"
                value={task.dueDate ?? ''}
                onChange={(e) => void patch({ dueDate: e.target.value || null })}
              />
              <div className="quick-dates">
                <button onClick={() => void patch({ dueDate: todayISO() })}>Today</button>
                <button
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() + 1)
                    void patch({ dueDate: localISO(d) })
                  }}
                >
                  Tomorrow
                </button>
                <button onClick={() => void patch({ dueDate: null })}>Clear</button>
              </div>
            </Field>

            <Field label="Priority" icon={<FlagIcon size={15} />}>
              <select
                value={task.priority}
                onChange={(e) => void patch({ priority: Number(e.target.value) as Priority })}
              >
                <option value={1}>Priority 1</option>
                <option value={2}>Priority 2</option>
                <option value={3}>Priority 3</option>
                <option value={4}>Priority 4</option>
              </select>
            </Field>

            <Field label="Duration" icon={<ClockIcon size={15} />}>
              <select
                value={task.durationMinutes ?? 0}
                onChange={(e) =>
                  void patch({ durationMinutes: Number(e.target.value) || null })
                }
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? 'None' : `${d} min`}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Repeat" icon={null}>
              <select
                value={task.recurrence ?? ''}
                onChange={(e) =>
                  void patch({ recurrence: (e.target.value || null) as RecurrenceRule | null })
                }
              >
                {RECURRENCES.map((r) => (
                  <option key={r} value={r}>
                    {recurrenceLabel((r || null) as RecurrenceRule | null)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Labels" icon={<TagIcon size={15} />}>
              <div className="label-toggles">
                {labels.length === 0 && <span className="empty-hint">No labels</span>}
                {labels.map((l) => (
                  <button
                    key={l.id}
                    className={`label-toggle${task.labelIds.includes(l.id) ? ' on' : ''}`}
                    style={task.labelIds.includes(l.id) ? { color: l.color, borderColor: l.color } : undefined}
                    onClick={() => toggleLabel(l.id)}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </Field>

            <button className="editor-delete" onClick={() => void deleteTask(taskId)}>
              <TrashIcon size={15} /> Delete task
            </button>
          </aside>
        </div>
      </div>
    </div>
  )
}

function priorityVar(p: number): string {
  return `var(--p${p})`
}

function Field({
  label,
  icon,
  children
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <div className="field-label">
        {icon}
        {label}
      </div>
      <div className="field-control">{children}</div>
    </div>
  )
}
