# Arbeiten — Electron Todo App Design

**Date:** 2026-06-17
**Status:** Approved (design); pending implementation plan

## Summary

Arbeiten is a local-first desktop todo application for macOS, built with Electron.
It mimics the look and feel of Todoist and adds a standalone Focus panel with a
Timer (stopwatch / countdown) and a Pomodoro mode. All data is stored locally in
SQLite. The app ships as an installable `.dmg` with a custom "Ar" icon and launches
from Launchpad/Dock like any native macOS app.

## Goals

- Todoist-fidelity UI (layout, palette, typography, interactions) in light and dark.
- Full task management: projects, labels, priorities, due dates, sub-tasks, comments,
  drag-reorder, quick-add with token parsing.
- A separate Focus panel: Timer (stopwatch + custom countdown) and Pomodoro (25/5,
  long break every 4th). Both fire a native notification + chime on completion.
- A per-task **duration** estimate shown as a static badge (independent of the timer).
- Local-only persistence in SQLite; no accounts or cloud sync.
- Installable macOS `.dmg` with the "Ar" app icon.

## Non-Goals (v1)

- No accounts, login, or cloud sync.
- No background scheduled due-date reminders (only Timer/Pomodoro notifications).
- No mobile or web targets.
- Windows/Linux builds are out of scope for v1 (macOS only).

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Shell | Electron + `electron-vite` | Fast HMR, clean main/preload/renderer build |
| UI | React 18 + TypeScript | Componentization required for Todoist-like UI |
| Styling | Hand-tuned CSS + CSS-variable design tokens, CSS Modules | Pixel control over Todoist palette and light/dark |
| State | Zustand | Lightweight store, minimal boilerplate |
| Storage | better-sqlite3 (main process) | Synchronous, fast; native module rebuilt by electron-builder |
| Drag/reorder | dnd-kit | Accessible reordering for tasks and sidebar |
| Packaging | electron-builder → `.dmg` | Smooth macOS DMG + native-module rebuild + icon handling |
| Tests | Vitest | Unit tests for pure logic and data layer |

**Rejected alternatives:** Electron Forge (heavier DMG/icon config), `sql.js`/WASM
(slower, manual persistence), vanilla-JS renderer (unmaintainable for this UI).

## Security Posture

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox` where feasible.
- Renderer never accesses Node or SQLite directly. The preload script exposes a
  typed `window.api` surface via `contextBridge`. All DB access flows through IPC
  handlers in the main process.

## Architecture (3 processes)

### Main process
- App + window lifecycle (single main window, native title bar / vibrancy as fits Todoist look).
- SQLite connection (better-sqlite3) opened against `app.getPath('userData')/arbeiten.db`.
- Schema creation + versioned migrations on boot.
- Data repositories (tasks, projects, labels, comments, focus sessions, stats).
- IPC handlers mapping channel → repository method.
- Native notifications + chime trigger for Focus completion.

### Preload
- `contextBridge.exposeInMainWorld('api', …)` exposing typed namespaces:
  `tasks.*`, `projects.*`, `labels.*`, `comments.*`, `focus.*`, `stats.*`, `settings.*`.
- Shared TypeScript types for the API surface live in a `shared/` module imported by
  preload, main, and renderer.

### Renderer
- React app with a Zustand store that calls `window.api` and caches results.
- Views routed in-app (no URL router needed): Today, Upcoming, Inbox, Project,
  Label, Filter/Search.
- Focus panel countdown runs in the renderer; on completion it calls
  `api.focus.complete()` which fires the native notification + chime from main so it
  works even when the window is unfocused.

## Data Model (SQLite)

- `meta(key TEXT PRIMARY KEY, value TEXT)` — includes `schema_version` and app settings (theme, daily goal, pomodoro lengths).
- `projects(id, name, color, parent_id, position, is_inbox, is_favorite, created_at)`
- `labels(id, name, color)`
- `tasks(id, project_id, parent_id, content, description, priority /*1–4*/, due_date,
  recurrence_rule, duration_minutes, is_completed, completed_at, position,
  created_at, updated_at)`
- `task_labels(task_id, label_id)` — join table.
- `comments(id, task_id, body, created_at)`
- `focus_sessions(id, task_id /*nullable*/, mode /*timer|pomodoro*/, started_at,
  ended_at, planned_seconds, actual_seconds, completed)` — feeds stats.

Migrations are versioned (integer `schema_version` in `meta`); each migration is an
ordered SQL step applied on boot if the stored version is behind.

## Feature Inventory

### Full fidelity
- **Sidebar:** Inbox · Today · Upcoming · Filters & Labels · nested Projects with
  color dots, favorites, and item counts.
- **Views:** Today, Upcoming (grouped by date), per-Project, per-Label, search.
- **Task rows:** priority-colored round checkbox, content, optional description,
  due-date chip, priority flag, label chips, **duration badge**, sub-task expand
  caret, comment count. Hover actions (edit, schedule, delete).
- **Quick Add:** input with token parsing — `tomorrow`/dates → due date, `p1`–`p4`
  → priority, `#project` → project, `@label` → label. Remaining text → content.
