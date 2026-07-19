import { useRef } from 'react'
import { useUploadQueue } from '../upload/UploadQueueContext'
import type { UploadResult } from '../api/types'

type Props = {
  label: string
  accept?: string
  folder?: string // Filebrowser destinations only — ignored otherwise, per API contract
  onUploaded?: (result: UploadResult, file: File) => void
}

// A lightweight "+ Add" affordance for a single page's content type, reusing
// the same shared upload queue as the dedicated Upload page and Files' drag
// drop — progress shows in the global UploadTray, not a local busy state.
export function QuickUploadButton({ label, accept, folder, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { addFiles } = useUploadQueue()

  return (
    <>
      <button className="btn" onClick={() => inputRef.current?.click()}>
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) {
            addFiles(
              Array.from(e.target.files).map((file) => ({
                file,
                folder,
                onUploaded: onUploaded && ((result) => onUploaded(result, file)),
              })),
            )
          }
          e.target.value = ''
        }}
      />
    </>
  )
}
