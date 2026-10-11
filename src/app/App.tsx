import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { localRepository } from '../persistence/localRepository'
import { useWorkspace } from '../files/useWorkspace'
import { normalizeTitle, type FileKind, type FileRepository, type WorkspaceFile } from '../files/types'
import { Sidebar } from '../navigation/Sidebar'
import { Dialog } from '../ui/Dialog'
import { WorkspaceTabs } from './WorkspaceTabs'
import canvasStyles from '../editors/EditorPlaceholder.module.css'
import styles from './App.module.css'

const EditorPlaceholder = lazy(() => import('../editors/EditorPlaceholder'))
type FileAction = { type: 'create'; kind: FileKind } | { type: 'rename' | 'delete'; file: WorkspaceFile }

export function App({ repository = localRepository }: { repository?: FileRepository }) {
  const workspace = useWorkspace(repository)
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [action, setAction] = useState<FileAction | null>(null)
  const create = (kind: FileKind) => { setSidebarOpen(false); setAction({ type: 'create', kind }) }

  async function submit(title: string) {
    if (!action) return
    if (action.type === 'create') {
      const file = await workspace.create(action.kind, title)
      navigate(`/files/${file.id}`)
    } else if (action.type === 'rename') await workspace.rename(action.file.id, title)
    else { await workspace.remove(action.file.id); navigate('/') }
    setAction(null)
  }

  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to main content</a>
    <Sidebar files={workspace.files} loading={workspace.loading} onCreate={create} onNavigate={() => setSidebarOpen(false)} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <main id="main-content" className={styles.main} tabIndex={-1}>
      {workspace.error && <div role="alert" className={styles.errorBanner}>{workspace.error}<button onClick={() => void workspace.refresh()}>Retry</button></div>}
      <Routes>
        <Route path="/" element={<><WorkspaceTabs title="Welcome!" onOpenNavigation={() => setSidebarOpen(true)} /><section className={`${canvasStyles.canvas} ${canvasStyles.board}`} aria-label="Welcome canvas" /></>} />
        <Route path="/empty" element={<><WorkspaceTabs onOpenNavigation={() => setSidebarOpen(true)} /><section className={canvasStyles.canvas} aria-label="Empty workspace" /></>} />
        <Route path="/files/:id" element={<FileSurface repository={repository} revision={workspace.revision} onAction={setAction} onOpenNavigation={() => setSidebarOpen(true)} />} />
        <Route path="*" element={<MissingFile onHome={() => navigate('/')} />} />
      </Routes>
    </main>
    {action && <FileDialog key={action.type === 'create' ? action.kind : `${action.type}-${action.file.id}`} action={action} onClose={() => setAction(null)} onSubmit={submit} />}
  </div>
}

function FileSurface({ repository, revision, onAction, onOpenNavigation }: { repository: FileRepository; revision: number; onAction(action: FileAction): void; onOpenNavigation(): void }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<{ file?: WorkspaceFile; loading: boolean; error?: string }>({ loading: true })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setState({ loading: true })
    repository.load(id!).then(file => { if (active) setState({ file, loading: false }) }).catch(() => { if (active) setState({ loading: false, error: 'We couldn’t load this file. Your local draft has not been changed.' }) })
    return () => { active = false }
  }, [repository, id, revision, retry])
  if (state.loading) return <div className={styles.loading} role="status">Opening file…</div>
  if (state.error) return <div className={styles.missing}><h1>Unable to open file</h1><p role="alert">{state.error}</p><button className={styles.primary} onClick={() => setRetry(value => value + 1)}>Try again</button></div>
  if (!state.file) return <><WorkspaceTabs onOpenNavigation={onOpenNavigation} /><MissingFile onHome={() => navigate('/')} /></>
  const file = state.file
  return <><WorkspaceTabs title={file.title} onOpenNavigation={onOpenNavigation} onRename={() => onAction({ type: 'rename', file })} onDelete={() => onAction({ type: 'delete', file })} /><Suspense fallback={<div className={styles.loading}>Opening canvas…</div>}><EditorPlaceholder file={file} /></Suspense></>
}

function MissingFile({ onHome }: { onHome(): void }) {
  return <div className={styles.missing}><h1>This file isn’t here.</h1><p>It may have been deleted, or saved in a different browser.</p><button className={styles.primary} onClick={onHome}>Back to Welcome</button></div>
}

function FileDialog({ action, onClose, onSubmit }: { action: FileAction; onClose(): void; onSubmit(title: string): Promise<void> }) {
  const deleting = action.type === 'delete'
  const [title, setTitle] = useState(action.type === 'create' ? '' : action.file.title)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const heading = action.type === 'create' ? `New ${action.kind === 'board' ? 'mood board' : 'document'}` : deleting ? 'Delete file?' : 'Rename file'
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const value = deleting ? title : normalizeTitle(title)
      setError(null); setBusy(true)
      await onSubmit(value)
    } catch (failure) {
      setBusy(false)
      setError(failure instanceof Error && !('name' in failure && ['QuotaExceededError', 'UnknownError', 'DatabaseClosedError'].includes(failure.name)) ? failure.message : 'Couldn’t save this change. Browser storage may be unavailable or full. Try again.')
    }
  }
  return <Dialog title={heading} onClose={() => { if (!busy) onClose() }}><form onSubmit={event => void submit(event)}>
    {deleting ? <p className={styles.dialogDescription}>“{title}” will be removed from this browser. This cannot be undone.</p> : <><label className={styles.label} htmlFor="file-name">File name</label><input id="file-name" autoFocus className={styles.input} value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder={action.type === 'create' && action.kind === 'board' ? 'e.g. A new direction' : 'e.g. Project notes'} disabled={busy} aria-describedby={error ? 'form-error' : undefined} /><p className={styles.dialogDescription}>Saved locally. You can publish it later.</p></>}
    {error && <p id="form-error" role="alert" className={styles.formError}>{error}</p>}
    <div className={styles.dialogActions}><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={deleting ? styles.danger : styles.primary} disabled={busy}>{busy ? 'Saving…' : deleting ? 'Delete file' : action.type === 'create' ? 'Create file' : 'Save name'}</button></div>
  </form></Dialog>
}
