import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { upload } from '../api/endpoints'
import { ApiError } from '../api/client'
import type { Source, UploadResult } from '../api/types'

const MAX_SIZE = 200 * 1024 * 1024 // matches the server's in-memory cap

type Props = {
  label: string
  accept?: string
  folder?: string // Filebrowser destinations only — ignored otherwise, per API contract
  onUploaded?: (result: UploadResult, file: File) => void
}

function invalidateFor(qc: ReturnType<typeof useQueryClient>, dest: Source) {
  if (dest === 'immich') void qc.invalidateQueries({ queryKey: ['timeline'] })
  else if (dest === 'navidrome') {
    void qc.invalidateQueries({ queryKey: ['artists'] })
    void qc.invalidateQueries({ queryKey: ['albumSongs'] })
  } else void qc.invalidateQueries({ queryKey: ['folder'] })
}

// A lightweight "+ Add" affordance for a single page's content type, reusing
// the same auto-routing /api/upload endpoint as the dedicated Upload page.
// For the full drag-drop/directory/409-retry flow, send people there instead.
export function QuickUploadButton({ label, accept, folder, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const handleFiles = async (fileList: FileList) => {
    setBusy(true)
    setErrors([])
    const failed: string[] = []
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_SIZE) {
        failed.push(`${file.name}: over the 200MB limit`)
        continue
      }
      try {
        const result = await upload(file, folder)
        invalidateFor(qc, result.destination)
        onUploaded?.(result, file)
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          failed.push(`${file.name}: already exists — rename it on the Upload page`)
        } else {
          failed.push(`${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`)
        }
      }
    }
    setErrors(failed)
    setBusy(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Uploading…' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {errors.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            zIndex: 10,
            width: 280,
          }}
        >
          {errors.map((msg) => (
            <div key={msg} className="error-banner">
              {msg}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
