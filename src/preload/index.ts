import { contextBridge, ipcRenderer } from 'electron'
import { API_METHODS, channelName, EXTERNAL_CHANGE_CHANNEL, type Api } from '@shared/types'

// Build the window.api bridge dynamically from the shared method map so the
// renderer, preload, and main process stay in lockstep.
const api: Record<string, unknown> = {}
for (const ns of Object.keys(API_METHODS) as (keyof typeof API_METHODS)[]) {
  const methods: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  for (const method of API_METHODS[ns]) {
    const channel = channelName(ns, method)
    methods[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }
  api[ns] = methods
}

// Event subscription (push, not request/response) for external DB changes.
api.onExternalChange = (callback: () => void): (() => void) => {
  const handler = (): void => callback()
  ipcRenderer.on(EXTERNAL_CHANGE_CHANNEL, handler)
  return () => ipcRenderer.removeListener(EXTERNAL_CHANGE_CHANNEL, handler)
}

contextBridge.exposeInMainWorld('api', api as unknown as Api)
