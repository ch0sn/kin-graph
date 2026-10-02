import ELK from 'elkjs/lib/elk-api'
import workerUrl from 'elkjs/lib/elk-worker.min.js?url'

/** ELK runs in a web worker so large layouts don't block the UI. */
export const elk = new ELK({ workerUrl })
