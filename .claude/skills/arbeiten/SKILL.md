---
name: arbeiten
description: Add, complete, update, and list tasks and labels in the Arbeiten todo app. Use when the user wants to capture or manage todos in Arbeiten — e.g. "add a task to Arbeiten", "put X on my todo list", "mark that done", "what's on my Arbeiten today", "label this work".
---

# Arbeiten task agent

Drive the local Arbeiten todo app by shelling out to its CLI. Writes go straight to
Arbeiten's SQLite database, so they work whether or not the app window is open (an
open app shows new items when you switch views or relaunch).

All commands print JSON on stdout. Run them from the project root.

## Setup (one time)

If `agent/dist/cli.js` does not exist yet, build the agent tooling first:

```bash
npm --prefix agent install && npm --prefix agent run build
```

## Command

```bash
node agent/dist/cli.js <command> [flags]
```

| Command | Flags |
|---|---|
| `add-task` | `--content <text>` (required), `--project <name>`, `--due <today\|tomorrow\|mon..sun\|YYYY-MM-DD>`, `--priority <1-4>`, `--labels a,b`, `--duration <min>`, `--recurrence <daily\|weekdays\|weekly\|monthly>` |
| `add-label` | `--name <text>`, `--color <#rrggbb>` |
| `complete` | `--id <n>` |
| `reopen` | `--id <n>` |
| `update` | `--id <n>` plus any of the add-task flags (+ `--description`) |
| `delete` | `--id <n>` |
| `list-tasks` | `--view <today\|inbox\|upcoming\|project:Name\|label:Name\|priority:1\|search:text>` |
| `list-projects` | — |
| `list-labels` | — |
| `where` | — (prints the database path) |

Project and label **names** are resolved automatically and **created if they don't
exist**. Priority 1 is highest, 4 is none (default).

## Workflow

1. To attach a task to an existing project/label, you may first run `list-projects` /
   `list-labels` to use the exact name — but it's optional, since unknown names are
   created.
2. To complete/update/delete a task you need its `id`; get it from `list-tasks`.
3. Echo the resulting JSON's `id` and `content` back to the user so they can confirm.

## Examples

```bash
# Add a prioritized, scheduled, labeled task
node agent/dist/cli.js add-task --content "Email the designer" --project Work \
  --due tomorrow --priority 2 --labels work,urgent --duration 30

# What's due today
node agent/dist/cli.js list-tasks --view today

# Complete task #5
node agent/dist/cli.js complete --id 5

# Reschedule and re-prioritize task #5
node agent/dist/cli.js update --id 5 --due 2026-07-01 --priority 1
```

## MCP alternative

The same operations are exposed as MCP tools (`add_task`, `add_label`, `complete_task`,
`reopen_task`, `update_task`, `delete_task`, `list_tasks`, `list_projects`,
`list_labels`) via the `arbeiten` server registered in `.mcp.json`. Prefer those tools
if they are available in the session; otherwise use the CLI above.

The database lives at `~/Library/Application Support/Arbeiten/arbeiten.db` (override
with the `ARBEITEN_DB` env var).
