import { ipcMain } from 'electron'
import { API_METHODS, channelName } from '@shared/types'
import { createRepositories } from './db/repositories'
import { notify } from './notifications'
import type { DB } from './db/types'

type AnyFn = (...args: unknown[]) => unknown

/** Registers an ipcMain.handle for every method in the shared Api surface. */
export function registerIpc(db: DB): void {
  const repos = createRepositories(db) as unknown as Record<string, Record<string, AnyFn>>

  for (const ns of Object.keys(API_METHODS) as (keyof typeof API_METHODS)[]) {
    for (const method of API_METHODS[ns]) {
      const channel = channelName(ns, method)

      if (ns === 'focus' && method === 'notify') {
        ipcMain.handle(channel, (_e, input) => notify(input as { title: string; body: string }))
        continue
      }

      const fn = repos[ns]?.[method]
      if (!fn) continue
      ipcMain.handle(channel, (_e, ...args) => fn(...args))
    }
  }
}
