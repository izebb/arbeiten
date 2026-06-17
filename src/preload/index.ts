import { contextBridge, ipcRenderer } from 'electron'
import { API_METHODS, channelName, type Api } from '@shared/types'

// Build the window.api bridge dynamically from the shared method map so the
// renderer, preload, and main process stay in lockstep.
const api: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>> = {}
for (const ns of Object.keys(API_METHODS) as (keyof typeof API_METHODS)[]) {
  api[ns] = {}
  for (const method of API_METHODS[ns]) {
    const channel = channelName(ns, method)
    api[ns][method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }
}

contextBridge.exposeInMainWorld('api', api as unknown as Api)
