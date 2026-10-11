import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import fileIcon from '../ui/assets/file.svg'
import closeIcon from '../ui/assets/close.svg'
import { Icon } from '../ui/Icon'
import styles from './App.module.css'

export function WorkspaceTabs({ title, onOpenNavigation, onRename, onDelete }: {
  title?: string; onOpenNavigation(): void; onRename?(): void; onDelete?(): void;
}) {
  const navigate = useNavigate()
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionButton = useRef<HTMLButtonElement>(null)
  return <header className={styles.tabs}>
    <button className={styles.menu} aria-label="Open navigation" onClick={onOpenNavigation}><Icon name="menu" size={16} /></button>
    {title && <div className={styles.tab}><img src={fileIcon} alt="" /><h1>{title}</h1><button className={styles.closeTab} onClick={() => navigate('/empty')} aria-label="Close file"><img src={closeIcon} alt="" /></button></div>}
    {onRename && onDelete && <div className={styles.actions} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActionsOpen(false) }}>
      <button ref={actionButton} className={styles.actionTrigger} aria-label="File actions" aria-expanded={actionsOpen} onClick={() => setActionsOpen(!actionsOpen)} onKeyDown={event => { if (event.key === 'Escape') setActionsOpen(false) }}>···</button>
      {actionsOpen && <div className={styles.actionMenu}><button onClick={() => { actionButton.current?.focus(); setActionsOpen(false); onRename() }}>Rename</button><button onClick={() => { actionButton.current?.focus(); setActionsOpen(false); onDelete() }}>Delete</button></div>}
    </div>}
  </header>
}
