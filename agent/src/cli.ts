import {
  addTask,
  dbPath,
  resolveView,
  updateTask,
  withRepos,
  type AddTaskInput,
  type UpdateTaskInput
} from './core'

interface Flags {
  _: string[]
  [key: string]: string | string[] | boolean | undefined
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1)
      } else {
        const key = a.slice(2)
        const next = argv[i + 1]
        if (next === undefined || next.startsWith('--')) {
          flags[key] = true
        } else {
          flags[key] = next
          i++
        }
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const numOpt = (v: unknown): number | undefined => (v === undefined ? undefined : Number(v))
const list = (v: unknown): string[] | undefined =>
  typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined

function out(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n')
}
function fail(msg: string): never {
  process.stderr.write(`Error: ${msg}\n`)
  process.exit(1)
}

const HELP = `arbeiten-agent — manage the Arbeiten todo app from the command line

Usage:
  arbeiten-agent <command> [flags]

Commands:
  add-task --content <text> [--project <name>] [--due <today|tomorrow|mon|YYYY-MM-DD>]
           [--priority 1-4] [--labels a,b] [--duration <min>] [--recurrence daily|weekly|...]
  add-label --name <text> [--color #rrggbb]
  complete --id <n>                 Mark a task complete (recurring tasks reschedule)
  reopen --id <n>                   Mark a task incomplete
  update --id <n> [--content ...] [--project ...] [--due ...] [--priority ...]
         [--labels a,b] [--duration ...] [--recurrence ...] [--description ...]
  delete --id <n>
  list-tasks [--view today|inbox|upcoming|project:Name|label:Name|priority:1|search:text]
  list-projects
  list-labels
  where                             Print the database path

Output is JSON on stdout.`

function main(): void {
  const flags = parseArgs(process.argv.slice(2))
  const cmd = (flags._ as string[])[0]

  if (!cmd || cmd === 'help' || flags.help) {
    process.stdout.write(HELP + '\n')
    return
  }

  switch (cmd) {
    case 'where':
      out({ dbPath: dbPath() })
      return

    case 'add-task': {
      const content = str(flags.content) ?? (flags._ as string[])[1]
      if (!content) fail('add-task requires --content')
      const input: AddTaskInput = {
        content,
        project: str(flags.project),
        due: str(flags.due) ?? null,
        priority: numOpt(flags.priority),
        labels: list(flags.labels),
        duration: numOpt(flags.duration) ?? null,
        recurrence: str(flags.recurrence) ?? null
      }
      out(withRepos((r) => addTask(r, input)))
      return
    }

    case 'add-label': {
      const name = str(flags.name) ?? (flags._ as string[])[1]
      if (!name) fail('add-label requires --name')
      out(withRepos((r) => r.labels.create({ name, color: str(flags.color) })))
      return
    }

    case 'complete': {
      const id = numOpt(flags.id)
      if (!id) fail('complete requires --id')
      out(withRepos((r) => r.tasks.setComplete(id, true)))
      return
    }

    case 'reopen': {
      const id = numOpt(flags.id)
      if (!id) fail('reopen requires --id')
      out(withRepos((r) => r.tasks.setComplete(id, false)))
      return
    }

    case 'update': {
      const id = numOpt(flags.id)
      if (!id) fail('update requires --id')
      const patch: UpdateTaskInput = {
        content: str(flags.content),
        project: str(flags.project),
        due: flags.due === undefined ? undefined : str(flags.due) ?? null,
        priority: numOpt(flags.priority),
        labels: list(flags.labels),
        duration: flags.duration === undefined ? undefined : numOpt(flags.duration) ?? null,
        recurrence: flags.recurrence === undefined ? undefined : str(flags.recurrence) ?? null,
        description: str(flags.description)
      }
      out(withRepos((r) => updateTask(r, id, patch)))
      return
    }

    case 'delete': {
      const id = numOpt(flags.id)
      if (!id) fail('delete requires --id')
      withRepos((r) => r.tasks.delete(id))
      out({ deleted: id })
      return
    }

    case 'list-tasks': {
      const view = str(flags.view) ?? 'today'
      out(withRepos((r) => r.tasks.list(resolveView(r, view))))
      return
    }

    case 'list-projects':
      out(withRepos((r) => r.projects.list()))
      return

    case 'list-labels':
      out(withRepos((r) => r.labels.list()))
      return

    default:
      fail(`unknown command: ${cmd}\n\n${HELP}`)
  }
}

main()
