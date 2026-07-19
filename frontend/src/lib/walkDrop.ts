// Flattens a drop event's items into files, recursing into directories via
// webkitGetAsEntry(). readEntries() returns batches (100 in Chrome) and must
// be called repeatedly until it returns an empty batch.

export type DroppedFile = {
  file: File
  relativeDir: string // '' for top-level files, 'sub/dir' for nested ones
}

export async function walkDrop(dataTransfer: DataTransfer): Promise<DroppedFile[]> {
  const entries: FileSystemEntry[] = []
  for (const item of Array.from(dataTransfer.items)) {
    const entry = item.webkitGetAsEntry?.()
    if (entry) entries.push(entry)
  }

  if (entries.length === 0) {
    return Array.from(dataTransfer.files).map((file) => ({ file, relativeDir: '' }))
  }

  const out: DroppedFile[] = []
  for (const entry of entries) {
    await walkEntry(entry, '', out)
  }
  return out
}

async function walkEntry(
  entry: FileSystemEntry,
  dir: string,
  out: DroppedFile[],
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    )
    out.push({ file, relativeDir: dir })
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const childDir = dir ? `${dir}/${entry.name}` : entry.name
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      )
      if (batch.length === 0) break
      for (const child of batch) {
        await walkEntry(child, childDir, out)
      }
    }
  }
}
