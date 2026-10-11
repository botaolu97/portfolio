import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import type { FileKind, FileSummary } from '../files/types'
import styles from './Sidebar.module.css'

export function Sidebar({ files, loading, onCreate, onNavigate, open, onClose }: {
  files: FileSummary[]; loading: boolean; onCreate(kind: FileKind): void;
  onNavigate(): void; open: boolean; onClose(): void;
}) {
  return <>
    {open && <button className={styles.scrim} aria-label="Close navigation" onClick={onClose} />}
    <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
      <div className={styles.brand}><span className={styles.avatar}>b.</span><div><strong>Botao’s workspace</strong><span>A place for ideas</span></div><button className={styles.mobileClose} onClick={onClose} aria-label="Close sidebar"><Icon name="close" /></button></div>
      <NavLink to="/" end onClick={onNavigate} className={({ isActive }) => `${styles.home} ${isActive ? styles.active : ''}`}><Icon name="board" /><span>Overview</span></NavLink>
      <div className={styles.sectionHeading}><span>YOUR FILES</span><span>{files.length.toString().padStart(2, '0')}</span></div>
      <nav className={styles.files} aria-label="Workspace files">
        {loading ? <p className={styles.hint}>Opening your workspace…</p> : files.length === 0 ? <p className={styles.hint}>A fresh start.<br />Create your first file below.</p> : files.map(file => <NavLink key={file.id} to={`/files/${file.id}`} onClick={onNavigate} className={({ isActive }) => `${styles.file} ${isActive ? styles.active : ''}`}><Icon name={file.kind === 'board' ? 'board' : 'document'} size={18} /><span title={file.title}>{file.title}</span><span className={styles.fileDot} /></NavLink>)}
      </nav>
      <div className={styles.create}><button onClick={() => onCreate('board')}><Icon name="plus" size={17} />New mood board</button><button onClick={() => onCreate('document')}><Icon name="plus" size={17} />New document</button></div>
      <div className={styles.footer}><div><span className={styles.localDot} />LOCAL WORKSPACE</div><p>Your drafts stay in this browser.<br />Publishing comes when you’re ready.</p><span className={styles.version}>FOUNDATION / 01</span></div>
    </aside>
  </>
}
