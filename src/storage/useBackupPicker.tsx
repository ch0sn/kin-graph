import { useRef, useState, type ReactNode } from 'react'
import { GedcomImportDialog } from '../app/GedcomImportDialog'
import { importGedcomArchive, type GedcomArchiveImport } from '../gedcom/archive'
import { GedcomError } from '../gedcom/import'
import { preparePhoto } from '../photos/preparePhoto'
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

/**
 * Whether the file is GEDCOM, or a .zip with GEDCOM and photos, rather than
 * a KinGraph backup: by its name or how it starts.
 */
async function isGedcom(file: File): Promise<boolean> {
  if (/\.(ged|gedcom|zip)$/i.test(file.name)) return true
  const start = await file.slice(0, 64).text()
  return start.startsWith('PK\u0003\u0004') || /^\uFEFF?\s*0\s+HEAD\b/.test(start)
}

/**
 * Lets someone choose a KinGraph backup or GEDCOM file and hands back the
 * tree in it. A GEDCOM file first shows what will be imported, and asks who
 * the person is, which `input` renders along with the file input.
 */
export function useBackupPicker(onPicked: (graph: FamilyGraph) => void): BackupPicker {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [gedcom, setGedcom] = useState<GedcomArchiveImport | null>(null)

  const input = (
    <>
    <input
      ref={inputRef}
      type="file"
      accept=".json,application/json,.ged,.gedcom,.zip,application/zip"
      className="hidden"
      data-testid="backup-file-input"
      onChange={async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        try {
          if (await isGedcom(file)) {
            setError(null)
            setGedcom(await importGedcomArchive(new Uint8Array(await file.arrayBuffer()), (image) => preparePhoto(image)))
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
        onConfirm={async (graph) => {
          const { photos } = gedcom
          setGedcom(null)
          try {
            await putPhotos(photos)
          } catch {
            // The tree is still worth having without its photos.
          }
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
