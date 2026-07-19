import { request } from './client'
import type {
  AlbumContents,
  AlbumSongs,
  Artist,
  ArtistAlbum,
  FolderListing,
  ImmichAlbum,
  SearchResponse,
  TakeoutAccount,
  TakeoutStatus,
  TimelinePage,
  UploadResult,
} from './types'

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// Health
export const health = () => request<{ ok: boolean }>('/api/health')

// Search
export const search = (q: string) =>
  request<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`)

// Upload
export const upload = (file: File, folder?: string) => {
  const form = new FormData()
  form.append('file', file)
  if (folder) form.append('folder', folder)
  return request<UploadResult>('/api/upload', { method: 'POST', body: form })
}

// Browse — Immich
export const browseImmich = (page: number) =>
  request<TimelinePage>(`/api/browse/immich?page=${page}`)

export const immichAlbums = () =>
  request<{ albums: ImmichAlbum[] }>('/api/browse/immich/albums')

export const immichAlbum = (id: string) =>
  request<AlbumContents>(`/api/browse/immich/albums/${encodeURIComponent(id)}`)

// Browse — Navidrome
export const artists = () =>
  request<{ artists: Artist[] }>('/api/browse/navidrome/artists')

export const artistAlbums = (id: string) =>
  request<{ albums: ArtistAlbum[] }>(
    `/api/browse/navidrome/artists/${encodeURIComponent(id)}`,
  )

export const albumSongs = (id: string) =>
  request<AlbumSongs>(`/api/browse/navidrome/albums/${encodeURIComponent(id)}`)

// Browse — Filebrowser
export const browseFiles = (path: string) =>
  request<FolderListing>(`/api/browse/filebrowser?path=${encodeURIComponent(path)}`)

export const createFolder = (path: string) =>
  request<{ path: string }>('/api/browse/filebrowser/folder', json('POST', { path }))

// Manage — Immich
export const deleteImmich = (id: string, permanent = false) =>
  request<void>(
    `/api/immich/${encodeURIComponent(id)}${permanent ? '?permanent=true' : ''}`,
    { method: 'DELETE' },
  )

export const createAlbum = (name: string, assetIds?: string[]) =>
  request<ImmichAlbum>('/api/immich/albums', json('POST', { name, assetIds }))

export const addAlbumAssets = (id: string, assetIds: string[]) =>
  request<void>(
    `/api/immich/albums/${encodeURIComponent(id)}/assets`,
    json('PUT', { assetIds }),
  )

export const removeAlbumAssets = (id: string, assetIds: string[]) =>
  request<void>(
    `/api/immich/albums/${encodeURIComponent(id)}/assets`,
    json('DELETE', { assetIds }),
  )

// Manage — Navidrome
export const deleteSong = (id: string) =>
  request<void>(`/api/navidrome/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const renameSong = (id: string, path: string) =>
  request<{ path: string }>(
    `/api/navidrome/${encodeURIComponent(id)}`,
    json('PATCH', { path }),
  )

// Manage — Filebrowser (path goes into the URL verbatim after /filebrowser/)
const fbPath = (path: string) =>
  path.split('/').filter(Boolean).map(encodeURIComponent).join('/')

export const deleteFile = (path: string) =>
  request<void>(`/api/filebrowser/${fbPath(path)}`, { method: 'DELETE' })

export const moveFile = (path: string, destination: string) =>
  request<{ path: string }>(
    `/api/filebrowser/${fbPath(path)}`,
    json('PATCH', { destination }),
  )

// Google Photos Takeout import
export const takeoutAccounts = () =>
  request<{ accounts: TakeoutAccount[] }>('/api/takeout/accounts')

export const createTakeoutAccount = (label: string) =>
  request<TakeoutAccount>('/api/takeout/accounts', json('POST', { label }))

export const deleteTakeoutAccount = (id: string) =>
  request<void>(`/api/takeout/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const runTakeoutImport = (id: string) =>
  request<{ status: 'running' }>(`/api/takeout/accounts/${encodeURIComponent(id)}/run`, {
    method: 'POST',
  })

export const takeoutStatus = (id: string) =>
  request<TakeoutStatus>(`/api/takeout/accounts/${encodeURIComponent(id)}/status`)
