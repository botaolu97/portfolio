import { useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import fileIcon from '../ui/assets/file.svg'
import aboutLine from '../ui/assets/tree-about.svg'
import workLine from '../ui/assets/tree-work.svg'
import type { FileKind, FileSummary } from '../files/types'
import styles from './Sidebar.module.css'

export function Sidebar({ files, loading, onCreate, onNavigate, open, onClose }: {
  files: FileSummary[]; loading: boolean; onCreate(kind: FileKind): void;
  onNavigate(): void; open: boolean; onClose(): void;
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  return <>
    {open && <button className={styles.scrim} aria-label="Close navigation" onClick={onClose} />}
    <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
      <button className={styles.mobileClose} onClick={onClose} aria-label="Close sidebar"><Icon name="close" size={16} /></button>
      <nav aria-label="About" className={`${styles.group} ${styles.about}`}>
        <span className={styles.branchPoint} /><img className={styles.treeLine} src={aboutLine} alt="" />
        <div className={styles.groupHeading}>about</div>
        <NavLink to="/" end onClick={onNavigate} className={({ isActive }) => `${styles.file} ${isActive ? styles.active : ''}`}><img src={fileIcon} alt="" /><span>Welcome!</span></NavLink>
      </nav>
      <div className={`${styles.group} ${styles.work}`}>
        <span className={styles.branchPoint} /><img className={styles.treeLine} src={workLine} alt="" />
        <div className={styles.groupHeading}><span>work</span><div className={styles.create} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setCreateOpen(false) }}>
          <button ref={addButton} className={styles.add} aria-label="Add file" aria-expanded={createOpen} onClick={() => setCreateOpen(!createOpen)} onKeyDown={event => { if (event.key === 'Escape') setCreateOpen(false) }}><Icon name="plus" size={14} /></button>
          {createOpen && <div className={styles.createMenu}><button onClick={() => { addButton.current?.focus(); setCreateOpen(false); onCreate('board') }}>New mood board</button><button onClick={() => { addButton.current?.focus(); setCreateOpen(false); onCreate('document') }}>New document</button></div>}
        </div></div>
        <nav aria-label="Workspace files">
          {loading ? <span className={styles.loading} role="status">Loading…</span> : files.map(file => <NavLink key={file.id} to={`/files/${file.id}`} onClick={onNavigate} className={({ isActive }) => `${styles.file} ${isActive ? styles.active : ''}`}><img src={fileIcon} alt="" /><span title={file.title}>{file.title}</span></NavLink>)}
        </nav>
      </div>
    </aside>
  </>
}
