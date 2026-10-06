/**
 * What one open browser tab tells the others. (These are browser tabs, not
 * KinGraph's own tree tabs; each browser tab keeps its own set of those.)
 */
export type TabMessage =
  | { type: 'saved'; treeId: string }
  | { type: 'deleted'; treeId: string }
  /** The list of trees changed: one was added, or links changed. */
  | { type: 'trees' }
  | { type: 'settings' }

/** A channel never hears its own messages, so one per tab is enough. */
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('kingraph')

export function notifyTabs(message: TabMessage): void {
  channel?.postMessage(message)
}

/** Listens for messages from other tabs; returns a function that stops listening. */
export function onTabMessage(listener: (message: TabMessage) => void): () => void {
  const handle = (event: MessageEvent<unknown>) => {
    const data = event.data
    // Ignore messages from an older KinGraph still open in another tab.
    if (typeof data === 'object' && data !== null && 'type' in data) listener(data as TabMessage)
  }
  channel?.addEventListener('message', handle)
  return () => channel?.removeEventListener('message', handle)
}
