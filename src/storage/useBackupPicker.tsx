import { useRef, useState, type ReactNode } from 'react'
import type { FamilyGraph } from '../model'
import { readBackupFile } from './backup'
import { putPhotos } from './photos'
import { TreeFileError } from './treeDocument'

export interface BackupPicker {
  /** Opens the system file picker. */
  open: () => void
  /** The hidden file input; render it anywhere. */
  input: ReactNode
  error: string | null
  clearError: () => void
}

/** Lets someone choose a KinGraph backup file and hands back the tree in it. */
export function useBackupPicker(onPicked: (graph: FamilyGraph) => void): BackupPicker {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".json,application/json"
      className="hidden"
      data-testid="backup-file-input"
      onChange={async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        try {
          const { graph, photos } = await readBackupFile(file)
          // Photos go into the store first so the tree shows them straight away.
          await putPhotos(photos)
          setError(null)
          onPicked(graph)
        } catch (e) {
          setError(e instanceof TreeFileError ? e.message : 'That file couldn’t be read.')
        }
      }}
    />
  )

  return {
    open: () => inputRef.current?.click(),
    input,
    error,
    clearError: () => setError(null),
  }
}
