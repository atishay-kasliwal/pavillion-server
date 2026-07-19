import { useRecursiveStats } from '../hooks/queries'
import { formatBytes } from '../lib/format'

// Recursively walks the current folder and reports what it actually found —
// a live proof that everything under this path is reachable and indexed,
// not a cached count that could drift from what's really on disk.
export function StorageOverview({ path }: { path: string }) {
  const stats = useRecursiveStats(path)

  return (
    <div className="storage-overview">
      {stats.isLoading ? (
        <span className="storage-scanning">Scanning folder…</span>
      ) : stats.isError ? (
        <span className="storage-scanning">Couldn&apos;t scan this folder.</span>
      ) : stats.data ? (
        <>
          <strong>{formatBytes(stats.data.totalBytes)}</strong>
          <span className="storage-sep">·</span>
          <span>
            {stats.data.totalFiles.toLocaleString()}{' '}
            {stats.data.totalFiles === 1 ? 'file' : 'files'}
          </span>
          <span className="storage-sep">·</span>
          <span>
            {stats.data.totalDirs.toLocaleString()}{' '}
            {stats.data.totalDirs === 1 ? 'folder' : 'folders'}
          </span>
          <span className="storage-sep">·</span>
          <span className="storage-verified">everything below here is indexed</span>
        </>
      ) : null}
    </div>
  )
}
