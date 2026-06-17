// Headless check that better-sqlite3 loads + works under Electron's ABI.
// Run with: npx electron scripts/smoke-db.cjs
const { app } = require('electron')
const path = require('path')
const os = require('os')

app.disableHardwareAcceleration()

app.whenReady().then(() => {
  try {
    const Database = require('better-sqlite3')
    const db = new Database(path.join(os.tmpdir(), `arbeiten-smoke-${process.pid}.db`))
    db.pragma('journal_mode = WAL')
    db.exec('CREATE TABLE IF NOT EXISTS t (x INTEGER)')
    db.prepare('INSERT INTO t (x) VALUES (?)').run(42)
    const row = db.prepare('SELECT x FROM t').get()
    console.log('SMOKE_OK', row.x)
    db.close()
    process.exitCode = row.x === 42 ? 0 : 1
  } catch (e) {
    console.error('SMOKE_FAIL', e && e.message)
    process.exitCode = 1
  }
  app.quit()
})
