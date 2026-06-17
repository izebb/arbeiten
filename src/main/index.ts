import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { openDatabase } from './db/connection'
import { registerIpc } from './ipc'
import { watchExternalChanges } from './watcher'
import { EXTERNAL_CHANGE_CHANNEL } from '@shared/types'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 880,
    minHeight: 560,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const dbPath = join(app.getPath('userData'), 'arbeiten.db')
  const db = openDatabase(dbPath)
  registerIpc(db)
  createWindow()

  const dispose = watchExternalChanges(db, dbPath, () => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(EXTERNAL_CHANGE_CHANNEL)
    }
  })
  app.on('before-quit', dispose)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
