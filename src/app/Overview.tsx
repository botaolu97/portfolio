import { Link } from 'react-router-dom'
import type { FileKind, FileSummary } from '../files/types'
import { Icon } from '../ui/Icon'
import styles from './App.module.css'

export function Overview({ files, loading, onCreate }: { files: FileSummary[]; loading: boolean; onCreate(kind: FileKind): void }) {
  return <div className={styles.overview}>
    <div className={styles.intro}><span className={styles.eyebrow}>A PERSONAL SPACE FOR WORK IN PROGRESS</span><h1>Good ideas start<br />with a little space<span>.</span></h1><p>Collect the pieces. Connect the dots. Tell your story.<br />This is your space to put it all together.</p></div>
    <div className={styles.creationGrid}>
      <button className={`${styles.creationCard} ${styles.boardCard}`} onClick={() => onCreate('board')}><div className={styles.boardSketch} aria-hidden="true"><span /><span /><span /><svg viewBox="0 0 240 110"><path d="M58 59C97 59 89 40 136 40M158 52C178 52 174 81 201 81" fill="none" stroke="currentColor" /></svg></div><div className={styles.cardBottom}><div><h2>A mood board</h2><p>A canvas for things that connect.</p></div><span className={styles.roundArrow}><Icon name="arrow" size={18} /></span></div></button>
      <button className={`${styles.creationCard} ${styles.docCard}`} onClick={() => onCreate('document')}><div className={styles.docSketch} aria-hidden="true"><div><span /><span /><span /><span /><span /></div></div><div className={styles.cardBottom}><div><h2>A document</h2><p>A page for thoughts that unfold.</p></div><span className={styles.roundArrow}><Icon name="arrow" size={18} /></span></div></button>
    </div>
    <div className={styles.listHeading}><h2>Your workspace</h2><span>{files.length} {files.length === 1 ? 'file' : 'files'}</span></div>
    {loading ? <p className={styles.empty}>Opening local files…</p> : files.length ? <div className={styles.fileGrid}>{files.map(file => <Link key={file.id} to={`/files/${file.id}`} className={styles.fileCard}><span className={styles.fileIcon}><Icon name={file.kind === 'board' ? 'board' : 'document'} size={22} /></span><strong>{file.title}</strong><span>{file.kind === 'board' ? 'Mood board' : 'Document'}<span className={styles.separator}>·</span>{new Date(file.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span><Icon name="arrow" size={16} /></Link>)}</div> : <div className={styles.empty}><Icon name="plus" size={20} /><p>Nothing here yet. Make room for your first idea.</p></div>}
    <div className={styles.overviewFooter}><span>Made to evolve with you.</span><span><Icon name="local" size={14} />Saved on this device</span></div>
  </div>
}
