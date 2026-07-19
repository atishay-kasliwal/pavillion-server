import { NavLink, Outlet } from 'react-router-dom'
import { useHealth, useSystemStorage } from './hooks/queries'
import { formatBytes } from './lib/format'
import { MiniPlayer } from './player/MiniPlayer'
import { SessionExpiredGate } from './components/SessionExpiredGate'
import { ToastStack } from './components/ToastStack'
import {
  IconAlbums,
  IconFolder,
  IconMusic,
  IconPhoto,
  IconSearch,
  IconUpload,
} from './components/icons'

const NAV = [
  { to: '/', label: 'Photos', icon: IconPhoto },
  { to: '/albums', label: 'Albums', icon: IconAlbums },
  { to: '/music', label: 'Music', icon: IconMusic },
  { to: '/files', label: 'Files', icon: IconFolder },
  { to: '/search', label: 'Search', icon: IconSearch },
  { to: '/upload', label: 'Upload', icon: IconUpload },
]

export function App() {
  const health = useHealth()
  const storage = useSystemStorage()
  const status = health.isSuccess ? 'ok' : health.isError ? 'err' : ''

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Pavillion</div>
        <div className="topbar-right">
          {storage.data ? (
            <span className="storage-pill">
              {formatBytes(storage.data.freeBytes)} free of{' '}
              {formatBytes(storage.data.totalBytes)}
            </span>
          ) : null}
          <div className="status-pill">
            <span className={`status-dot ${status}`} />
            {health.isSuccess ? 'Connected' : health.isError ? 'Offline' : 'Checking…'}
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <MiniPlayer />

      <nav className="bottom-nav">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <n.icon className="nav-icon" />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <SessionExpiredGate />
      <ToastStack />
    </div>
  )
}
