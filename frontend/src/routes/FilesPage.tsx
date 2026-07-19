import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mediaUrl } from '../api/client'
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
import { useEscapeKey } from '../lib/useEscapeKey'
import type { FbEntry } from '../api/types'

export function FilesPage() {
  const [params, setParams] = useSearchParams()
  const path = params.get('path') ?? '/'
  const folder = useFolder(path)
  const createFolder = useCreateFolder()
  const deleteFile = useDeleteFile()
  const moveFile = useMoveFile()

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<FbEntry | null>(null)
  const [moving, setMoving] = useState<FbEntry | null>(null)
  const [destination, setDestination] = useState('')
  useEscapeKey(() => setNewFolderOpen(false), newFolderOpen)
  useEscapeKey(() => setMoving(null), moving !== null)

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

  const items = folder.data?.items ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Files</h1>
        <div style={{ display: 'flex', gap: 8 }}>
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

        <div className="files-main">
          <Breadcrumbs path={folder.data?.path ?? path} onNavigate={navigate} />
          <StorageOverview path={folder.data?.path ?? path} />

          {folder.isLoading ? <SkeletonRows /> : null}
          {folder.isError ? <ErrorBanner>Couldn&apos;t load this folder.</ErrorBanner> : null}
          {folder.isSuccess && items.length === 0 ? (
            <EmptyState>This folder is empty.</EmptyState>
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
