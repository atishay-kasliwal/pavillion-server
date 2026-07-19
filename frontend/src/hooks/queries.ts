import {
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'
import * as api from '../api/endpoints'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    retry: 1,
    refetchInterval: 60_000,
  })
}

export function useSystemStorage() {
  return useQuery({
    queryKey: ['systemStorage'],
    queryFn: api.systemStorage,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
}

export function useTimeline() {
  return useInfiniteQuery({
    queryKey: ['timeline'],
    queryFn: ({ pageParam }) => api.browseImmich(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
  })
}

export function useAlbums() {
  return useQuery({ queryKey: ['albums'], queryFn: api.immichAlbums })
}

export function useAlbum(id: string) {
  return useQuery({
    queryKey: ['album', id],
    queryFn: () => api.immichAlbum(id),
    staleTime: 30_000,
  })
}

export function useArtists() {
  return useQuery({ queryKey: ['artists'], queryFn: api.artists })
}

export function useArtistAlbums(id: string) {
  return useQuery({
    queryKey: ['artistAlbums', id],
    queryFn: () => api.artistAlbums(id),
  })
}

export function useAlbumSongs(id: string) {
  return useQuery({
    queryKey: ['albumSongs', id],
    queryFn: () => api.albumSongs(id),
  })
}

export function useFolder(path: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['folder', path],
    queryFn: () => api.browseFiles(path),
    enabled: options?.enabled ?? true,
  })
}

export type FolderStats = { totalFiles: number; totalDirs: number; totalBytes: number }

// Recursively walks a folder via the same browse endpoint the listing uses —
// no backend change needed, just N sequential requests down the subtree.
// This is the frontend's proof that everything on disk is actually indexed
// and reachable, not a guess from stored metadata.
async function walkFolderStats(path: string): Promise<FolderStats> {
  const { items } = await api.browseFiles(path)
  const stats: FolderStats = { totalFiles: 0, totalDirs: 0, totalBytes: 0 }
  for (const item of items) {
    if (item.isDir) {
      stats.totalDirs += 1
      const sub = await walkFolderStats(item.path)
      stats.totalFiles += sub.totalFiles
      stats.totalDirs += sub.totalDirs
      stats.totalBytes += sub.totalBytes
    } else {
      stats.totalFiles += 1
      stats.totalBytes += item.size ?? 0
    }
  }
  return stats
}

export function useRecursiveStats(path: string, enabled = true) {
  return useQuery({
    queryKey: ['folderStats', path],
    queryFn: () => walkFolderStats(path),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: q.trim().length > 0,
  })
}
