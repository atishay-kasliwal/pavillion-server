import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionExpiredError } from './api/client'
import { pushToast } from './lib/toast'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PlayerProvider } from './player/PlayerContext'
import { App } from './App'
import { GalleryPage } from './routes/GalleryPage'
import { AlbumsPage } from './routes/AlbumsPage'
import { AlbumDetailPage } from './routes/AlbumDetailPage'
import { MusicPage } from './routes/MusicPage'
import { ArtistPage } from './routes/ArtistPage'
import { MusicAlbumPage } from './routes/MusicAlbumPage'
import { FilesPage } from './routes/FilesPage'
import { SearchPage } from './routes/SearchPage'
import { UploadPage } from './routes/UploadPage'
import { TakeoutPage } from './routes/TakeoutPage'
import './styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
  // Global safety net: any mutation (delete, rename, move, folder create, …)
  // that fails now always surfaces something, instead of failing silently.
  // The session-expired case is handled by SessionExpiredGate instead.
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof SessionExpiredError) return
      pushToast(error instanceof Error ? error.message : 'Something went wrong', 'error')
    },
  }),
})

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <GalleryPage /> },
      { path: 'albums', element: <AlbumsPage /> },
      { path: 'albums/:id', element: <AlbumDetailPage /> },
      { path: 'music', element: <MusicPage /> },
      { path: 'music/artist/:id', element: <ArtistPage /> },
      { path: 'music/album/:id', element: <MusicAlbumPage /> },
      { path: 'files', element: <FilesPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'upload', element: <UploadPage /> },
      { path: 'takeout', element: <TakeoutPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <RouterProvider router={router} />
      </PlayerProvider>
    </QueryClientProvider>
  </StrictMode>,
)
