/** What one open KinGraph tab tells the others. */
export type TabMessage = 'saved' | 'cleared' | 'settings'

/** A channel never hears its own messages, so one per tab is enough. */
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('kingraph')

export function notifyTabs(message: TabMessage): void {
  channel?.postMessage(message)
}

/** Listens for messages from other tabs; returns a function that stops listening. */
export function onTabMessage(listener: (message: TabMessage) => void): () => void {
  const handle = (event: MessageEvent<TabMessage>) => listener(event.data)
  channel?.addEventListener('message', handle)
  return () => channel?.removeEventListener('message', handle)
}
