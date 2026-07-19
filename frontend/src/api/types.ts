// Mirrors FRONTEND.md's API contract exactly.

export type Source = 'immich' | 'navidrome' | 'filebrowser'
export type ItemType = 'photo' | 'video' | 'audio' | 'file'

export type Item = {
  source: Source
  type: ItemType
  id: string // opaque, backend-specific — pass back verbatim for delete/rename
  name: string
  createdAt: string | null // ISO 8601
  size: number | null // bytes
  thumbnailUrl: string | null // relative — prefix with API origin
  url: string // relative — full-quality/download/stream URL
}

export type SearchResponse = {
  query: string
  count: number
  results: Item[]
  errors: { source: string; message: string }[]
}

export type TimelinePage = {
  items: Item[]
  nextPage: number | null
}

export type ImmichAlbum = {
  id: string
  name: string
  assetCount: number
  thumbnailUrl: string | null
}

export type AlbumContents = { items: Item[] }

export type Artist = {
  id: string
  name: string
  albumCount: number
}

export type ArtistAlbum = {
  id: string
  name: string
  year: number | null
  songCount: number
  thumbnailUrl: string | null
}

export type AlbumSongs = { songs: Item[] }

export type FbEntry = {
  name: string
  isDir: boolean
  size: number | null
  modified: string | null
  path: string
  url: string | null
}

export type FolderListing = {
  path: string
  items: FbEntry[]
}

export type UploadResult = {
  destination: Source
  [key: string]: unknown
}

export type TakeoutRunStats = {
  imported: number
  duplicates: number
  missingMetadata: number
  errors: number
}

export type TakeoutRun = {
  startedAt: string
  finishedAt: string
  status: 'success' | 'error'
  stats: TakeoutRunStats | null
  errorMessage: string | null
}

export type TakeoutAccount = {
  id: string
  label: string
  slug: string
  createdAt: string
  srcPath: string
  destPath: string
  status: 'idle' | 'running' | 'done' | 'error'
  lastRun: TakeoutRun | null
}

export type TakeoutStatus = {
  status: 'idle' | 'running' | 'done' | 'error'
  log: string[]
  startedAt?: string
  lastRun: TakeoutRun | null
}
