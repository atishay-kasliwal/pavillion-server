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
  // GPS EXIF, Immich assets only (from the photo's capture metadata) —
  // absent/null for navidrome and filebrowser items, and for photos with
  // no location data at capture time. Read-only, not user-editable.
  latitude?: number | null
  longitude?: number | null
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
  // Immich uploads only — true when the file's content checksum matched an
  // asset already in the library (nothing new was stored).
  duplicate?: boolean
  [key: string]: unknown
}

export type SystemStorage = {
  totalBytes: number
  freeBytes: number
  usedBytes: number
}
