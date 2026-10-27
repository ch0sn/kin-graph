import { useRef, useState, type ReactNode } from 'react'
import { GedcomImportDialog } from '../app/GedcomImportDialog'
import { GedcomError, importGedcomFile, type GedcomImport } from '../gedcom/import'
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

/** Whether the file is GEDCOM rather than a KinGraph backup, by its name or its first line. */
async function isGedcom(file: File): Promise<boolean> {
  if (/\.(ged|gedcom)$/i.test(file.name)) return true
  return /^\uFEFF?\s*0\s+HEAD\b/.test(await file.slice(0, 64).text())
}

/**
 * Lets someone choose a KinGraph backup or GEDCOM file and hands back the
 * tree in it. A GEDCOM file first shows what will be imported, and asks who
 * the person is, which `input` renders along with the file input.
 */
export function useBackupPicker(onPicked: (graph: FamilyGraph) => void): BackupPicker {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [gedcom, setGedcom] = useState<GedcomImport | null>(null)

  const input = (
    <>
    <input
      ref={inputRef}
      type="file"
      accept=".json,application/json,.ged,.gedcom"
      className="hidden"
      data-testid="backup-file-input"
      onChange={async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        try {
          if (await isGedcom(file)) {
            setError(null)
            setGedcom(importGedcomFile(new Uint8Array(await file.arrayBuffer())))
            return
          }
          const { graph, photos } = await readBackupFile(file)
          // Photos go into the store first so the tree shows them straight away.
          await putPhotos(photos)
          setError(null)
          onPicked(graph)
        } catch (e) {
          setError(e instanceof TreeFileError || e instanceof GedcomError ? e.message : 'That file couldn’t be read.')
        }
      }}
    />
    {gedcom && (
      <GedcomImportDialog
        imported={gedcom}
        onConfirm={(graph) => {
          setGedcom(null)
          onPicked(graph)
        }}
        onCancel={() => setGedcom(null)}
      />
    )}
    </>
  )

  return {
    open: () => inputRef.current?.click(),
    input,
    error,
    clearError: () => setError(null),
  }
}
