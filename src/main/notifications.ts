import { Notification } from 'electron'

/** Shows a native OS notification (used for Focus timer / Pomodoro completion). */
export function notify(input: { title: string; body: string }): void {
  if (Notification.isSupported()) {
    new Notification({ title: input.title, body: input.body, silent: false }).show()
  }
}
