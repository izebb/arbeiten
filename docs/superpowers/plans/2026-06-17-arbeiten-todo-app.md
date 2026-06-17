# Arbeiten Todo App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Arbeiten — a local-first macOS Electron todo app that looks like Todoist, stores data in SQLite, supports projects/labels/priorities/sub-tasks/quick-add, has a Focus panel (Timer + Pomodoro), and ships as an installable `.dmg` with an "Ar" icon.

**Architecture:** Three Electron processes. Main owns the SQLite DB (better-sqlite3) and exposes repository methods over IPC. Preload publishes a typed `window.api` via `contextBridge` (contextIsolation on). Renderer is a React 18 + TypeScript SPA with a Zustand store that calls `window.api`; the Focus countdown runs in the renderer and fires native notifications via main.

**Tech Stack:** Electron, electron-vite, React 18, TypeScript, Zustand, better-sqlite3, dnd-kit, Vitest, electron-builder, sharp (icon generation).

---

## File Structure

```
package.json                 # scripts, deps, electron-builder config
electron.vite.config.ts      # main/preload/renderer build config
tsconfig.json / tsconfig.node.json / tsconfig.web.json
electron-builder.yml         # mac dmg packaging
scripts/make-icon.mjs        # SVG -> iconset -> build/icon.icns (sharp + iconutil)
build/icon.icns              # generated
src/shared/types.ts          # Task/Project/Label/... + Api surface types (shared by all 3 procs)
src/shared/quickAddParser.ts # pure parser (tested)
src/shared/recurrence.ts     # pure next-date logic (tested)
src/shared/time.ts           # duration/clock formatting (tested)
src/main/index.ts            # app lifecycle, BrowserWindow
src/main/db/connection.ts    # open db, pragmas, run migrations
src/main/db/migrations.ts    # versioned schema steps
src/main/db/repositories.ts  # tasks/projects/labels/comments/focus/stats CRUD
src/main/ipc.ts              # register ipcMain.handle channels -> repositories
src/main/notifications.ts    # native Notification helper
src/preload/index.ts         # contextBridge -> window.api (typed)
src/renderer/index.html
src/renderer/src/main.tsx     # React root
src/renderer/src/App.tsx      # layout: Sidebar + main view + FocusPanel
src/renderer/src/store.ts     # Zustand store calling window.api
src/renderer/src/views/*      # TodayView, UpcomingView, ProjectView, LabelView, SearchView
src/renderer/src/components/* # Sidebar, TaskList, TaskRow, TaskEditor, QuickAdd, FocusPanel, ProjectTree, Logo, ...
src/renderer/src/styles/*     # tokens.css, themes, app.css, *.module.css
tests/*                       # vitest unit tests for shared/ + repositories
```

---

## Phase 1 — Scaffold + packaging skeleton

### Task 1: Project scaffold + dependencies

**Files:** Create `package.json`, `tsconfig*.json`, `electron.vite.config.ts`, `.gitignore`, `src/renderer/index.html`, minimal `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`.

- [ ] **Step 1: package.json** — name `arbeiten`, `main: out/main/index.js`, scripts:
  `dev` = `electron-vite dev`, `build` = `electron-vite build`, `start` = `electron-vite preview`,
  `dist` = `electron-vite build && electron-builder`, `test` = `vitest run`, `typecheck` = `tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit`,
  `postinstall` = `electron-builder install-app-deps`, `make-icon` = `node scripts/make-icon.mjs`.
  deps: `better-sqlite3`, `zustand`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `clsx`.
  devDeps: `electron`, `electron-vite`, `electron-builder`, `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@types/better-sqlite3`, `typescript`, `vitest`, `sharp`, `@electron/rebuild`.
- [ ] **Step 2: electron.vite.config.ts** — main & preload use `externalizeDepsPlugin()` (keeps better-sqlite3 external); renderer uses `@vitejs/plugin-react`, root `src/renderer`, alias `@renderer`→`src/renderer/src`, `@shared`→`src/shared`.
- [ ] **Step 3: tsconfigs** — `tsconfig.node.json` (main+preload+shared, module NodeNext), `tsconfig.web.json` (renderer, DOM libs, jsx react-jsx), root `tsconfig.json` referencing both.
- [ ] **Step 4: minimal main** — create BrowserWindow 1280x800, load `process.env['ELECTRON_RENDERER_URL']` in dev else `out/renderer/index.html`; `contextIsolation:true`, `nodeIntegration:false`, preload path.
- [ ] **Step 5: minimal preload** — expose `window.api = { ping: () => 'pong' }` via contextBridge.
- [ ] **Step 6: minimal renderer** — React root renders `<App/>` showing "Arbeiten" so we can confirm boot.
- [ ] **Step 7: install + verify dev boot** — `npm install`; `npm run typecheck`; launch `npm run dev` headless-check (build succeeds). Commit.

