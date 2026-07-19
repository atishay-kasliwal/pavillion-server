import { useState } from 'react'
import {
  useCreateTakeoutAccount,
  useDeleteTakeoutAccount,
  useRunTakeoutImport,
} from '../hooks/mutations'
import { useTakeoutAccounts, useTakeoutStatus } from '../hooks/queries'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, ErrorBanner } from '../components/basics'
import { SkeletonRows } from '../components/Skeleton'
import { useEscapeKey } from '../lib/useEscapeKey'
import type { TakeoutAccount } from '../api/types'

const STATUS_LABEL: Record<TakeoutAccount['status'], string> = {
  idle: 'idle',
  running: 'importing…',
  done: 'imported',
  error: 'failed',
}

function statsLine(account: TakeoutAccount): string | null {
  const stats = account.lastRun?.stats
  if (!stats) return null
  const parts = [`${stats.imported} imported`]
  if (stats.duplicates) parts.push(`${stats.duplicates} already there`)
  if (stats.missingMetadata) parts.push(`${stats.missingMetadata} no date info`)
  if (stats.errors) parts.push(`${stats.errors} errors`)
  return parts.join(' · ')
}

function TakeoutAccountRow({ account }: { account: TakeoutAccount }) {
  const isRunning = account.status === 'running'
  const status = useTakeoutStatus(account.id, isRunning)
  const runImport = useRunTakeoutImport()
  const deleteAccount = useDeleteTakeoutAccount()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // While a run is in flight the live poll knows best; once it settles the
  // account list (refetched on mutation success) is the source of truth.
  const effectiveStatus = isRunning ? status.data?.status ?? account.status : account.status
  const log = status.data?.log ?? []
  const stats = statsLine(account)

  return (
    <div className="card takeout-card">
      <div className="takeout-card-head">
        <div className="row-main">
          <div className="row-name">{account.label}</div>
          <div className="row-sub">
            {account.lastRun
              ? `last run ${new Date(account.lastRun.finishedAt).toLocaleString()}${
                  stats ? ` · ${stats}` : ''
                }`
              : 'never imported'}
          </div>
        </div>
        <span className={`takeout-status-badge ${effectiveStatus}`}>
          {STATUS_LABEL[effectiveStatus]}
        </span>
        <button
          className="btn"
          onClick={() => runImport.mutate(account.id)}
          disabled={isRunning || runImport.isPending}
        >
          {isRunning ? '…' : 'Run import'}
        </button>
        <button className="row-action danger" onClick={() => setConfirmDelete(true)}>
          Remove
        </button>
      </div>

      <div className="takeout-path">{account.srcPath}</div>

      {isRunning || log.length > 0 ? (
        <div className="takeout-log">
          {log.length > 0
            ? log.filter((l) => !l.startsWith('RESULT_JSON:')).join('\n')
            : 'starting…'}
        </div>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Remove “${account.label}”?`}
          confirmLabel="Remove"
          danger
          busy={deleteAccount.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            deleteAccount.mutate(account.id, { onSuccess: () => setConfirmDelete(false) })
          }
        >
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: 0 }}>
            Only removes it from this list — downloaded files and already-imported photos stay
            on disk.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}

export function TakeoutPage() {
  const accountsQuery = useTakeoutAccounts()
  const createAccount = useCreateTakeoutAccount()
  const [addingOpen, setAddingOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  useEscapeKey(() => setAddingOpen(false), addingOpen)

  const accounts = accountsQuery.data?.accounts ?? []

  const doCreate = () => {
    const label = newLabel.trim()
    if (!label) return
    createAccount.mutate(label, {
      onSuccess: () => {
        setAddingOpen(false)
        setNewLabel('')
      },
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Google Photos Import</h1>
        <button className="btn" onClick={() => setAddingOpen(true)}>
          + Add account
        </button>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: -8, marginBottom: 20 }}>
        One-time import from a Google Takeout export. Add an account, download its Takeout .zip
        file(s) to the folder shown below, then run the import — safe to re-run, already-imported
        files are skipped.
      </p>

      {accountsQuery.isLoading ? <SkeletonRows /> : null}
      {accountsQuery.isError ? <ErrorBanner>Couldn&apos;t load accounts.</ErrorBanner> : null}
      {accountsQuery.isSuccess && accounts.length === 0 ? (
        <EmptyState>No accounts yet. Add one to get started.</EmptyState>
      ) : null}

      {accounts.map((account) => (
        <TakeoutAccountRow key={account.id} account={account} />
      ))}

      {addingOpen ? (
        <div className="dialog-backdrop" onClick={() => setAddingOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Add Google account</h3>
            <input
              className="input"
              placeholder="e.g. Mom's account"
              value={newLabel}
              autoFocus
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doCreate()}
            />
            <div className="dialog-actions">
              <button className="btn" onClick={() => setAddingOpen(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={doCreate}
                disabled={createAccount.isPending || !newLabel.trim()}
              >
                {createAccount.isPending ? '…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
