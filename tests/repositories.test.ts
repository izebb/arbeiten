import { describe, it, expect, beforeEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { openDatabase } from '../src/main/db/connection'
import { createRepositories, type Repositories } from '../src/main/db/repositories'

function freshRepos(): Repositories {
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), 'arbeiten-')), 'test.db'))
  return createRepositories(db)
}

describe('repositories', () => {
  let repos: Repositories
  beforeEach(() => {
    repos = freshRepos()
  })

  it('seeds an Inbox project and creates tasks into it by default', () => {
    const inbox = repos.projects.list().find((p) => p.isInbox)!
    expect(inbox).toBeTruthy()
    const t = repos.tasks.create({ content: 'Buy milk' })
    expect(t.projectId).toBe(inbox.id)
    expect(t.priority).toBe(4)
    const inboxTasks = repos.tasks.list({ kind: 'inbox' })
    expect(inboxTasks.map((x) => x.content)).toEqual(['Buy milk'])
  })

  it('creates a project and lists its tasks ordered by position', () => {
    const proj = repos.projects.create({ name: 'Work', color: '#ff0000' })
    repos.tasks.create({ content: 'A', projectId: proj.id })
    repos.tasks.create({ content: 'B', projectId: proj.id })
    const list = repos.tasks.list({ kind: 'project', projectId: proj.id })
    expect(list.map((t) => t.content)).toEqual(['A', 'B'])
    expect(list[0].position).toBeLessThan(list[1].position)
  })

  it('completes a task and sets completedAt; reopening clears it', () => {
    const t = repos.tasks.create({ content: 'Done soon' })
    const done = repos.tasks.setComplete(t.id, true)!
    expect(done.isCompleted).toBe(true)
    expect(done.completedAt).toBeTruthy()
    // Completed tasks drop out of the inbox view.
    expect(repos.tasks.list({ kind: 'inbox' })).toHaveLength(0)
    const reopened = repos.tasks.setComplete(t.id, false)!
    expect(reopened.isCompleted).toBe(false)
    expect(reopened.completedAt).toBeNull()
  })

  it('reschedules a recurring task instead of completing it', () => {
    const t = repos.tasks.create({
      content: 'Standup',
      dueDate: '2026-06-17',
      recurrence: 'daily'
    })
    const result = repos.tasks.setComplete(t.id, true)!
    expect(result.isCompleted).toBe(false)
    expect(result.dueDate).toBe('2026-06-18')
  })

  it('attaches and detaches labels', () => {
    const label = repos.labels.create({ name: 'errand' })
    const t = repos.tasks.create({ content: 'Pick up parcel', labelIds: [label.id] })
    expect(t.labelIds).toEqual([label.id])
    const cleared = repos.tasks.update(t.id, { labelIds: [] })
    expect(cleared.labelIds).toEqual([])
  })

  it('adds comments and counts them on the task', () => {
    const t = repos.tasks.create({ content: 'Discuss' })
    repos.comments.create({ taskId: t.id, body: 'first note' })
    const comments = repos.comments.listForTask(t.id)
    expect(comments.map((c) => c.body)).toEqual(['first note'])
    expect(repos.tasks.get(t.id)!.commentCount).toBe(1)
  })

  it('records sub-tasks and counts them on the parent', () => {
    const parent = repos.tasks.create({ content: 'Parent' })
    repos.tasks.create({ content: 'Child', parentId: parent.id })
    expect(repos.tasks.subtasks(parent.id).map((s) => s.content)).toEqual(['Child'])
    expect(repos.tasks.get(parent.id)!.subtaskCount).toBe(1)
  })

  it('tracks focus sessions', () => {
    const id = repos.focus.create({ taskId: null, mode: 'pomodoro', plannedSeconds: 1500 })
    expect(typeof id).toBe('number')
    repos.focus.complete({ id, actualSeconds: 1500, completed: true })
  })

  it('reports completed-today in stats', () => {
    expect(repos.stats.summary().completedToday).toBe(0)
    const t = repos.tasks.create({ content: 'X' })
    repos.tasks.setComplete(t.id, true)
    const s = repos.stats.summary()
    expect(s.completedToday).toBe(1)
    expect(s.currentStreak).toBe(1)
    expect(s.dailyGoal).toBe(5)
  })

  it('refuses to delete the Inbox', () => {
    const inbox = repos.projects.list().find((p) => p.isInbox)!
    expect(() => repos.projects.delete(inbox.id)).toThrow()
  })
})