### Task 2: "Ar" icon generator + electron-builder

**Files:** Create `scripts/make-icon.mjs`, `electron-builder.yml`, `build/.gitkeep`.

- [ ] **Step 1: make-icon.mjs** — build an SVG: Todoist-red `#dc4c3e` rounded square, white bold "Ar". Use `sharp(Buffer.from(svg)).resize(size).png()` for sizes 16/32/64/128/256/512/1024 into `build/icon.iconset/icon_NxN.png` (+`@2x`), then `execSync('iconutil -c icns build/icon.iconset -o build/icon.icns')`. Also emit `build/icon.png` (512) and `src/renderer/src/assets/logo.svg`.
- [ ] **Step 2: electron-builder.yml** — `appId: com.arbeiten.desktop`, `productName: Arbeiten`, `directories.buildResources: build`, `files: [out/**]`, `mac.target: dmg`, `mac.category: public.app-category.productivity`, `mac.icon: build/icon.icns`, `dmg.title: Arbeiten`.
- [ ] **Step 3: generate icon** — `npm run make-icon`; verify `build/icon.icns` exists. Commit.

---

## Phase 2 — Data layer + IPC

### Task 3: Shared types

**Files:** Create `src/shared/types.ts`.

- [ ] **Step 1** — define `Priority = 1|2|3|4`, `FocusMode = 'timer'|'pomodoro'`, interfaces `Project, Label, Task, Comment, FocusSession, Stats`, input DTOs (`NewTask`, `TaskPatch`, `NewProject`, …), and the `Api` interface with namespaces `projects, tasks, labels, comments, focus, stats, settings`. Export channel name constants. (No test — types only.)

### Task 4: DB connection + migrations

**Files:** Create `src/main/db/connection.ts`, `src/main/db/migrations.ts`. Test `tests/migrations.test.ts`.

- [ ] **Step 1: failing test** — open a fresh DB at a temp path via `openDatabase(path)`, assert `meta.schema_version` equals latest and that an Inbox project row exists.
- [ ] **Step 2: run → fail** (`npx vitest run tests/migrations.test.ts`) — module missing.
- [ ] **Step 3: implement** — `connection.ts` opens better-sqlite3, sets `PRAGMA journal_mode=WAL; foreign_keys=ON`, runs `migrate(db)`. `migrations.ts` holds an ordered array of `{version, up(db)}`; migration 1 creates all tables (per spec schema) + seeds Inbox project + default `meta` settings (theme=light, pomodoro lengths, daily_goal). `migrate` reads `schema_version` from meta (0 if absent), applies pending steps in a transaction, writes new version.
- [ ] **Step 4: run → pass.** **Step 5: commit.**

### Task 5: Repositories

**Files:** Create `src/main/db/repositories.ts`. Test `tests/repositories.test.ts`.

- [ ] **Step 1: failing tests** (temp DB) — create project; create task in project; list tasks for project ordered by position; toggle complete sets `completed_at`; add/remove label; add comment; create focus session; stats returns completed-today count. Assert each.
- [ ] **Step 2: run → fail.**
- [ ] **Step 3: implement** prepared-statement-backed functions grouped by entity: `projects.{list,create,update,delete,reorder}`, `tasks.{list(view filter),get,create,update,complete,delete,reorder}`, `labels.{list,create,update,delete}`, `taskLabels.{set,get}`, `comments.{listForTask,create,delete}`, `focus.{create,complete}`, `stats.{summary}`, `settings.{getAll,set}`. `tasks.list` accepts a `ViewQuery` (`{kind:'today'|'upcoming'|'inbox'|'project'|'label'|'search', id?, text?}`) and builds SQL accordingly. New tasks get `position = max+1`.
- [ ] **Step 4: run → pass.** **Step 5: commit.**

### Task 6: IPC + preload bridge + notifications

**Files:** Create `src/main/ipc.ts`, `src/main/notifications.ts`; rewrite `src/preload/index.ts`; wire into `src/main/index.ts`.

