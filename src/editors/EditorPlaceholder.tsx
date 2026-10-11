import { Icon } from '../ui/Icon'
import type { WorkspaceFile } from '../files/types'
import styles from './EditorPlaceholder.module.css'

export default function EditorPlaceholder({ file }: { file: WorkspaceFile }) {
  const board = file.kind === 'board'
  return <section className={`${styles.canvas} ${board ? styles.board : styles.document}`} aria-label={board ? 'Mood board canvas' : 'Document canvas'}>
    <div className={styles.placeholder}>
      <div className={styles.icon}><Icon name={board ? 'board' : 'document'} size={28} /></div>
      <span className={styles.eyebrow}>{board ? 'ROOM TO CONNECT IDEAS' : 'ROOM TO TELL A STORY'}</span>
      <h2>{board ? 'An open canvas.' : 'A blank page.'}</h2>
      <p>{board ? 'Your mood board is created and saved. Text, images, and connections arrive in the next milestone.' : 'Your document is created and saved. Rich-text editing arrives in the document milestone.'}</p>
      <div className={styles.status}><Icon name="check" size={14} />File saved locally</div>
    </div>
    <div className={styles.canvasFooter}><span>{board ? 'INFINITE CANVAS' : 'DOCUMENT'} / FOUNDATION PREVIEW</span><span>{board ? 'Text · Images · Connections' : 'Headings · Lists · Images'}</span></div>
  </section>
}
