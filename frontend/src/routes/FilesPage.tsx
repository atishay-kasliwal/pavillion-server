import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { mediaUrl, ApiError } from '../api/client'
import { upload } from '../api/endpoints'
import { useFolder } from '../hooks/queries'
import { useCreateFolder, useDeleteFile, useMoveFile } from '../hooks/mutations'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FileRow } from '../components/FileRow'
import { FolderTree } from '../components/FolderTree'
import { QuickUploadButton } from '../components/QuickUploadButton'
import { StorageOverview } from '../components/StorageOverview'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState, ErrorBanner } from '../components/basics'
import { pushToast } from '../lib/toast'
import { useEscapeKey } from '../lib/useEscapeKey'
import { walkDrop } from '../lib/walkDrop'
import type { FbEntry } from '../api/types'

const MAX_SIZE = 200 * 1024 * 1024 // matches the server's in-memory cap

const joinPath = (base: string, sub: string) =>
  [base === '/' ? '' : base, sub].filter(Boolean).join('/') || '/'

const parentOf = (path: string) => {
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return parts.length ? `/${parts.join('/')}` : '/'
}

export function FilesPage() {
  const [params, setParams] = useSearchParams()
  const path = params.get('path') ?? '/'
  const folder = useFolder(path)
  const createFolder = useCreateFolder()
  const deleteFile = useDeleteFile()
  const moveFile = useMoveFile()

  const qc = useQueryClient()
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<FbEntry | null>(null)
  const [moving, setMoving] = useState<FbEntry | null>(null)
  const [destination, setDestination] = useState('')
  const [renaming, setRenaming] = useState<FbEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  useEscapeKey(() => setNewFolderOpen(false), newFolderOpen)
  useEscapeKey(() => setMoving(null), moving !== null)
  useEscapeKey(() => setRenaming(null), renaming !== null)

  const navigate = (p: string) => setParams(p === '/' ? {} : { path: p })

  const doCreateFolder = () => {
    const name = newFolderName.trim()
    if (!name) return
    const base = path === '/' ? '' : path
    createFolder.mutate(`${base}/${name}`, {
      onSuccess: () => {
        setNewFolderOpen(false)
        setNewFolderName('')
      },
    })
  }

  const startMove = (entry: FbEntry) => {
    setMoving(entry)
    setDestination(entry.path)
  }

  const doMove = () => {
    if (!moving || !destination.trim()) return
    moveFile.mutate(
      { path: moving.path, destination: destination.trim() },
      { onSuccess: () => setMoving(null) },
    )
  }

  const startRename = (entry: FbEntry) => {
    setRenaming(entry)
    setRenameValue(entry.name)
  }

  const doRename = () => {
    const name = renameValue.trim()
    if (!renaming || !name || name === renaming.name) return
    moveFile.mutate(
      { path: renaming.path, destination: joinPath(parentOf(renaming.path), name) },
      { onSuccess: () => setRenaming(null) },
    )
  }

  // Drops straight into whatever folder is currently open — walks dropped
  // directories client-side (the API only takes one file per request) and
  // preserves their structure under the current path.
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = await walkDrop(e.dataTransfer)
    if (dropped.length === 0) return

    setUploading(true)
    let succeeded = 0
    const failed: string[] = []
    for (const { file, relativeDir } of dropped) {
      if (file.size > MAX_SIZE) {
        failed.push(`${file.name}: over the 200MB limit`)
        continue
      }
      const targetFolder = joinPath(path, relativeDir)
      try {
        await upload(file, targetFolder === '/' ? undefined : targetFolder)
        succeeded += 1
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          failed.push(`${file.name}: already exists`)
        } else {
          failed.push(`${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`)
        }
      }
    }
    setUploading(false)
    if (succeeded > 0) {
      void qc.invalidateQueries({ queryKey: ['folder'] })
      pushToast(succeeded === 1 ? 'Uploaded 1 file' : `Uploaded ${succeeded} files`)
    }
    for (const msg of failed) pushToast(msg, 'error')
  }

  const items = folder.data?.items ?? []

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <h1 className="page-title">Files</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <QuickUploadButton
            label="+ Upload file"
            folder={path === '/' ? undefined : path}
          />
          <button className="btn" onClick={() => setNewFolderOpen(true)}>
            + New folder
          </button>
        </div>
      </div>

      <div className="files-layout">
        <FolderTree currentPath={folder.data?.path ?? path} onNavigate={navigate} />

        <div
          className={`files-main${dragOver ? ' drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <Breadcrumbs path={folder.data?.path ?? path} onNavigate={navigate} />
          <StorageOverview path={folder.data?.path ?? path} />

          {dragOver ? (
            <div className="files-drop-hint">Drop to upload into {path === '/' ? 'root' : path}</div>
          ) : null}
          {uploading ? <div className="files-drop-hint uploading">Uploading…</div> : null}

          {folder.isLoading ? <SkeletonRows /> : null}
          {folder.isError ? <ErrorBanner>Couldn&apos;t load this folder.</ErrorBanner> : null}
          {folder.isSuccess && items.length === 0 ? (
            <EmptyState>This folder is empty. Drag files here to upload.</EmptyState>
          ) : null}

          {items.length > 0 ? (
            <div className="file-list-header">
              <span className="fl-name">Name</span>
              <span className="fl-size">Size</span>
              <span className="fl-date">Modified</span>
            </div>
          ) : null}

          <div className="row-list">
            {items.map((entry) => {
              const download = entry.url ? mediaUrl(entry.url) : null
              return (
                <FileRow
                  key={entry.path}
                  entry={entry}
                  download={download}
                  onOpen={() => {
                    if (entry.isDir) navigate(entry.path)
                    else if (download) window.open(download, '_blank')
                  }}
                  onRename={() => startRename(entry)}
                  onMove={() => startMove(entry)}
                  onDelete={() => setConfirmDelete(entry)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {newFolderOpen ? (
        <div className="dialog-backdrop" onClick={() => setNewFolderOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>New folder in {path}</h3>
            <input
              className="input"
              placeholder="Folder name"
              value={newFolderName}
              autoFocus
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doCreateFolder()}
            />
            <div className="dialog-actions">
              <button className="btn" onClick={() => setNewFolderOpen(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={doCreateFolder}
                disabled={createFolder.isPending || !newFolderName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete “${confirmDelete.name}”?`}
          confirmLabel="Delete"
          danger
          busy={deleteFile.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() =>
            deleteFile.mutate(confirmDelete.path, {
              onSuccess: () => setConfirmDelete(null),
            })
          }
        >
          {confirmDelete.isDir ? (
            <p style={{ color: 'var(--red)', margin: 0 }}>
              This deletes the folder and everything inside it.
            </p>
          ) : null}
        </ConfirmDialog>
      ) : null}

      {renaming ? (
        <div className="dialog-backdrop" onClick={() => setRenaming(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Rename “{renaming.name}”</h3>
            <input
              className="input"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doRename()}
            />
            <div className="dialog-actions">
              <button className="btn" onClick={() => setRenaming(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={doRename}
                disabled={
                  moveFile.isPending || !renameValue.trim() || renameValue.trim() === renaming.name
                }
              >
                {moveFile.isPending ? '…' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {moving ? (
        <div className="dialog-backdrop" onClick={() => setMoving(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Move / rename</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: 0 }}>
              Edit the name to rename, or change the folder to move.
            </p>
            <input
              className="input"
              value={destination}
              autoFocus
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doMove()}
            />
            <div className="dialog-actions">
              <button className="btn" onClick={() => setMoving(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={doMove}
                disabled={moveFile.isPending || !destination.trim()}
              >
                {moveFile.isPending ? '…' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