- [ ] **Step 1** — `ipc.ts`: `registerIpc(db)` calls `ipcMain.handle(CHANNEL, (_e, args) => repoFn(args))` for every Api method using the channel constants. `notifications.ts`: `notify({title, body})` → `new Notification(...).show()`; register a `focus:notify` channel.
- [ ] **Step 2** — preload: build `api` object whose methods `ipcRenderer.invoke(CHANNEL, args)`, matching the `Api` type; `contextBridge.exposeInMainWorld('api', api)`. Add `src/preload/index.d.ts` declaring `window.api: Api`.
- [ ] **Step 3** — main `index.ts`: on `app.whenReady`, `const db = openDatabase(...)`, `registerIpc(db)`, create window. Typecheck. Manually verify a renderer button calling `window.api.projects.list()` returns the Inbox. Commit.

---

## Phase 3 — Core task list + quick-add

### Task 7: Quick-add parser (pure, TDD)

**Files:** Create `src/shared/quickAddParser.ts`. Test `tests/quickAddParser.test.ts`.

- [ ] **Step 1: failing tests** — `parseQuickAdd("Buy milk tomorrow p1 #Shopping @errand")` → `{content:"Buy milk", priority:1, dueText:"tomorrow", project:"Shopping", labels:["errand"]}`; plain text → content only, priority default 4; multiple `@labels`; `p5` ignored. Include a `resolveDueDate(dueText, today)` test: `"today"`, `"tomorrow"`, `"mon"`, ISO date.
- [ ] **Step 2: run → fail. Step 3: implement** token regexes (`/\bp([1-4])\b/`, `/#([\w-]+)/g`, `/@([\w-]+)/g`, trailing/leading date words) stripping matches from content; `resolveDueDate` handles today/tomorrow/weekday/`YYYY-MM-DD`. **Step 4: pass. Step 5: commit.**

### Task 8: Zustand store + App shell

**Files:** Create `src/renderer/src/store.ts`, `src/renderer/src/styles/tokens.css` + `app.css`, rewrite `App.tsx`, `main.tsx`.

- [ ] **Step 1** — `tokens.css`: CSS variables for Todoist palette (red `#dc4c3e`, sidebar bg `#fafafa`/dark, text, priority colors P1 `#d1453b` P2 `#eb8909` P3 `#246fe0` P4 grey), spacing, radius, font stack; `[data-theme=dark]` overrides.
- [ ] **Step 2** — `store.ts`: state `{projects, labels, tasks, currentView, theme, ...}`; actions `loadProjects/loadLabels/selectView/loadTasks/addTask/toggleTask/updateTask/deleteTask/reorderTasks/setTheme` each calling `window.api` then updating state.
- [ ] **Step 3** — `App.tsx`: grid layout `Sidebar | main view | FocusPanel`; apply `data-theme`; on mount load projects+labels+default Today view. Render placeholder view + QuickAdd. Verify boots. Commit.

### Task 9: Sidebar + TaskList + TaskRow + QuickAdd

**Files:** Create `components/Sidebar.tsx`, `ProjectTree.tsx`, `TaskList.tsx`, `TaskRow.tsx`, `QuickAdd.tsx`, `Logo.tsx`, `views/TodayView.tsx`, `InboxView`, `ProjectView`, matching `*.module.css`.

- [ ] **Step 1: Sidebar** — Logo + nav (Inbox/Today/Upcoming/Filters&Labels) with counts, then ProjectTree (nested, color dots, favorites, add-project button), theme toggle. Selecting an item calls `selectView`.
- [ ] **Step 2: TaskRow** — round priority-colored checkbox (strike + remove on check), content, due chip, priority flag, label chips, duration badge, sub-task caret, comment count, hover actions (edit/schedule/delete). Click → open TaskEditor.
- [ ] **Step 3: TaskList** — header (view title + count), grouped rendering (Upcoming groups by date), maps tasks → TaskRow.
- [ ] **Step 4: QuickAdd** — bottom "+ Add task" expands to input; on submit `parseQuickAdd`, resolve project/labels (create label if new is out of scope — match existing by name), call `addTask`. Enter submits, Esc cancels.
- [ ] **Step 5** — wire views; verify create/complete/list works end to end against SQLite. Commit.

---

## Phase 4 — Organization (projects, labels, sub-tasks, drag, comments, themes)

### Task 10: Task editor (detail panel/modal)

**Files:** Create `components/TaskEditor.tsx`, `DueDatePicker.tsx`, `PriorityPicker.tsx`, `LabelPicker.tsx`, `DurationPicker.tsx`, `RecurrencePicker.tsx`.

