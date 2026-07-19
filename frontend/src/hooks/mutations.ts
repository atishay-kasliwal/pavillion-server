import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { pushToast } from '../lib/toast'
import type { AlbumContents, ImmichAlbum, Item } from '../api/types'

// Album add/remove: the album-detail endpoint is backed by Immich's search
// index and lags behind writes, so on success we patch the cache directly
// instead of refetching; staleTime on the query picks up truth later.

export function useAddAlbumAssets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ albumId, items }: { albumId: string; items: Item[] }) =>
      api.addAlbumAssets(
        albumId,
        items.map((i) => i.id),
      ),
    onSuccess: (_, { albumId, items }) => {
      qc.setQueryData<AlbumContents>(['album', albumId], (old) => {
        if (!old) return old
        const existing = new Set(old.items.map((i) => i.id))
        const added = items.filter((i) => !existing.has(i.id))
        return { items: [...old.items, ...added] }
      })
      qc.setQueryData<{ albums: ImmichAlbum[] }>(['albums'], (old) =>
        old
          ? {
              albums: old.albums.map((a) =>
                a.id === albumId
                  ? { ...a, assetCount: a.assetCount + items.length }
                  : a,
              ),
            }
          : old,
      )
      pushToast(items.length === 1 ? 'Added to album' : `Added ${items.length} items to album`)
    },
  })
}

export function useRemoveAlbumAssets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ albumId, assetIds }: { albumId: string; assetIds: string[] }) =>
      api.removeAlbumAssets(albumId, assetIds),
    onSuccess: (_, { albumId, assetIds }) => {
      const removed = new Set(assetIds)
      qc.setQueryData<AlbumContents>(['album', albumId], (old) =>
        old ? { items: old.items.filter((i) => !removed.has(i.id)) } : old,
      )
      qc.setQueryData<{ albums: ImmichAlbum[] }>(['albums'], (old) =>
        old
          ? {
              albums: old.albums.map((a) =>
                a.id === albumId
                  ? { ...a, assetCount: Math.max(0, a.assetCount - assetIds.length) }
                  : a,
              ),
            }
          : old,
      )
      pushToast(assetIds.length === 1 ? 'Removed from album' : `Removed ${assetIds.length} items`)
    },
  })
}

export function useCreateAlbum() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, assetIds }: { name: string; assetIds?: string[] }) =>
      api.createAlbum(name, assetIds),
    onSuccess: (album) => {
      void qc.invalidateQueries({ queryKey: ['albums'] })
      pushToast(`Created album “${album.name}”`)
    },
  })
}

export function useDeleteImmich() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, permanent }: { id: string; permanent?: boolean }) =>
      api.deleteImmich(id, permanent),
    onSuccess: (_, { permanent }) => {
      void qc.invalidateQueries({ queryKey: ['timeline'] })
      pushToast(permanent ? 'Deleted permanently' : 'Moved to trash')
    },
  })
}

export function useDeleteSong() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteSong(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['albumSongs'] })
      void qc.invalidateQueries({ queryKey: ['artistAlbums'] })
      void qc.invalidateQueries({ queryKey: ['artists'] })
      pushToast('Song deleted')
    },
  })
}

// After a rename the song's id is dead (Navidrome rescan assigns a new one) —
// callers must also purge the old id from the player queue.
export function useRenameSong() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) =>
      api.renameSong(id, path),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['albumSongs'] })
      void qc.invalidateQueries({ queryKey: ['artistAlbums'] })
      void qc.invalidateQueries({ queryKey: ['artists'] })
      pushToast('Song moved')
    },
  })
}

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (path: string) => api.createFolder(path),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['folder'] })
      pushToast('Folder created')
    },
  })
}

export function useDeleteFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (path: string) => api.deleteFile(path),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['folder'] })
      pushToast('Deleted')
    },
  })
}

export function useMoveFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path, destination }: { path: string; destination: string }) =>
      api.moveFile(path, destination),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['folder'] })
      pushToast('Moved')
    },
  })
}
