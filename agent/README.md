# arbeiten-agent

An agent interface for the Arbeiten todo app, exposed two ways:

- **CLI** — `node dist/cli.js <command>` (used by the `arbeiten` Claude Code skill)
- **MCP server** — `node dist/mcp.js` (registered in the repo's `.mcp.json`)

Both write directly to Arbeiten's SQLite database
(`~/Library/Application Support/Arbeiten/arbeiten.db`, override with `ARBEITEN_DB`),
so they work whether or not the app is running.

## Why a separate package

The app compiles `better-sqlite3` for Electron's ABI; a plain Node process can't load
that build. This package keeps its **own** Node-ABI `better-sqlite3` so there's no
conflict. It still **reuses the app's data layer** (`src/main/db/migrations.ts` and
`repositories.ts`) — those only import `better-sqlite3` as a type, so the same
validated logic (ordering, recurrence-on-complete, name resolution) runs here against
a Node-ABI database handle. esbuild bundles everything except the native module.

## Build

```bash
npm install
npm run build      # -> dist/cli.js, dist/mcp.js
```

## CLI

```bash
node dist/cli.js add-task --content "Buy milk" --due tomorrow --priority 1 --labels errand
node dist/cli.js list-tasks --view today
node dist/cli.js complete --id 3
node dist/cli.js help
```

See `../.claude/skills/arbeiten/SKILL.md` for the full command list.