- [ ] **Step 1** — editor with fields: content, description, project select, due date (DueDatePicker presets: today/tomorrow/next week/no date + calendar), priority (1–4), labels (multi), duration (15/25/30/45/60/custom min), recurrence (none/daily/weekdays/weekly/monthly/every-N). Save → `updateTask`; supports sub-task add (creates task with parent_id). Verify edits persist. Commit.

### Task 11: Labels & Filters views + management

**Files:** Create `views/LabelView.tsx`, `views/FiltersLabelsView.tsx`, `components/LabelManager.tsx`, `components/FilterBar.tsx`, `views/SearchView.tsx`.

- [ ] **Step 1** — Filters&Labels page lists labels (create/rename/recolor/delete) and saved simple filters (priority/label/date); LabelView shows tasks for a label; SearchView filters by text via `tasks.list({kind:'search'})`. Verify. Commit.

### Task 12: Drag-and-drop reorder

**Files:** Modify `TaskList.tsx`, `ProjectTree.tsx` with dnd-kit `DndContext`/`SortableContext`.

- [ ] **Step 1** — wrap task list + project tree in sortable contexts; on drag end compute new order and call `reorderTasks`/`projects.reorder` (persist `position`). Verify order survives reload. Commit.

### Task 13: Comments + sub-task display + theme persistence

**Files:** Create `components/Comments.tsx`; modify TaskEditor, store, `meta` settings.

- [ ] **Step 1** — comment thread in TaskEditor (list + add + delete via `comments.*`); sub-tasks render indented under parent with parent progress; theme choice persisted to `meta` via `settings.set` and restored on boot. Verify. Commit.

---

## Phase 5 — Focus panel (Timer + Pomodoro)

### Task 14: time helpers (pure, TDD)

**Files:** Create `src/shared/time.ts`. Test `tests/time.test.ts`.

- [ ] **Step 1: failing tests** — `formatClock(90)==="1:30"`, `formatClock(3661)==="1:01:01"`, `formatDuration(45)==="45m"`, `formatDuration(90)==="1h 30m"`. **Step 2: fail. Step 3: implement. Step 4: pass. Step 5: commit.**

### Task 15: Focus panel

**Files:** Create `components/FocusPanel.tsx`, `hooks/useCountdown.ts`, `lib/chime.ts`.

- [ ] **Step 1** — `useCountdown` interval hook (start/pause/reset, fires `onDone`). `chime.ts` plays a short WebAudio beep. FocusPanel: mode tabs Timer|Pomodoro; Timer = stopwatch or set-minutes countdown; Pomodoro = 25/5, long break (15) every 4th, cycle counter, lengths from settings; optional "attach current task". On done: `chime()` + `window.api.focus.notify(...)` (native notification) + record `focus.create/complete`; Pomodoro auto-advances to break. Verify notification + sound fire. Commit.

---

## Phase 6 — Stats + polish + final DMG

### Task 16: Productivity stats

**Files:** Create `views/ProductivityView.tsx`; ensure `stats.summary` returns completed today/this week, current streak, daily goal.

- [ ] **Step 1** — render completed-today vs daily goal (progress ring), this-week count, current streak from completed tasks + focus sessions. Verify numbers update on completion. Commit.

### Task 17: Visual polish to Todoist fidelity

**Files:** styles across components.

- [ ] **Step 1** — tune spacing/typography/hover/transitions/empty states/light+dark to match Todoist; ensure red accent, sidebar, checkboxes, chips read correctly. Verify visually. Commit.

### Task 18: Package the DMG

- [ ] **Step 1** — `npm run make-icon` then `npm run dist`; confirm `dist/Arbeiten-*.dmg` is produced and the app launches from it (better-sqlite3 rebuilt via `electron-builder install-app-deps`). Smoke test: create task, restart, data persists. Commit.

---

## Self-Review

- **Spec coverage:** sidebar/views/task rows (T9), quick-add (T7/T9), sub-tasks/drag/comments/themes (T10–T13), duration badge (T9/T10), Focus Timer+Pomodoro+notify+chime (T14–T15), simplified recurrence (T10) / filters (T11) / karma-lite stats (T16) / no reminders / local-only (data layer), SQLite schema (T4–T5), security posture (T1/T6), packaging + "Ar" icon (T2/T18). All spec sections map to tasks.
- **Placeholders:** none — each task names exact files and concrete behavior; logic-heavy units (parser, recurrence, time, repositories, migrations) are TDD with explicit assertions.
- **Type consistency:** all processes import entity + `Api` types from `src/shared/types.ts`; channel constants shared; `ViewQuery` defined in T5 and reused by store/views.