- **Sub-tasks:** nested tasks (parent_id), expand/collapse, progress on parent.
- **Drag-and-drop:** reorder tasks within a view and projects within the sidebar
  (persisted via `position`).
- **Comments:** per-task comment thread.
- **Theme:** light and dark, matching Todoist's palette.

### Focus panel (separate from task duration)
- **Timer mode:** stopwatch and custom countdown (set minutes). Optionally tag the
  active task for the `focus_sessions` record.
- **Pomodoro mode:** 25-minute focus / 5-minute short break / 15-minute long break
  every 4th cycle. Configurable lengths in settings. Cycle counter.
- Both: on completion fire native OS notification + chime; offer to mark a tagged
  task complete; Pomodoro auto-advances to its break.

### Deliberately simplified (approved)
- **Recurrence:** preset set — none / daily / weekdays / weekly / monthly /
  every-N-days — not full natural-language recurrence.
- **Filters:** simple saved queries by priority / label / date — not Todoist's full
  query language.
- **Productivity/Karma:** lightweight stats — completed today/this week, current
  streak, daily goal progress — not the real karma points algorithm.
- **Reminders:** Timer/Pomodoro notifications only; no background scheduled
  due-date reminders.
- **No accounts/cloud sync** — fully local.

## Packaging & Icon

- `electron-builder` config: mac target `dmg`, `appId: com.arbeiten.desktop`,
  `productName: Arbeiten`.
- **Icon:** a generator script renders an SVG (Todoist-red `#dc4c3e` rounded square,
  white "Ar" wordmark) to the required PNG sizes and assembles `build/icon.icns` via
  macOS `iconutil`. The same mark is used for the in-app logo.
- Output: `Arbeiten.dmg`. Install by dragging `Arbeiten.app` to Applications;
  launches from Launchpad/Dock.

## Project Structure

```
arbeiten/
  package.json
  electron.vite.config.ts
  electron-builder.yml
  tsconfig*.json
  scripts/make-icon.mjs          # generates build/icon.icns
  build/icon.icns
  src/
    shared/        # API types shared across processes
    main/          # index.ts, db/ (schema, migrations, repositories), ipc/, notifications.ts
    preload/       # preload.ts (contextBridge api)
    renderer/
      app/         # App.tsx, view switching
      components/  # Sidebar, TaskList, TaskRow, QuickAdd, FocusPanel, ProjectTree, ...
      store/       # zustand stores
      styles/      # tokens.css, light/dark themes, CSS modules
      lib/         # quickAddParser.ts, recurrence.ts, time formatting
  tests/           # vitest: parser, recurrence, repositories (temp DB), store logic
```

## Testing Strategy

- **Unit (Vitest):** quick-add token parser; recurrence next-date computation; data
  repositories against a temporary SQLite file; store reducers/selectors.
- **Manual / light E2E:** verify the packaged `.dmg` launches, creates tasks,
  persists across restart, and that Timer/Pomodoro fire notifications.

## Implementation Phases

1. **Scaffold + packaging skeleton** — electron-vite + React + TS, icon generator,
   electron-builder producing a runnable `.dmg` early.
2. **Data layer + IPC** — schema, migrations, repositories, typed `window.api`.
3. **Core task list + quick-add** — Today/Inbox views, task rows, create/complete/edit.
4. **Organization** — projects, labels, sub-tasks, drag-reorder, comments, themes.
5. **Focus panel** — Timer + Pomodoro, notifications + chime, focus_sessions.
6. **Stats + polish + final DMG** — productivity stats, simplified filters/recurrence,
   visual polish to Todoist fidelity, final packaged build.
```
