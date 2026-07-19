import { IconAlertCircle, IconCheckCircle, IconClock } from '../components/icons'
import type { Source } from '../api/types'
import type { UploadRowStatus } from './UploadQueueContext'

export const destinationLabel: Record<Source, string> = {
  immich: 'Photos',
  navidrome: 'Music',
  filebrowser: 'Files',
}

export const statusMeta: Record<
  UploadRowStatus,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  queued: { label: 'Queued', icon: <IconClock className="status-icon" />, tone: 'queued' },
  uploading: { label: 'Uploading…', icon: <span className="mini-spinner" />, tone: 'uploading' },
  done: { label: 'Done', icon: <IconCheckCircle className="status-icon" />, tone: 'done' },
  duplicate: {
    label: 'Already in library',
    icon: <IconCheckCircle className="status-icon" />,
    tone: 'duplicate',
  },
  error: { label: 'Failed', icon: <IconAlertCircle className="status-icon" />, tone: 'error' },
  conflict: {
    label: 'Already exists',
    icon: <IconAlertCircle className="status-icon" />,
    tone: 'error',
  },
  'too-large': {
    label: 'Too large',
    icon: <IconAlertCircle className="status-icon" />,
    tone: 'error',
  },
}
